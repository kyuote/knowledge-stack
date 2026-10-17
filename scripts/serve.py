"""Local static server with HTTP Range support, so <video> can seek.

python -m http.server ignores Range headers: the browser can't seek
inside the JVM video. GitHub Pages supports Range, this mirrors it locally.

Usage: python3 scripts/serve.py [port] [directory]
"""
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self._range_left = None
        rng = self.headers.get('Range')
        path = self.translate_path(self.path)
        m = re.fullmatch(r'bytes=(\d*)-(\d*)', rng or '')
        if not m or os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()

        size = os.path.getsize(path)
        start, end = m.group(1), m.group(2)
        if start:
            start, end = int(start), int(end) if end else size - 1
        else:  # suffix range: last N bytes
            start, end = max(0, size - int(end)), size - 1
        if start >= size or start > end:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return None
        end = min(end, size - 1)

        f = open(path, 'rb')
        f.seek(start)
        self._range_left = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(self._range_left))
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, '_range_left', None)
        if left is None:
            return super().copyfile(source, outputfile)
        while left > 0:
            chunk = source.read(min(64 * 1024, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
    directory = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
    handler = partial(RangeHandler, directory=directory)
    print(f'Serving {directory} on http://localhost:{port}')
    ThreadingHTTPServer(('', port), handler).serve_forever()
