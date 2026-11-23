"""Axon 文档站宿主。

同一个 VitePress 站点有两种形态:

- 普通浏览器打开 ``npm run docs:dev`` (或 ``docs:preview``) 的地址 -> 纯说明书;
- 用 ``python docs/main.py`` 在 AxonGUI 里打开 -> 页面上的按钮真的调后端, 并把消息流显示出来。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Windows 控制台默认 cp1252, 打印中文/勾号会 UnicodeEncodeError; 统一成 utf-8 兜底。
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent
WEB_NAME = "AxonDocs"
DEV_URL = "http://127.0.0.1:5174/"
BUILT_DIST = BASE_DIR / "web" / ".vitepress" / "dist"


def resource_dir() -> Path:
    """打包成客户端(exe/app)后, 构建产物被塞进 PyInstaller 的临时解包目录。"""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return BASE_DIR


def icon_path() -> Path | None:
    """窗口/任务栏图标。打包后由 PyInstaller 塞进 web_dist 同级; 开发时读仓库 assets/。"""
    if getattr(sys, "frozen", False):
        candidate = resource_dir() / "icon-256.png"
    else:
        candidate = BASE_DIR.parent / "assets" / "icon-256.png"
    return candidate if candidate.is_file() else None


def default_dist() -> Path:
    if getattr(sys, "frozen", False):
        return resource_dir() / "web_dist"
    return BUILT_DIST


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
        default=None,
        help="构建产物目录 (默认 docs/web/.vitepress/dist; 打包后为内置 web_dist)",
    )
    parser.add_argument("--port", type=int, default=0, help="静态服务端口, 0 表示随机")
    parser.add_argument(
        "--debugger-port",
        type=int,
        default=None,
        help="打开 QtWebEngine 远程调试端口 (只监听 127.0.0.1)",
    )
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="无头自检: 加载页面、点一个示例、确认消息流有内容后退出(0=通过)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.debugger_port:
        os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = f"127.0.0.1:{args.debugger_port}"

    if args.smoke:
        os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
        os.environ.setdefault(
            "QTWEBENGINE_CHROMIUM_FLAGS", "--no-sandbox --disable-gpu --disable-dev-shm-usage"
        )

    if args.dev:
        url = DEV_URL
    else:
        dist = (args.dist or default_dist()).resolve()
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
    icon = icon_path()
    if icon is not None:
        from PySide6.QtGui import QIcon

        app.setWindowIcon(QIcon(str(icon)))
    AxonMagicGUI()

    view = AxonGUI(WEB_NAME, url)
    view.setWindowTitle("Axon 文档 · 可交互示例")
    view.resize(1280, 840)
    view.show()

    print(f"[docs] AxonGUI 已打开 {url} (web_name={WEB_NAME})")
    if args.smoke:
        return run_smoke(app, view)
    return app.exec()


PROBE_JS = """
(() => {
  const card = document.querySelector('.try-it');
  const btn = card && card.querySelector('.try-it__run');
  const summary = card && card.querySelector('.live-demo__summary-out');
  return JSON.stringify({
    connected: Boolean(window.__axonDocs && window.__axonDocs.connected),
    hasCard: Boolean(card),
    hasButton: Boolean(btn),
    disabled: btn ? btn.disabled : null,
    flow: card ? card.querySelectorAll('.entry').length : 0,
    summary: summary ? summary.textContent.trim() : ''
  });
})()
"""

CLICK_JS = """
(() => {
  const btn = document.querySelector('.try-it__run');
  if (!btn || btn.disabled) return 'skip';
  btn.click();
  return 'clicked';
})()
"""


def run_smoke(app, view) -> int:
    """打包产物自检: 通道连通 -> 点第一张示例卡 -> 消息流有内容 -> 0。"""
    from PySide6.QtCore import QTimer

    deadline_ms = 90_000
    elapsed = {"ms": 0}
    latest = {}

    def finish(code: int, reason: str) -> None:
        print(f"[smoke] {reason}")
        print(f"[smoke] {'PASS' if code == 0 else 'FAIL'}")
        app.exit(code)

    def probe() -> None:
        def on_result(raw) -> None:
            try:
                latest.update(json.loads(raw))
            except (TypeError, ValueError):
                pass
            step()

        view.page().runJavaScript(PROBE_JS, on_result)

    def step() -> None:
        elapsed["ms"] += 500
        if elapsed["ms"] > deadline_ms:
            finish(1, f"超时: {latest}")
            return
        if not latest.get("connected"):
            QTimer.singleShot(500, probe)
            return
        if not latest.get("hasCard") or not latest.get("hasButton"):
            finish(1, f"页面结构不对: {latest}")
            return
        if latest.get("flow", 0) == 0:
            view.page().runJavaScript(CLICK_JS)
            QTimer.singleShot(1500, probe)
            return
        ok = bool(latest.get("summary"))
        finish(0 if ok else 1, f"connected={latest['connected']} flow={latest['flow']} summary={latest.get('summary', '')!r}")

    QTimer.singleShot(1500, probe)
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
