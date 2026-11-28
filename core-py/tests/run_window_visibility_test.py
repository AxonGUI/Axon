#!/usr/bin/env python
"""窗口可见性验证：确认窗口**真的出现在屏幕上**，而不是只存在于 Python 里。

    core-py/.venv/bin/python core-py/tests/run_window_visibility_test.py

为什么单独一个文件：`run_web_tests.py` 默认 offscreen，窗口从不 show()，
历史上就是在这里吃过亏——页面照跑、断言全绿，真机打开却什么都没有。
`isVisible()` 也不够：它只说明 Qt 认为窗口该显示，不说明窗口管理器/compositor
真的把它放上了屏幕。所以这里等的是 `QWindow.isExposed()`（合成器已经给出
可绘制表面），并用 `screen()` / `devicePixelRatio` 记下它落在哪块屏上。

需要在有真实窗口会话的环境里跑（macOS 的 GitHub runner 有），offscreen 下
`isExposed()` 永远是 False，脚本会如实报 FAIL 而不是假绿。
"""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import sys
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]

# 这里故意不 setdefault offscreen：没窗口会话就该失败，而不是悄悄换成无头平台。
# 沙箱与 GPU 相关的开关跟平台无关，照常给默认值（容器/CI 里 root 跑必须关沙箱）。
os.environ.setdefault("QTWEBENGINE_DISABLE_SANDBOX", "1")
os.environ.setdefault(
    "QTWEBENGINE_CHROMIUM_FLAGS",
    "--no-sandbox --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer",
)

sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "core-py"))

from PySide6.QtWidgets import QApplication  # noqa: E402

from axon import AxonGUI, AxonMagicGUI  # noqa: E402

WEB_DIR = HERE / "web"
RESULTS: list[tuple[str, bool, str]] = []


def start_server(directory: Path):
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler, directory=str(directory)
    )
    handler.log_message = lambda *a, **k: None  # type: ignore[method-assign]
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main() -> int:
    httpd = start_server(WEB_DIR)
    port = httpd.server_address[1]
    app = QApplication(sys.argv)
    AxonMagicGUI()

    platform = app.platformName()
    view = AxonGUI("visibility", f"http://127.0.0.1:{port}/index.html")
    view.resize(1100, 720)
    view.show()

    def record(name: str, ok: bool, detail: object = "") -> None:
        RESULTS.append((name, bool(ok), str(detail)))
        print(f"[{'PASS' if ok else 'FAIL'}] {name:<34} {detail}")
        sys.stdout.flush()

    def wait(predicate, timeout: float) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            if predicate():
                return True
            app.processEvents()
            time.sleep(0.02)
        return False

    record("platform/not_offscreen", platform != "offscreen", platform)

    visible = wait(lambda: view.isVisible(), 10)
    record("window/isVisible", visible, view.isVisible())

    # 注意：别在 lambda 里用海象运算符抓 handle —— 那是 lambda 的局部变量，
    # 外面的 handle 永远是 None（第一版就是这么写错的，detail 全是空串）。
    seen: dict[str, object] = {"handle": None}

    def exposed_now() -> bool:
        handle = view.windowHandle()
        if handle is not None and handle.isExposed():
            seen["handle"] = handle
            return True
        return False

    exposed = wait(exposed_now, 15)
    handle = seen["handle"]
    record("window/isExposed", exposed, "" if handle is None else handle.isExposed())

    size_ok = False
    screen_info = ""
    if handle is not None:
        sz = handle.size()
        screen = handle.screen()
        dpr = screen.devicePixelRatio() if screen is not None else 0
        screen_info = f"{sz.width()}x{sz.height()} dpr={dpr}"
        size_ok = sz.width() > 0 and sz.height() > 0 and screen is not None
    record("window/real_size_and_screen", size_ok, screen_info)

    js_ready = wait(lambda: bool(getattr(view, "_js_ready", False)), 30)
    record("page/js_ready", js_ready, getattr(view, "_js_ready", None))

    # 页面在可见窗口里跑完一轮 Python 调用，才算「真的能用」。
    echoed = None
    if js_ready:
        box: list = []
        view.page().runJavaScript(
            "window.__axon_visibility_ok = true; JSON.stringify({ok: true})",
            0,
            box.append,
        )
        wait(lambda: bool(box), 10)
        echoed = box[0] if box else None
    record("page/js_roundtrip", bool(echoed), echoed)

    view.close()
    app.processEvents()
    httpd.shutdown()

    failed = [r for r in RESULTS if not r[1]]
    print("=" * 60)
    print(f"共 {len(RESULTS)} 条, 失败 {len(failed)} 条")
    for name, _, detail in failed:
        print(f"  ✗ {name}: {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
