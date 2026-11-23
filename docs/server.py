"""文档站的静态服务（VitePress 用的是 cleanUrls，需要把 /a/b 映射到 a/b.html）。"""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path


class CleanUrlsHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        resolved = super().translate_path(path)
        if not os.path.exists(resolved) and not resolved.endswith(os.sep):
            candidate = resolved + ".html"
            if os.path.isfile(candidate):
                return candidate
        return resolved

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        sys.stderr.write("[docs] %s\n" % (fmt % args))


def start_server(directory: Path | str, port: int = 0, host: str = "127.0.0.1"):
    handler = functools.partial(CleanUrlsHandler, directory=str(directory))
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer((host, port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd
