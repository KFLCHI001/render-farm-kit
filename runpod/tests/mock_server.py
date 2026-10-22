"""A tiny stand-in for ComfyUI's HTTP and websocket API, for testing comfy_run.py without a GPU.

    python tests/mock_server.py            # serves on 127.0.0.1:18188
    python comfy_run.py jobs/smoke.json --server http://127.0.0.1:18188 --object-info tests/object_info.fixture.json

It accepts /upload/image and /prompt (validates nothing), and serves a fixed PNG for every
output through /history and /view two seconds after queuing. There is no /ws, so comfy_run.py
takes its polling path. The websocket path needs a real ComfyUI.
"""
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18188
PNG = (HERE / "smoke.png").read_bytes()
STATE = {"prompts": {}, "uploads": [], "ws_clients": []}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path.startswith("/object_info"):
            return self._json(json.loads((HERE / "object_info.fixture.json").read_text(encoding="utf-8")))
        if self.path.startswith("/history/"):
            pid = self.path.split("/")[2].split("?")[0]
            p = STATE["prompts"].get(pid)
            if not p or time.time() < p["done_at"]:
                return self._json({})
            out = {"images": [{"filename": "mock_00001.png", "subfolder": "", "type": "output"}]}
            return self._json({pid: {"outputs": {"3": out}, "status": {"status_str": "success", "completed": True, "messages": []}}})
        if self.path.startswith("/view"):
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(PNG)))
            self.end_headers()
            return self.wfile.write(PNG)
        self._json({"error": "not found"}, 404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n)
        if self.path == "/upload/image":
            STATE["uploads"].append(len(body))
            name = body.split(b'filename="')[1].split(b'"')[0].decode()
            return self._json({"name": name, "subfolder": "", "type": "input"})
        if self.path == "/prompt":
            j = json.loads(body)
            pid = f"mock-{len(STATE['prompts']) + 1}"
            STATE["prompts"][pid] = {"api": j["prompt"], "done_at": time.time() + 2}
            return self._json({"prompt_id": pid, "number": 1, "node_errors": {}})
        if self.path == "/interrupt":
            return self._json({})
        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    print(f"mock ComfyUI on :{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
