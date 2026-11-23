"""模板应用入口：起一个本地静态服务，把 web/web-vue/dist 塞进 AxonGUI。

    python main.py            # 用 web/web-vue/dist
    WEB_ENV=dev python main.py  # 用 Vite 开发服务器 (127.0.0.1:5173)
"""

from __future__ import annotations

import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path

from PySide6.QtWidgets import QApplication

from axon import AxonGUI, AxonMagicGUI

import controller  # noqa: F401  确保装饰器执行, 把 Controller 注册进来

BASE_DIR = Path(__file__).resolve().parent
WEB_NAME = "TemplateView"
# 窗口/任务栏图标; 换成自己的就替换这个文件（或改这一行）
ICON_FILE = BASE_DIR / "assets" / "icon-256.png"
DEV_URL = "http://127.0.0.1:5173/"


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        sys.stderr.write("[axon] %s\n" % (fmt % args))


def start_server(directory: Path, port: int = 0, host: str = "127.0.0.1"):
    handler = __import__("functools").partial(_QuietHandler, directory=str(directory))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer((host, port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def build_url() -> str:
    if os.environ.get("WEB_ENV") == "dev":
        return DEV_URL
    dist_dir = BASE_DIR / "web" / "web-vue" / "dist"
    if not (dist_dir / "index.html").is_file():
        print(f"[axon] 找不到前端构建产物: {dist_dir}", file=sys.stderr)
        print("[axon] 先执行: cd web/web-vue && npm install && npm run build", file=sys.stderr)
        raise SystemExit(1)
    httpd = start_server(dist_dir)
    return f"http://127.0.0.1:{httpd.server_address[1]}/"


def main() -> int:
    # 想调试前端就设 AXON_DEBUGGER_PORT=9222, 默认不开（QtWebEngine 只监听 127.0.0.1）
    if port := os.environ.get("AXON_DEBUGGER_PORT"):
        os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = f"127.0.0.1:{port}"

    url = build_url()

    app = QApplication(sys.argv[:1])
    if ICON_FILE.is_file():
        from PySide6.QtGui import QIcon

        app.setWindowIcon(QIcon(str(ICON_FILE)))
    AxonMagicGUI()

    view = AxonGUI(WEB_NAME, url)
    view.setWindowTitle("Axon Template")
    # QWebEngineView 会用页面 <title> 覆盖窗口标题, 加载完成后钉回来
    view.loadFinished.connect(lambda _ok: view.setWindowTitle("Axon Template"))
    view.resize(1200, 742)
    view.show()

    print(f"[axon] 已打开 {url} (web_name={WEB_NAME})")
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
