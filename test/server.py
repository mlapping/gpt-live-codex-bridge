"""Local test server: serves the repo and mimics Hermes' /api/audio/voice-live/session route.

Run from the repository root:  python3 test/server.py   then open http://127.0.0.1:18650/test/page.html
"""
import json, pathlib, urllib.request, urllib.error
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
TOKEN = pathlib.Path("~/.config/gpt-live-codex-bridge/token").expanduser().read_text().strip()
ROOT = pathlib.Path(__file__).resolve().parent.parent
class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript"}
    def log_message(self, *a): pass
    def do_POST(self):
        # Mirrors Hermes' /api/audio/voice-live/session -> tools.voice_live.create_webrtc_session
        p = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        body = json.dumps({"session": {"model": "gpt-live-1", "instructions": "You are Hermes, a calm and friendly voice assistant. Keep replies short. Hand off any request that needs information or action.",
                "audio": {"output": {"voice": "marin"}}, "delegation": {"type": "client"}},
                "transport": {"type": "webrtc", "sdp": p["sdp"]}}).encode()
        req = urllib.request.Request("http://127.0.0.1:18642/v1/live/sessions", data=body, method="POST",
                headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
        try: out = {"ok": True, **json.loads(urllib.request.urlopen(req, timeout=45).read())}
        except urllib.error.HTTPError as e: out = {"ok": False, "status": e.code, "detail": e.read().decode()[:300]}
        b = json.dumps(out).encode(); self.send_response(200); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
ThreadingHTTPServer(("127.0.0.1", 18650), H).serve_forever()
