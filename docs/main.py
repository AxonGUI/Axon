"""Axon 文档站宿主。

同一个 VitePress 站点有两种形态:

- 普通浏览器打开 ``npm run docs:dev`` (或 ``docs:preview``) 的地址 -> 纯说明书;
- 用 ``python docs/main.py`` 在 AxonGUI 里打开 -> 页面上的按钮真的调后端, 并把消息流显示出来。
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
WEB_NAME = "AxonDocs"
DEV_URL = "http://127.0.0.1:5174/"

sys.path.insert(0, str(BASE_DIR))
from server import start_server  # noqa: E402


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Axon 文档站（可交互示例）")
    parser.add_argument(
        "--dev", action="store_true", help="加载 VitePress 开发服务器 (127.0.0.1:5174)"
    )
    parser.add_argument(
        "--dist",
        type=Path,
        default=BASE_DIR / "web" / ".vitepress" / "dist",
        help="构建产物目录 (默认 docs/web/.vitepress/dist)",
    )
    parser.add_argument("--port", type=int, default=0, help="静态服务端口, 0 表示随机")
    parser.add_argument(
        "--debugger-port",
        type=int,
        default=None,
        help="打开 QtWebEngine 远程调试端口 (只监听 127.0.0.1)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.debugger_port:
        os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = f"127.0.0.1:{args.debugger_port}"

    if args.dev:
        url = DEV_URL
    else:
        dist = args.dist.resolve()
        if not (dist / "index.html").is_file():
            print(f"找不到构建产物: {dist}", file=sys.stderr)
            print("先执行: cd docs/web && npm install && npm run docs:build", file=sys.stderr)
            return 1
        httpd = start_server(dist, args.port)
        url = f"http://127.0.0.1:{httpd.server_address[1]}/"

    # PySide6 必须在 QApplication 之前导入是没必要的, 但 Axon 的模块级对象要在 app 之后再建更稳
    from PySide6.QtWidgets import QApplication

    import controller  # noqa: F401  确保装饰器执行, 把 DemoController 注册进 WEB_NAME

    from axon import AxonGUI, AxonMagicGUI

    app = QApplication(sys.argv[:1])
    AxonMagicGUI()

    view = AxonGUI(WEB_NAME, url)
    view.setWindowTitle("Axon 文档 · 可交互示例")
    view.resize(1280, 840)
    view.show()

    print(f"[docs] AxonGUI 已打开 {url} (web_name={WEB_NAME})")
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
