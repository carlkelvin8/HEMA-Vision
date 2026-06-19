#!/usr/bin/env python3
"""Simple HTTP server for the WebAR Bloodstain Analysis app."""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DIR = os.path.dirname(os.path.abspath(__file__))

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)
    def log_message(self, format, *args):
        pass

print(f"\n  🩸 HEMA-Vision — Bloodstain Analysis AR")
print(f"  ───────────────────────────────────────")print(f"  Server: http://localhost:{PORT}")
print(f"  Open on mobile: http://YOUR_IP:{PORT}")
print(f"  Press Ctrl+C to stop\n")

http.server.HTTPServer(("", PORT), QuietHandler).serve_forever()
