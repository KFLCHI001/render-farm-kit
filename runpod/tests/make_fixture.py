#!/usr/bin/env python3
"""Build tests/object_info.fixture.json from a ComfyUI /object_info snapshot.

The fixture keeps only the node types the templates use, so it stays small. The
snapshot should come from a ComfyUI whose models folders hold files with the names
setup-pod.sh downloads (empty placeholder files are enough), so the model name
checks in the tests see what a prepared pod would offer.

    python comfy_run.py --save-object-info /tmp/oi.json        # against any running ComfyUI
    python tests/make_fixture.py /tmp/oi.json
"""
import json
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
templates = here.parent / "templates"


def types_in(graph):
    for n in graph["nodes"]:
        yield n["type"]


def main(snapshot: str) -> None:
    oi = json.loads(Path(snapshot).read_text(encoding="utf-8"))
    used = set()
    for tpl in sorted(templates.glob("*.json")) + [here / "smoke_template.json"]:
        d = json.loads(tpl.read_text(encoding="utf-8"))
        used.update(types_in(d))
        for sg in (d.get("definitions") or {}).get("subgraphs", []):
            used.update(types_in(sg))
    sg_ids = set()
    for tpl in templates.glob("*.json"):
        d = json.loads(tpl.read_text(encoding="utf-8"))
        sg_ids.update(s["id"] for s in (d.get("definitions") or {}).get("subgraphs", []))
    used -= sg_ids
    used -= {"Note", "MarkdownNote", "Reroute", "PrimitiveNode"}
    missing = sorted(t for t in used if t not in oi)
    if missing:
        sys.exit(f"the snapshot lacks node types used by the templates: {missing}")
    keep = {t: oi[t] for t in sorted(used)}
    (here / "object_info.fixture.json").write_text(json.dumps(keep, indent=1, sort_keys=True), encoding="utf-8")
    print(f"wrote {len(keep)} node types")


if __name__ == "__main__":
    main(sys.argv[1])
