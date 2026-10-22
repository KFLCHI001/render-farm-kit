"""Offline tests for the UI-to-API converter in comfy_run.py.

They use tests/object_info.fixture.json, a trimmed /object_info from a ComfyUI that
had placeholder files named like the ones setup-pod.sh downloads. No GPU, no server.

    python -m unittest discover -s runpod/tests -v
"""
import copy
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))

import comfy_run as cr  # noqa: E402

OI = cr.ObjectInfo(json.loads((HERE / "object_info.fixture.json").read_text(encoding="utf-8")))
TEMPLATES = sorted((ROOT / "templates").glob("*.json"))
JOBS = sorted((ROOT / "jobs").glob("*.json"))


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def fake_upload(p: str) -> str:
    return Path(p).name


class Templates(unittest.TestCase):
    def test_every_template_converts_and_validates(self):
        # defaults point at model files a prepared pod may not have, so only the structure is checked
        for tpl in TEMPLATES:
            with self.subTest(template=tpl.name):
                api, graph, _, _ = cr.convert(load(tpl), OI)
                self.assertGreater(len(api), 5)
                self.assertEqual(cr.validate_api(api, OI, check_files=False), [])

    def test_example_jobs_pass_with_the_files_setup_pod_downloads(self):
        for job_path in JOBS:
            with self.subTest(job=job_path.name):
                job = load(job_path)
                api, graph, _, _ = cr.convert(load(ROOT / "jobs" / job["template"]), OI, job, fake_upload)
                self.assertEqual(cr.validate_api(api, OI, graph.trusted, check_files=True), [])

    def test_positional_widget_decoding_agrees_with_named_values(self):
        # nodes saved with widgets_values_named let us check the positional decoder against ground truth
        checked = 0
        for tpl in TEMPLATES:
            d = load(tpl)
            graphs = [d["nodes"]] + [sg["nodes"] for sg in (d.get("definitions") or {}).get("subgraphs", [])]
            defs = {s["id"] for s in (d.get("definitions") or {}).get("subgraphs", [])}
            fl = cr.Flattener(d, OI)
            for nodes in graphs:
                for n in nodes:
                    named = n.get("widgets_values_named")
                    if not isinstance(named, dict) or n["type"] in defs or n["type"] in cr.FRONTEND_ONLY:
                        continue
                    plain = {k: v for k, v in n.items() if k != "widgets_values_named"}
                    got = fl.decode_widgets("t", plain)
                    for k, v in named.items():
                        if k in got:
                            self.assertEqual(got[k], v, f"{tpl.name} node {n['id']} {n['type']}.{k}")
                            checked += 1
        self.assertGreater(checked, 5)


class H3(unittest.TestCase):
    def setUp(self):
        self.tpl = load(ROOT / "templates" / "video_minimax_h3_r2v.json")

    def test_reference_inputs_and_turbo_toggle(self):
        job = load(ROOT / "jobs" / "example.json")
        api, graph, _, _ = cr.convert(self.tpl, OI, job, fake_upload)
        ref = api["136"]
        self.assertEqual(ref["class_type"], "MiniMaxH3ReferenceToVideo")
        self.assertEqual(ref["inputs"]["ref_images.ref_image_0"], ["137", 0])
        self.assertEqual(ref["inputs"]["ref_images.ref_image_1"], ["139", 0])
        self.assertNotIn("ref_images.ref_image_2", ref["inputs"])
        self.assertEqual(api["137"]["inputs"]["image"], "character.png")
        self.assertIs(api["146"]["inputs"]["value"], True)
        self.assertEqual(api["145"]["inputs"]["lora_name"], "minimax_h3_ref2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors")
        self.assertEqual(api["129"]["inputs"]["noise_seed"], 1234)

    def test_lora_bypass_passes_the_model_through(self):
        job = {"nodes": [{"node": "LoraLoaderModelOnly", "bypass": True}]}
        api, graph, _, _ = cr.convert(self.tpl, OI, job, fake_upload)
        self.assertNotIn("145", api)
        self.assertEqual(api["141"]["inputs"]["on_true"], ["127", 0])


class Wan(unittest.TestCase):
    def test_i2v_subgraph_inputs_set_by_label(self):
        tpl = load(ROOT / "templates" / "video_wan2_2_14B_i2v.json")
        job = {"nodes": [{"node": "Image to Video (Wan2.2)", "values": {"prompt": "hello there", "enable_turbo_mode": True}}]}
        api, graph, _, _ = cr.convert(tpl, OI, job, fake_upload)
        positives = [n for n in api.values() if n["class_type"] == "CLIPTextEncode" and n["inputs"]["text"] == "hello there"]
        self.assertEqual(len(positives), 1)
        flags = [n for n in api.values() if n["class_type"] == "PrimitiveBoolean"]
        self.assertTrue(flags and all(n["inputs"]["value"] is True for n in flags))
        self.assertTrue(all(":" in fid for fid in api if api[fid]["class_type"] in ("KSamplerAdvanced", "UNETLoader")))

    def test_s2v_bypassed_extend_chunk_and_lora_bypass(self):
        tpl = load(ROOT / "templates" / "video_wan2_2_14B_s2v.json")
        api, graph, _, _ = cr.convert(tpl, OI, {"nodes": [{"node": "LoraLoaderModelOnly", "bypass": True}]}, fake_upload)
        self.assertEqual(api["54"]["inputs"]["model"], ["37", 0])
        # three Extend subgraphs exist in the template, one of them bypassed: two stay live
        extends = [n for n in api.values() if n["class_type"] == "WanSoundImageToVideoExtend"]
        self.assertEqual(len(extends), 2)
        # the 20-step copy of the workflow is bypassed in the template and must not be sent
        self.assertEqual(sum(1 for n in api.values() if n["class_type"] == "SaveVideo"), 1)


class Synthetic(unittest.TestCase):
    def tpl(self, nodes, links):
        return {"nodes": nodes, "links": links}

    def node(self, nid, typ, inputs=None, outputs=None, mode=0, wv=None, **kw):
        return {"id": nid, "type": typ, "mode": mode, "inputs": inputs or [], "outputs": outputs or [], "widgets_values": wv or [], **kw}

    def test_reroute_and_bypass_chain(self):
        nodes = [
            self.node(1, "UNETLoader", outputs=[{"name": "MODEL", "type": "MODEL", "links": [1]}], wv=["a.safetensors", "default"]),
            self.node(2, "Reroute", inputs=[{"name": "", "type": "*", "link": 1}], outputs=[{"name": "", "type": "MODEL", "links": [2]}]),
            self.node(3, "LoraLoaderModelOnly", inputs=[{"name": "model", "type": "MODEL", "link": 2}], outputs=[{"name": "MODEL", "type": "MODEL", "links": [3]}], mode=4),
            self.node(4, "ModelSamplingSD3", inputs=[{"name": "model", "type": "MODEL", "link": 3}], outputs=[{"name": "MODEL", "type": "MODEL", "links": None}], wv=[3.0]),
        ]
        links = [[1, 1, 0, 2, 0, "MODEL"], [2, 2, 0, 3, 0, "MODEL"], [3, 3, 0, 4, 0, "MODEL"]]
        g = cr.Flattener(self.tpl(nodes, links), OI).run()
        self.assertEqual(g.nodes["4"].links["model"], cr.Src("1", 0))
        self.assertNotIn("3", g.nodes)
        self.assertEqual(g.nodes["4"].widgets["shift"], 3.0)

    def test_primitive_node_becomes_a_constant(self):
        nodes = [
            self.node(1, "PrimitiveNode", outputs=[{"name": "INT", "type": "INT", "links": [1], "widget": {"name": "value"}}], wv=[42, "fixed"]),
            self.node(2, "PrimitiveInt", inputs=[{"name": "value", "type": "INT", "widget": {"name": "value"}, "link": 1}], outputs=[{"name": "INT", "type": "INT", "links": None}], wv=[1, "fixed"]),
        ]
        g = cr.Flattener(self.tpl(nodes, [[1, 1, 0, 2, 0, "INT"]]), OI).run()
        self.assertEqual(g.nodes["2"].widgets["value"], 42)
        self.assertEqual(g.nodes["2"].links, {})

    def test_unknown_node_type_fails_loudly(self):
        nodes = [self.node(1, "SomeCustomNode", wv=[1])]
        with self.assertRaises(cr.ConvertError):
            cr.Flattener(self.tpl(nodes, []), OI).run()

    def test_widget_count_mismatch_fails_loudly(self):
        nodes = [self.node(1, "ModelSamplingSD3", wv=[3.0, 99, 100])]
        with self.assertRaises(cr.ConvertError):
            cr.Flattener(self.tpl(nodes, []), OI).run()

    def test_unknown_selector_and_widget_fail_loudly(self):
        tpl = load(ROOT / "templates" / "video_wan2_2_14B_i2v.json")
        with self.assertRaises(cr.ConvertError):
            cr.convert(tpl, OI, {"nodes": [{"node": "No such node", "values": {"x": 1}}]}, fake_upload)
        with self.assertRaises(cr.ConvertError):
            cr.convert(tpl, OI, {"nodes": [{"node": "Image to Video (Wan2.2)", "values": {"nope": 1}}]}, fake_upload)

    def test_validation_catches_a_missing_model_file(self):
        tpl = load(ROOT / "templates" / "video_minimax_h3_r2v.json")
        api, graph, _, _ = cr.convert(tpl, OI)  # the template names v0.1 / int8 files that setup-pod.sh does not fetch
        problems = cr.validate_api(api, OI, check_files=True)
        self.assertTrue(any("not available on the server" in p for p in problems))


if __name__ == "__main__":
    unittest.main()
