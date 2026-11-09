import http.server, sys, functools, gzip, io, os, mimetypes
mode = sys.argv[2] if len(sys.argv) > 2 else 'self'
WORKER = {'self': "'self'", 'blob': 'blob:', 'none': "'none'"}[mode]
CSP = ("default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' blob: data:; worker-src " + WORKER + ";")
TEXT = ('.js', '.css', '.json', '.html', '.svg', '.txt', '.md', '.wasm')
class H(http.server.SimpleHTTPRequestHandler):
    """the test server: the app's CSP, no caching, and gzip for text like a real host (so timings mean something)"""
    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP); self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isfile(path) and path.endswith(TEXT) and 'gzip' in self.headers.get('Accept-Encoding', ''):
            with open(path, 'rb') as f: body = gzip.compress(f.read(), 6)
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(path)[0] or 'application/octet-stream')
            self.send_header('Content-Encoding', 'gzip'); self.send_header('Content-Length', str(len(body))); self.end_headers()
            return io.BytesIO(body)
        return super().send_head()
port = int(sys.argv[1])
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory='trip')).serve_forever()
