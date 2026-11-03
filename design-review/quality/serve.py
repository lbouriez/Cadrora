"""Local, read-only review server. Never exposes the application checkout."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import mimetypes

ROOT = Path(__file__).resolve().parent


class ReviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        target = (ROOT / unquote(urlsplit(self.path).path).lstrip('/')).resolve()
        if not target.is_relative_to(ROOT) or target.is_symlink():
            self.send_error(403)
            return
        if target.is_dir() and not (target / 'index.html').is_file():
            self.send_error(404)
            return
        super().do_GET()

    def guess_type(self, path):
        if '_home-hero-image_' in path:
            return 'image/webp'
        return mimetypes.guess_type(path)[0] or 'application/octet-stream'

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Robots-Tag', 'noindex, nofollow')
        super().end_headers()


if __name__ == '__main__':
    print('Cadrora review: http://127.0.0.1:4189', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 4189), ReviewHandler).serve_forever()
