#!/usr/bin/env python3
"""Run a ComfyUI UI-format workflow template as a job, headless.

Runs on the PC, talks to ComfyUI through an SSH tunnel (default 127.0.0.1:8188).
Needs Python 3.9+, `requests` and `websocket-client`.

    python comfy_run.py jobs/example.json
    python comfy_run.py jobs/example.json --dry-run          # print the API JSON, queue nothing
    python comfy_run.py jobs/example.json --list-nodes       # ids, titles and widgets to target
    python comfy_run.py --save-object-info object_info.json  # snapshot /object_info of the server

What it does with a job file:
  1. loads the template (the JSON you get from "Save" in the ComfyUI UI),
  2. converts it to API format using the server's /object_info: subgraphs are
     flattened, bypassed nodes are passed through, Reroute and PrimitiveNode are
     resolved, links become [node, slot] pairs and widgets_values become named inputs,
  3. applies the overrides from the job file,
  4. checks the result against /object_info (required inputs, types, ranges, file names),
  5. uploads local images and audio, queues the prompt, waits on /ws,
  6. downloads the outputs and appends one timing line to a jsonl log.

Anything it cannot map raises an error and stops. Nothing is guessed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import random
import re
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


class ConvertError(Exception):
    """The template or the job cannot be turned into a valid prompt."""


# ----------------------------------------------------------------------------
# /object_info access
# ----------------------------------------------------------------------------

WIDGET_TYPES = {"INT", "FLOAT", "STRING", "BOOLEAN", "COMBO"}
UPLOAD_FLAGS = ("image_upload", "audio_upload", "video_upload", "animated_image_upload", "file_upload")
# values the frontend stores for the extra upload and preview widgets of Load* nodes
UPLOAD_EXTRAS = {None, "image", "audio", "video", "upload"}
# nodes that only exist in the browser
FRONTEND_ONLY = {"Note", "MarkdownNote", "Reroute", "PrimitiveNode"}


@dataclass
class InputSpec:
    name: str
    type: str
    opts: dict
    required: bool
    options: Optional[list]  # combo choices
    dyn_options: Optional[list] = None  # dynamic combo: [{"key": ..., "inputs": {...}}]

    @property
    def dynamic(self) -> bool:
        return self.dyn_options is not None

    @property
    def is_widget(self) -> bool:
        if self.opts.get("forceInput") or self.opts.get("force_input") or self.opts.get("hidden"):
            return False
        return self.type in WIDGET_TYPES or self.dynamic

    @property
    def control_after_generate(self) -> bool:
        return bool(self.opts.get("control_after_generate"))

    @property
    def uploads(self) -> bool:
        return any(self.opts.get(f) for f in UPLOAD_FLAGS)


def parse_inputs(groups: dict, order: Optional[dict] = None) -> list[InputSpec]:
    out: list[InputSpec] = []
    order = order or {}
    for group in ("required", "optional"):
        items = groups.get(group) or {}
        listed = [n for n in (order.get(group) or []) if n in items]
        names = listed + [n for n in items if n not in listed]
        for name in names:
            raw = items[name]
            t = raw[0]
            opts = raw[1] if len(raw) > 1 and isinstance(raw[1], dict) else {}
            options = None
            dyn = None
            if isinstance(t, list):
                options, t = t, "COMBO"
            elif t == "COMBO":
                options = opts.get("options")
            elif isinstance(t, str) and "DYNAMICCOMBO" in t.upper():
                dyn = opts.get("options") or []
                options = [o["key"] for o in dyn]
            out.append(InputSpec(name, t, opts, group == "required", options, dyn))
    return out


class ObjectInfo:
    def __init__(self, data: dict):
        self.data = data
        self._cache: dict[str, list[InputSpec]] = {}

    def has(self, cls: str) -> bool:
        return cls in self.data

    def info(self, cls: str) -> dict:
        if cls not in self.data:
            raise ConvertError(
                f"node type '{cls}' is not known to the server. It needs a custom node or a newer ComfyUI. "
                "Nothing is guessed, so stopping."
            )
        return self.data[cls]

    def inputs(self, cls: str) -> list[InputSpec]:
        if cls not in self._cache:
            info = self.info(cls)
            self._cache[cls] = parse_inputs(info.get("input", {}) or {}, info.get("input_order"))
        return self._cache[cls]

    def spec(self, cls: str, name: str) -> Optional[InputSpec]:
        for s in self.inputs(cls):
            if s.name == name:
                return s
        return None

    def widget_specs(self, cls: str) -> list[InputSpec]:
        return [s for s in self.inputs(cls) if s.is_widget]

    def output_types(self, cls: str) -> list[str]:
        return list(self.info(cls).get("output") or [])

    def is_output_node(self, cls: str) -> bool:
        return bool(self.info(cls).get("output_node"))


# ----------------------------------------------------------------------------
# Flat graph (after subgraph expansion)
# ----------------------------------------------------------------------------


@dataclass(frozen=True)
class Src:
    fid: str
    slot: int


@dataclass(frozen=True)
class Const:
    value: Any


class FNode:
    def __init__(self, fid: str, cls: str, title: Optional[str], widgets: dict, links: dict,
                 in_types: list, out_types: list):
        self.fid = fid
        self.cls = cls
        self.title = title
        self.widgets = widgets            # name -> constant value
        self.links = links                # input name -> Src
        self.in_types = in_types          # [(input name, type)] of the socket inputs in the template
        self.out_types = out_types        # [type] per output slot

    def label(self) -> str:
        return f"{self.fid} {self.cls}" + (f" '{self.title}'" if self.title else "")


class Instance:
    """A subgraph instance, kept so jobs can set its promoted inputs by name or label."""

    def __init__(self, fid: str, title: Optional[str], sg_name: str):
        self.fid = fid
        self.title = title
        self.sg_name = sg_name
        self.inputs: dict[str, list[tuple[str, str]]] = {}  # name or label -> [(flat id, input name)]

    def label(self) -> str:
        return f"{self.fid} subgraph '{self.title or self.sg_name}'"


class FlatGraph:
    def __init__(self):
        self.nodes: dict[str, FNode] = {}
        self.instances: dict[str, Instance] = {}
        self.trusted: set[tuple[str, str]] = set()   # (flat id, widget) set from uploads, skip file-name checks


def fid_key(fid: str) -> tuple:
    return tuple(int(p) if p.lstrip("-").isdigit() else p for p in fid.split(":"))


class Ctx:
    def __init__(self, nodes: list, links: list, prefix: str, boundary_in: list):
        self.nodes = {n["id"]: n for n in nodes}
        self.links = {}
        for link in links or []:
            if isinstance(link, dict):
                self.links[link["id"]] = (link["origin_id"], link["origin_slot"], link["target_id"], link["target_slot"])
            else:
                self.links[link[0]] = (link[1], link[2], link[3], link[4])
        self.prefix = prefix
        self.boundary_in = boundary_in
        self.expanded: dict[Any, list] = {}


def pick_bypass_input(entries: list, out_slot: int, out_type: str) -> Optional[int]:
    """entries: [(name, type, linked)]. Same slot index first, then the first linked input of the same type."""
    def ok(i: int) -> bool:
        name, typ, linked = entries[i]
        return bool(linked) and (typ == out_type or typ == "*" or out_type == "*")
    if out_slot < len(entries) and ok(out_slot):
        return out_slot
    for i in range(len(entries)):
        if ok(i):
            return i
    return None


class Flattener:
    def __init__(self, template: dict, oi: ObjectInfo):
        self.oi = oi
        self.template = template
        self.defs = {s["id"]: s for s in (template.get("definitions") or {}).get("subgraphs", [])}
        self.graph = FlatGraph()
        self.warnings: list[str] = []
        if (template.get("extra") or {}).get("groupNodes"):
            raise ConvertError("the template uses legacy group nodes (extra.groupNodes). Convert them to subgraphs in the UI first.")

    def run(self) -> FlatGraph:
        root = Ctx(self.template["nodes"], self.template.get("links", []), "", [])
        self.process(root)
        return self.graph

    # -- edge resolution -------------------------------------------------------

    def resolve_input(self, ctx: Ctx, node: dict, idx: int):
        entry = node["inputs"][idx]
        link_id = entry.get("link")
        if link_id is None:
            return None
        if link_id not in ctx.links:
            raise ConvertError(f"node {ctx.prefix}{node['id']} ({node['type']}) input '{entry['name']}' points at missing link {link_id}")
        origin_id, origin_slot, _, _ = ctx.links[link_id]
        if origin_id == -10:
            return ctx.boundary_in[origin_slot] if origin_slot < len(ctx.boundary_in) else None
        return self.resolve_output(ctx, origin_id, origin_slot)

    def resolve_output(self, ctx: Ctx, node_id: int, slot: int):
        node = ctx.nodes.get(node_id)
        if node is None:
            raise ConvertError(f"link comes from missing node {ctx.prefix}{node_id}")
        mode = node.get("mode", 0)
        typ = node["type"]
        if mode == 2:
            return None  # muted: the consumer ends up without this input
        if mode == 4:
            entries = [(i["name"], i.get("type"), i.get("link") is not None) for i in node.get("inputs", [])]
            outs = node.get("outputs", [])
            out_type = outs[slot].get("type") if slot < len(outs) else "*"
            pick = pick_bypass_input(entries, slot, out_type)
            return None if pick is None else self.resolve_input(ctx, node, pick)
        if typ == "Reroute":
            return self.resolve_input(ctx, node, 0) if node.get("inputs") else None
        if typ == "PrimitiveNode":
            vals = node.get("widgets_values") or []
            if not vals:
                raise ConvertError(f"PrimitiveNode {ctx.prefix}{node_id} has no value")
            return Const(vals[0])
        if typ in self.defs:
            return self.expand_instance(ctx, node)[slot]
        return Src(f"{ctx.prefix}{node_id}", slot)

    # -- node creation ----------------------------------------------------------

    def process(self, ctx: Ctx) -> None:
        for node in ctx.nodes.values():
            if node.get("mode", 0) in (2, 4) or node["type"] in FRONTEND_ONLY:
                continue
            if node["type"] in self.defs:
                self.expand_instance(ctx, node)
            else:
                self.create(ctx, node)

    def create(self, ctx: Ctx, node: dict) -> None:
        cls = node["type"]
        fid = f"{ctx.prefix}{node['id']}"
        widgets = self.decode_widgets(fid, node)
        links: dict[str, Src] = {}
        for idx, entry in enumerate(node.get("inputs", [])):
            if entry.get("link") is None:
                continue
            src = self.resolve_input(ctx, node, idx)
            if isinstance(src, Const):
                widgets[entry["name"]] = src.value
            elif isinstance(src, Src):
                links[entry["name"]] = src
        in_types = [(i["name"], i.get("type")) for i in node.get("inputs", []) if not i.get("widget")]
        out_types = [o.get("type") for o in node.get("outputs", [])]
        self.graph.nodes[fid] = FNode(fid, cls, node.get("title"), widgets, links, in_types, out_types)

    def decode_widgets(self, fid: str, node: dict) -> dict:
        """widgets_values (a flat list in UI order) -> {input name: value}."""
        cls = node["type"]
        wv = node.get("widgets_values")
        if wv is None:
            wv = []
        if isinstance(wv, dict):
            raise ConvertError(f"node {fid} ({cls}) stores widgets_values as an object, which is not mapped")
        specs = self.oi.widget_specs(cls)
        out: dict = {}

        def consume(items: list, i: int, prefix: str) -> int:
            for sp in items:
                if not sp.is_widget:
                    continue
                name = prefix + sp.name
                if i >= len(wv):
                    if "default" in sp.opts:
                        out[name] = sp.opts["default"]
                    continue
                out[name] = wv[i]
                i += 1
                if sp.dynamic:
                    opt = next((o for o in sp.dyn_options if o["key"] == out[name]), None)
                    if opt is None:
                        raise ConvertError(f"node {fid} ({cls}): '{name}' = {out[name]!r} is not one of {sp.options}")
                    i = consume(parse_inputs(opt.get("inputs") or {}), i, name + ".")
                elif sp.control_after_generate:
                    i += 1  # the "fixed / randomize / increment" widget the UI adds after the value
            return i

        i = consume(specs, 0, "")
        extras = wv[i:]
        if extras:
            has_upload = any(sp.uploads for sp in specs)
            if not (has_upload and len(extras) <= 2 and all(e in UPLOAD_EXTRAS for e in extras)):
                raise ConvertError(
                    f"node {fid} ({cls}): widgets_values has {len(wv)} entries but the server expects "
                    f"{[sp.name for sp in specs]} (extra: {extras!r}). The template and the server version disagree."
                )
        return out

    # -- subgraphs ---------------------------------------------------------------

    def expand_instance(self, ctx: Ctx, inst: dict) -> list:
        key = inst["id"]
        if key in ctx.expanded:
            return ctx.expanded[key]
        sg = self.defs[inst["type"]]
        fid = f"{ctx.prefix}{inst['id']}"
        if (inst.get("properties") or {}).get("proxyWidgets"):
            raise ConvertError(f"subgraph instance {fid} uses proxyWidgets, which the converter does not map")

        sg_nodes = {n["id"]: n for n in sg["nodes"]}
        widget_backed: list[bool] = []
        for i in range(len(sg["inputs"])):
            backed = False
            for lk in sg["links"]:
                o, os_, t, ts = (lk["origin_id"], lk["origin_slot"], lk["target_id"], lk["target_slot"]) if isinstance(lk, dict) else (lk[1], lk[2], lk[3], lk[4])
                if o == -10 and os_ == i and t in sg_nodes:
                    ins = sg_nodes[t].get("inputs", [])
                    if ts < len(ins) and ins[ts].get("widget"):
                        backed = True
            widget_backed.append(backed)

        named = inst.get("widgets_values_named")
        if not isinstance(named, dict):
            names = [si["name"] for si, b in zip(sg["inputs"], widget_backed) if b]
            wv = inst.get("widgets_values") or []
            if len(wv) != len(names):
                raise ConvertError(
                    f"subgraph instance {fid}: {len(wv)} widget values but the subgraph has {len(names)} promoted widgets {names}"
                )
            named = dict(zip(names, wv))

        inputs_in: list = []
        for si in sg["inputs"]:
            name = si["name"]
            idx = next((k for k, e in enumerate(inst.get("inputs", [])) if e["name"] == name), None)
            if idx is not None and inst["inputs"][idx].get("link") is not None:
                inputs_in.append(self.resolve_input(ctx, inst, idx))
            elif name in named:
                inputs_in.append(Const(named[name]))
            else:
                inputs_in.append(None)

        sub = Ctx(sg["nodes"], sg["links"], f"{fid}:", inputs_in)
        self.process(sub)

        outs: list = [None] * len(sg["outputs"])
        for lk in sg["links"]:
            o, os_, t, ts = (lk["origin_id"], lk["origin_slot"], lk["target_id"], lk["target_slot"]) if isinstance(lk, dict) else (lk[1], lk[2], lk[3], lk[4])
            if t == -20 and ts < len(outs):
                outs[ts] = self.resolve_output(sub, o, os_)
        ctx.expanded[key] = outs

        rec = Instance(fid, inst.get("title"), sg.get("name", ""))
        for i, si in enumerate(sg["inputs"]):
            targets: list[tuple[str, str]] = []
            for lk in sg["links"]:
                o, os_, t, ts = (lk["origin_id"], lk["origin_slot"], lk["target_id"], lk["target_slot"]) if isinstance(lk, dict) else (lk[1], lk[2], lk[3], lk[4])
                if o != -10 or os_ != i or t not in sg_nodes:
                    continue
                tn = sg_nodes[t]
                ins = tn.get("inputs", [])
                if ts >= len(ins):
                    continue
                tfid = f"{fid}:{t}"
                if tn["type"] in self.defs:
                    nested = self.graph.instances.get(tfid)
                    if nested:
                        targets.extend(nested.inputs.get(ins[ts]["name"], []))
                elif tfid in self.graph.nodes:
                    targets.append((tfid, ins[ts]["name"]))
            rec.inputs[si["name"]] = targets
            if si.get("label"):
                rec.inputs.setdefault(si["label"], targets)
        self.graph.instances[fid] = rec
        return outs


# ----------------------------------------------------------------------------
# Overrides
# ----------------------------------------------------------------------------

GLOBAL_ALIASES = {"seed": ["seed", "noise_seed"]}


def new_seed() -> int:
    return random.randrange(2 ** 53)


def _select(graph: FlatGraph, sel: str, nth: Optional[int]) -> list:
    sel_s = str(sel)
    objs: list = list(graph.nodes.values()) + list(graph.instances.values())

    def title(o):
        return (o.title or (o.sg_name if isinstance(o, Instance) else "") or "")

    def cls(o):
        return o.sg_name if isinstance(o, Instance) else o.cls

    tiers = [
        [o for o in objs if o.fid == sel_s],
        [o for o in objs if title(o).casefold() == sel_s.casefold() and title(o)],
        [o for o in objs if cls(o) == sel_s],
    ]
    found: list = []
    for t in tiers:
        if t:
            found = t
            break
    found.sort(key=lambda o: fid_key(o.fid))
    if nth is not None:
        if nth >= len(found):
            raise ConvertError(f"node selector '{sel}' with nth={nth}: only {len(found)} match(es)")
        found = [found[nth]]
    if not found:
        ids = ", ".join(sorted((o.label() for o in objs), key=lambda s: fid_key(s.split()[0]))[:60])
        raise ConvertError(
            f"no live node matches '{sel}'. Match by id, title or node type. Bypassed and muted template nodes do not exist here. Nodes: {ids}"
        )
    return found


def _set_widget(graph: FlatGraph, oi: ObjectInfo, fid: str, name: str, value: Any, log: list) -> None:
    node = graph.nodes[fid]
    known = {s.name for s in oi.widget_specs(node.cls)} | set(node.widgets)
    if name not in known:
        raise ConvertError(f"{node.label()} has no widget '{name}'. Widgets: {sorted(known)}")
    if name in node.links:
        del node.links[name]
        log.append(f"{node.label()}: input '{name}' was linked, now a constant")
    node.widgets[name] = value


def bypass_node(graph: FlatGraph, fid: str, log: list) -> None:
    node = graph.nodes[fid]
    entries = [(n, t, n in node.links) for n, t in node.in_types]
    repl: dict[int, Optional[Src]] = {}
    for slot, out_type in enumerate(node.out_types):
        pick = pick_bypass_input(entries, slot, out_type)
        repl[slot] = node.links[entries[pick][0]] if pick is not None else None
    used = 0
    for other in graph.nodes.values():
        for in_name, src in list(other.links.items()):
            if src.fid == fid:
                used += 1
                new = repl.get(src.slot)
                if new is None:
                    raise ConvertError(f"cannot bypass {node.label()}: {other.label()} needs its output {src.slot} and no input has that type")
                other.links[in_name] = new
    del graph.nodes[fid]
    log.append(f"{node.label()}: bypassed ({used} link(s) rerouted)")


def apply_overrides(graph: FlatGraph, oi: ObjectInfo, job: dict, upload) -> list:
    """upload(local_path) -> server file name. Returns a list of log lines."""
    log: list[str] = []

    # 1. global widget names
    for key, value in (job.get("set") or {}).items():
        if key in ("prompt", "negative_prompt"):
            continue
        names = GLOBAL_ALIASES.get(key, [key])
        hits = [n for n in graph.nodes.values() if any(nm in n.widgets or oi.spec(n.cls, nm) for nm in names)]
        hits = [n for n in hits if any((nm in n.widgets) or (oi.spec(n.cls, nm) and oi.spec(n.cls, nm).is_widget) for nm in names)]
        if not hits:
            raise ConvertError(f"set.{key}: no node has a widget called {names}")
        if value == "random":
            value = new_seed()
        for n in hits:
            for nm in names:
                if nm in n.widgets or (oi.spec(n.cls, nm) and oi.spec(n.cls, nm).is_widget):
                    _set_widget(graph, oi, n.fid, nm, value, log)
                    log.append(f"set {key}={str(value)[:40]} on {n.label()}")

    # 2. prompt shortcuts
    for key, want in (("prompt", "positive"), ("negative_prompt", "negative")):
        text = (job.get("set") or {}).get(key)
        if text is None:
            continue
        hits = [n for n in graph.nodes.values() if n.cls.startswith("MiniMaxH3") and "prompt" in n.widgets] if want == "positive" else []
        if not hits:
            hits = [n for n in graph.nodes.values() if n.cls == "CLIPTextEncode" and want in (n.title or "").casefold()]
        if not hits:
            raise ConvertError(
                f"set.{key}: no prompt node found. Use the 'nodes' list and name the node (run with --list-nodes to see them)."
            )
        for n in hits:
            _set_widget(graph, oi, n.fid, "prompt" if n.cls.startswith("MiniMaxH3") else "text", text, log)
            log.append(f"set {key} on {n.label()}")

    # 3. per node entries
    for entry in job.get("nodes") or []:
        if "node" not in entry:
            raise ConvertError(f"a 'nodes' entry needs a 'node' selector: {entry}")
        targets = _select(graph, entry["node"], entry.get("nth"))
        values = dict(entry.get("values") or {})
        if "widget" in entry and "value" in entry:
            values[entry["widget"]] = entry["value"]
        file_value = None
        if "file" in entry:
            file_value = upload(entry["file"])
        for t in targets:
            if isinstance(t, Instance):
                for k, v in values.items():
                    if k not in t.inputs or not t.inputs[k]:
                        raise ConvertError(f"{t.label()} has no promoted widget '{k}'. Names: {sorted(k2 for k2, v2 in t.inputs.items() if v2)}")
                    for tfid, tname in t.inputs[k]:
                        _set_widget(graph, oi, tfid, tname, new_seed() if v == "random" else v, log)
                    log.append(f"{t.label()}: {k}={str(v)[:40]}")
                if file_value is not None or entry.get("bypass") or entry.get("mute"):
                    raise ConvertError(f"{t.label()}: 'file', 'bypass' and 'mute' apply to plain nodes, not to a subgraph instance")
                continue
            for k, v in values.items():
                _set_widget(graph, oi, t.fid, k, new_seed() if v == "random" else v, log)
                log.append(f"{t.label()}: {k}={str(v)[:40]}")
            if file_value is not None:
                wname = entry.get("widget") or {"LoadImage": "image", "LoadAudio": "audio", "LoadVideo": "file"}.get(t.cls)
                if not wname:
                    raise ConvertError(f"{t.label()}: say which widget gets the file with 'widget'")
                _set_widget(graph, oi, t.fid, wname, file_value, log)
                graph.trusted.add((t.fid, wname))
                log.append(f"{t.label()}: {wname}={file_value}")
            if entry.get("bypass") and entry.get("mute"):
                raise ConvertError(f"{t.label()}: cannot both bypass and mute")
            if entry.get("mute"):
                _mute(graph, t.fid, log)
            elif entry.get("bypass"):
                bypass_node(graph, t.fid, log)
    return log


def _mute(graph: FlatGraph, fid: str, log: list) -> None:
    node = graph.nodes[fid]
    for other in graph.nodes.values():
        for in_name, src in list(other.links.items()):
            if src.fid == fid:
                del other.links[in_name]
    del graph.nodes[fid]
    log.append(f"{node.label()}: muted")


# ----------------------------------------------------------------------------
# API assembly and validation
# ----------------------------------------------------------------------------


def to_api(graph: FlatGraph, oi: ObjectInfo) -> dict:
    outputs = [f for f, n in graph.nodes.items() if oi.is_output_node(n.cls)]
    if not outputs:
        raise ConvertError("the workflow has no output node (SaveVideo, SaveImage, ...) that is live")
    keep: set[str] = set()
    stack = list(outputs)
    while stack:
        f = stack.pop()
        if f in keep:
            continue
        if f not in graph.nodes:
            raise ConvertError(f"a link points at node {f}, which does not exist (muted, or bypassed with no matching input)")
        keep.add(f)
        stack.extend(s.fid for s in graph.nodes[f].links.values())
    api: dict[str, dict] = {}
    for f in sorted(keep, key=fid_key):
        n = graph.nodes[f]
        inputs: dict[str, Any] = {k: v for k, v in n.widgets.items() if k not in n.links}
        for k, s in n.links.items():
            inputs[k] = [s.fid, s.slot]
        api[f] = {"class_type": n.cls, "inputs": inputs, "_meta": {"title": n.title or n.cls}}
    return api


def validate_api(api: dict, oi: ObjectInfo, trusted: set = frozenset(), check_files: bool = True) -> list[str]:
    """Roughly what the server's validate_prompt checks. Returns a list of problems."""
    problems: list[str] = []

    def where(fid):
        return f"node {fid} ({api[fid]['class_type']}, '{api[fid]['_meta']['title']}')"

    for fid, node in api.items():
        cls = node["class_type"]
        if not oi.has(cls):
            problems.append(f"{where(fid)}: unknown node type")
            continue
        specs = {s.name: s for s in oi.inputs(cls)}
        for s in specs.values():
            if s.required and s.name not in node["inputs"]:
                grown = "AUTOGROW" in str(s.type).upper() and any(k.startswith(s.name + ".") for k in node["inputs"])
                if not grown:
                    problems.append(f"{where(fid)}: required input '{s.name}' is missing")
        for name, val in node["inputs"].items():
            s = specs.get(name)
            if isinstance(val, list):
                src_id, slot = val
                if src_id not in api:
                    problems.append(f"{where(fid)}: input '{name}' links to missing node {src_id}")
                    continue
                src_cls = api[src_id]["class_type"]
                outs = oi.output_types(src_cls) if oi.has(src_cls) else []
                if slot >= len(outs):
                    problems.append(f"{where(fid)}: input '{name}' links to output {slot} of {src_cls}, which has {len(outs)}")
                elif s is not None:
                    a, b = str(outs[slot]), str(s.type)
                    if not (a == b or "*" in (a, b) or "COMFY_" in a or "COMFY_" in b or set(a.split(",")) & set(b.split(","))):
                        problems.append(f"{where(fid)}: input '{name}' wants {b} but {src_cls} output {slot} is {a}")
                continue
            if s is None:
                if "." in name:
                    continue  # dynamic (autogrow) input name such as values.a
                problems.append(f"{where(fid)}: unknown input '{name}'")
                continue
            if s.dynamic:
                if val not in (s.options or []):
                    problems.append(f"{where(fid)}: '{name}' = {val!r} is not one of {s.options}")
            elif s.type == "COMBO":
                if check_files and (fid, name) not in trusted and not s.uploads:
                    opts = s.options or []
                    if val not in opts:
                        shown = ", ".join(map(str, opts[:12])) or "(none, the server has no files there)"
                        problems.append(f"{where(fid)}: '{name}' = {val!r} is not available on the server. Options: {shown}")
            elif s.type == "INT":
                if isinstance(val, bool) or not isinstance(val, int):
                    problems.append(f"{where(fid)}: '{name}' = {val!r} is not an integer")
                else:
                    problems += _range(where(fid), name, val, s)
            elif s.type == "FLOAT":
                if isinstance(val, bool) or not isinstance(val, (int, float)):
                    problems.append(f"{where(fid)}: '{name}' = {val!r} is not a number")
                else:
                    problems += _range(where(fid), name, val, s)
            elif s.type == "BOOLEAN":
                if not isinstance(val, bool):
                    problems.append(f"{where(fid)}: '{name}' = {val!r} is not true or false")
            elif s.type == "STRING":
                if not isinstance(val, str):
                    problems.append(f"{where(fid)}: '{name}' = {val!r} is not text")
    return problems


def _range(where: str, name: str, val, s: InputSpec) -> list[str]:
    out = []
    lo, hi = s.opts.get("min"), s.opts.get("max")
    if isinstance(lo, (int, float)) and val < lo:
        out.append(f"{where}: '{name}' = {val} is below the minimum {lo}")
    if isinstance(hi, (int, float)) and val > hi:
        out.append(f"{where}: '{name}' = {val} is above the maximum {hi}")
    return out


def convert(template: dict, oi: ObjectInfo, job: Optional[dict] = None, upload=None):
    """template (UI format) + job overrides -> (api dict, FlatGraph, log lines, warnings)."""
    fl = Flattener(template, oi)
    graph = fl.run()
    log = apply_overrides(graph, oi, job or {}, upload or (lambda p: Path(p).name))
    api = to_api(graph, oi)
    return api, graph, log, fl.warnings


# ----------------------------------------------------------------------------
# Server
# ----------------------------------------------------------------------------


class Server:
    def __init__(self, base: str):
        import requests
        self.requests = requests
        self.base = base.rstrip("/")
        self.client_id = uuid.uuid4().hex

    def get(self, path: str, **kw):
        r = self.requests.get(self.base + path, timeout=kw.pop("timeout", 60), **kw)
        r.raise_for_status()
        return r

    def object_info(self) -> dict:
        return self.get("/object_info", timeout=120).json()

    def upload(self, path: Path) -> str:
        data = path.read_bytes()
        digest = hashlib.sha1(data).hexdigest()[:8]
        name = f"{path.stem}-{digest}{path.suffix}"
        mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
        r = self.requests.post(
            self.base + "/upload/image",
            files={"image": (name, data, mime)},
            data={"type": "input", "overwrite": "true"},
            timeout=600,
        )
        if r.status_code != 200:
            raise RuntimeError(f"upload of {path} failed: HTTP {r.status_code} {r.text[:300]}")
        j = r.json()
        return f"{j['subfolder']}/{j['name']}" if j.get("subfolder") else j["name"]

    def queue(self, api: dict) -> str:
        r = self.requests.post(self.base + "/prompt", json={"prompt": api, "client_id": self.client_id}, timeout=120)
        if r.status_code != 200:
            raise RuntimeError(format_prompt_error(r, api))
        return r.json()["prompt_id"]

    def history(self, pid: str) -> Optional[dict]:
        r = self.get(f"/history/{pid}")
        return r.json().get(pid)

    def interrupt(self) -> None:
        try:
            self.requests.post(self.base + "/interrupt", timeout=10)
        except Exception:
            pass

    def wait(self, pid: str, api: dict, timeout: float) -> dict:
        """Wait on /ws, confirm through /history. Returns the history entry."""
        ws = None
        try:
            import websocket
            url = self.base.replace("http://", "ws://").replace("https://", "wss://") + f"/ws?clientId={self.client_id}"
            ws = websocket.create_connection(url, timeout=5)
        except Exception as e:  # polling is enough
            print(f"[run] websocket not available ({e}), polling /history", flush=True)
        t0 = time.time()
        last_print = 0.0
        last_node = None
        while True:
            if time.time() - t0 > timeout:
                self.interrupt()
                raise TimeoutError(f"job did not finish within {timeout:.0f}s")
            done = False
            if ws is not None:
                try:
                    msg = ws.recv()
                except Exception as e:
                    if e.__class__.__name__ == "WebSocketTimeoutException":
                        msg = None
                    else:
                        print(f"[run] websocket dropped ({e.__class__.__name__}), polling /history", flush=True)
                        ws = None
                        msg = None
                if isinstance(msg, str):
                    m = json.loads(msg)
                    d = m.get("data", {})
                    if d.get("prompt_id") not in (None, pid):
                        continue
                    if m["type"] == "executing":
                        if d.get("node") is None:
                            done = True
                        elif d["node"] != last_node:
                            last_node = d["node"]
                            title = api.get(d["node"].split("/")[0], {}).get("_meta", {}).get("title", "?")
                            print(f"[run] {time.time() - t0:6.0f}s  node {d['node']} {title}", flush=True)
                    elif m["type"] == "progress" and time.time() - last_print > 15:
                        last_print = time.time()
                        print(f"[run] {time.time() - t0:6.0f}s  step {d.get('value')}/{d.get('max')}", flush=True)
                    elif m["type"] == "execution_error":
                        raise RuntimeError(
                            f"execution failed in node {d.get('node_id')} ({d.get('node_type')}): "
                            f"{d.get('exception_type')}: {d.get('exception_message')}\n{''.join(d.get('traceback') or [])[-1500:]}"
                        )
                    elif m["type"] == "execution_interrupted":
                        raise RuntimeError("execution was interrupted")
                    elif m["type"] == "execution_success":
                        done = True
            else:
                time.sleep(3)
            h = self.history(pid)
            if h and h.get("status", {}).get("status_str") == "error":
                raise RuntimeError(f"execution failed: {json.dumps(h['status'].get('messages', [])[-3:])[:1500]}")
            if done or (h and h.get("status", {}).get("completed")):
                if h is None:
                    time.sleep(1)
                    h = self.history(pid)
                if h is not None:
                    if ws is not None:
                        ws.close()
                    return h

    def download(self, item: dict, dest: Path) -> Path:
        params = {"filename": item["filename"], "subfolder": item.get("subfolder", ""), "type": item.get("type", "output")}
        dest.mkdir(parents=True, exist_ok=True)
        out = dest / item["filename"]
        with self.requests.get(self.base + "/view", params=params, stream=True, timeout=600) as r:
            r.raise_for_status()
            with open(out, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
        return out


def format_prompt_error(r, api: dict) -> str:
    try:
        j = r.json()
    except Exception:
        return f"/prompt returned HTTP {r.status_code}: {r.text[:500]}"
    lines = [f"/prompt rejected the workflow (HTTP {r.status_code}): {j.get('error', {}).get('message', '')} {j.get('error', {}).get('details', '')}".strip()]
    for nid, ne in (j.get("node_errors") or {}).items():
        title = api.get(nid, {}).get("_meta", {}).get("title", "")
        for e in ne.get("errors", []):
            lines.append(f"  node {nid} {ne.get('class_type', '')} '{title}': {e.get('message')} {e.get('details', '')}")
    return "\n".join(lines)


def collect_outputs(hist: dict) -> list[dict]:
    items = []
    for node_id, out in (hist.get("outputs") or {}).items():
        for key, val in out.items():
            if isinstance(val, list):
                for it in val:
                    if isinstance(it, dict) and "filename" in it and it.get("type", "output") == "output":
                        items.append(it)
    return items


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------


def load_json(path: Path) -> Any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def find_file(name: str, *bases: Path) -> Path:
    p = Path(name)
    if p.is_absolute() and p.exists():
        return p
    for b in bases:
        if (b / p).exists():
            return (b / p).resolve()
    raise FileNotFoundError(f"{name} (looked in {', '.join(str(b) for b in bases)})")


def list_nodes(graph: FlatGraph, api: dict) -> None:
    print("Subgraph instances (set promoted inputs with 'values'):")
    for inst in sorted(graph.instances.values(), key=lambda i: fid_key(i.fid)):
        print(f"  {inst.label()}")
        for k, t in inst.inputs.items():
            if t:
                print(f"      {k}")
    print("Nodes (set widgets with 'values'; live ones marked *):")
    for fid in sorted(graph.nodes, key=fid_key):
        n = graph.nodes[fid]
        live = "*" if fid in api else " "
        vals = {k: (v if not isinstance(v, str) or len(v) < 40 else v[:37] + "...") for k, v in n.widgets.items() if k not in n.links}
        print(f" {live} {n.label()}  {json.dumps(vals, ensure_ascii=False)[:200]}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Run a ComfyUI workflow template as a headless job.")
    ap.add_argument("job", nargs="?", help="job spec (JSON)")
    ap.add_argument("--server", default=os.environ.get("COMFY_SERVER", "http://127.0.0.1:8188"))
    ap.add_argument("--out", default="comfy-out", help="folder for downloaded outputs (default: ./comfy-out)")
    ap.add_argument("--log", help="timing jsonl (default: <out>/timing.jsonl)")
    ap.add_argument("--dry-run", action="store_true", help="convert and print the API JSON, queue nothing")
    ap.add_argument("--list-nodes", action="store_true", help="print node ids, titles and widgets, then exit")
    ap.add_argument("--object-info", help="read /object_info from this file instead of the server")
    ap.add_argument("--save-object-info", metavar="FILE", help="save the server's /object_info to FILE and exit")
    ap.add_argument("--no-validate", action="store_true", help="skip the local check against /object_info")
    ap.add_argument("--timeout", type=float, default=7200, help="seconds to wait for the job (default 7200)")
    args = ap.parse_args(argv)

    here = Path(__file__).resolve().parent
    srv: Optional[Server] = None

    def server() -> Server:
        nonlocal srv
        if srv is None:
            srv = Server(args.server)
        return srv

    if args.save_object_info:
        Path(args.save_object_info).write_text(json.dumps(server().object_info()), encoding="utf-8")
        print(f"saved {args.save_object_info}")
        return 0
    if not args.job:
        ap.error("a job file is required")

    job_path = Path(args.job).resolve()
    job = load_json(job_path)
    name = job.get("name") or job_path.stem
    tpl_path = find_file(job["template"], job_path.parent, here, Path.cwd())
    template = load_json(tpl_path)

    try:
        oi = ObjectInfo(load_json(Path(args.object_info)) if args.object_info else server().object_info())
    except Exception as e:
        print(f"[run] cannot read /object_info ({e}). Is the tunnel up? Use --object-info FILE to work offline.", file=sys.stderr)
        return 2

    uploads: list[tuple[str, str]] = []

    def upload(p: str) -> str:
        if args.dry_run or args.list_nodes:
            return f"<uploaded:{Path(p).name}>"
        path = find_file(p, job_path.parent, Path.cwd())
        name_on_server = server().upload(path)
        uploads.append((str(path), name_on_server))
        print(f"[run] uploaded {path.name} as {name_on_server}", flush=True)
        return name_on_server

    try:
        api, graph, log, warns = convert(template, oi, job, upload)
        if args.list_nodes:
            list_nodes(graph, api)
            return 0
        problems = [] if args.no_validate else validate_api(api, oi, graph.trusted, check_files=not (args.dry_run and args.object_info))
    except ConvertError as e:
        print(f"[run] cannot convert {tpl_path.name}: {e}", file=sys.stderr)
        return 2

    for line in log:
        print(f"[run] {line}", file=sys.stderr if args.dry_run else sys.stdout)
    for w in warns:
        print(f"[run] warning: {w}", file=sys.stderr)
    if problems:
        print(f"[run] the converted workflow has {len(problems)} problem(s):", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 2

    if args.dry_run:
        print(json.dumps(api, indent=2, ensure_ascii=False))
        print(f"[run] dry run ok: {len(api)} nodes", file=sys.stderr)
        return 0

    s = server()
    out_dir = Path(args.out) / name
    started = datetime.now(timezone.utc)
    t0 = time.time()
    pid = s.queue(api)
    print(f"[run] queued {name} as {pid} ({len(api)} nodes)", flush=True)
    try:
        hist = s.wait(pid, api, args.timeout)
    except KeyboardInterrupt:
        print("[run] interrupted, telling the server to stop", file=sys.stderr)
        s.interrupt()
        return 130
    seconds = time.time() - t0
    files = [str(s.download(it, out_dir)) for it in collect_outputs(hist)]
    msgs = {m[0]: m[1] for m in (hist.get("status", {}).get("messages") or []) if isinstance(m, list) and len(m) == 2}
    exec_s = None
    if "execution_start" in msgs and "execution_success" in msgs:
        exec_s = round((msgs["execution_success"]["timestamp"] - msgs["execution_start"]["timestamp"]) / 1000, 1)
    line = {
        "job": name, "template": tpl_path.name, "started": started.isoformat(timespec="seconds"),
        "seconds": round(seconds, 1), "execution_seconds": exec_s, "prompt_id": pid,
        "outputs": files, "server": args.server,
    }
    log_path = Path(args.log) if args.log else Path(args.out) / "timing.jsonl"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(line, ensure_ascii=False) + "\n")
    print(f"[run] done in {seconds:.0f}s, {len(files)} file(s):")
    for f_ in files:
        print(f"  {f_}")
    return 0 if files else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"[run] {e}", file=sys.stderr)
        sys.exit(1)
