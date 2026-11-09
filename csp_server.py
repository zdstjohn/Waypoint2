import http.server, sys, functools
mode = sys.argv[2] if len(sys.argv) > 2 else 'self'
WORKER = {'self': "'self'", 'blob': 'blob:', 'none': "'none'"}[mode]
CSP = ("default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' blob: data:; worker-src " + WORKER + ";")
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP); self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass
port = int(sys.argv[1])
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory='trip')).serve_forever()
