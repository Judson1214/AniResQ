#!/usr/bin/env python3
import sys
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler

class MockApiHandler(BaseHTTPRequestHandler):
    ready_count = 0

    def log_message(self, format, *args):
        # Silence standard HTTP access logging in tests
        pass

    def do_GET(self):
        mode = getattr(self.server, "mode", "good")

        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return

        if self.path == "/ready":
            MockApiHandler.ready_count += 1
            if MockApiHandler.ready_count > 3:
                self.send_response(429)
                self.send_header("Retry-After", "30")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"detail":"Rate limit reached"}')
            else:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"ready"}')
            return

        if self.path == "/api/lostfound":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(b'[{"id":"lf-1","animalName":"Buddy","contactPhone":"","contactEmail":""}]')
            return

        if self.path == "/api/settings":
            if mode == "bad":
                # Bad mode leaks settings anonymously
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"environment":"Production Leaked"}')
            else:
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"detail":"Unauthorized"}')
            return

        if self.path == "/api/audit":
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"detail":"Unauthorized"}')
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path in ["/api/rescues/", "/api/rescues"]:
            auth = self.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                # If valid test token, return 422 with sanitized schema
                self.send_response(422)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"detail":[{"loc":["body","title"],"msg":"field required","type":"value_error.missing"}]}')
            else:
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"detail":"Not authenticated"}')
            return

        self.send_response(404)
        self.end_headers()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8901)
    parser.add_argument("--mode", choices=["good", "bad"], default="good")
    args = parser.parse_args()

    server = HTTPServer(("127.0.0.1", args.port), MockApiHandler)
    server.mode = args.mode
    print(f"MOCK_SERVER_STARTED on {args.port} mode={args.mode}", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    main()
