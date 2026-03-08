import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path

from axon import (
    AxonGUI,
    AxonMagicGUI,
)
from PySide6.QtWidgets import QApplication

# 手动导入 Controller (确保装饰器执行)
import controller  # noqa: F401


def start_server(directory: str, port: int):
    abs_dir = str(Path(directory).resolve())
    socketserver.TCPServer.allow_reuse_address = True

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=abs_dir, **kwargs)

    httpd = socketserver.TCPServer(("", port), Handler)

    def serve():
        with httpd:
            print(
                f"[axon] Server started at {httpd.server_address} (from path: {abs_dir})"
            )
            httpd.serve_forever()

    threading.Thread(target=serve, daemon=True).start()
    return httpd


os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = "23333"
WEB_ENV = os.environ.get("WEB_ENV", "pro")
if WEB_ENV == "dev":
    url = "http://127.0.0.1:5173"
else:
    base_path = getattr(sys, "_MEIPASS", Path.cwd())
    dist_dir = f"{base_path}/web/web-vue/dist"
    httpd = start_server(dist_dir, 0)
    ip, port, *_ = httpd.server_address
    url = f"http://{ip}:{port}"


if __name__ == "__main__":
    app = QApplication(sys.argv)

    magic_gui = AxonMagicGUI()

    view = AxonGUI("TestView", url)
    view.setWindowTitle("Template For Axon")
    view.resize(1200, 742)
    view.show()

    exit_code = app.exec()
    print("[axon] Application exiting...")
    sys.exit(exit_code)
