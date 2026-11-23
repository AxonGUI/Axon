"""验证「纯文档模式」：用不带 QWebChannel 的 QWebEngineView 打开同一份构建产物。

这就是普通浏览器看到的形态 —— 页面必须是可读的说明书，示例按钮不可点，且明确告诉用户
「没有检测到 Python 后端」。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
from server import start_server  # noqa: E402

PROBE_JS = """(() => {
  const card = document.querySelector('.live-demo');
  const btn = document.querySelector('.live-demo__run');
  const st = window.__axonDocs;
  return JSON.stringify({
    loaded: !!card,
    hooked: !!st,
    connected: st ? st.connected : null,
    status: st ? st.status : null,
    buttonText: btn ? btn.textContent.trim() : null,
    buttonDisabled: btn ? btn.disabled : null,
    codeLine: (document.querySelector('.live-demo__code code') || {}).textContent || '',
    offlineHint: (document.querySelector('.live-demo__offline') || {}).textContent || '',
  });
})()"""


def process_events(seconds: float) -> None:
    from PySide6.QtCore import QCoreApplication, QEventLoop

    deadline = time.time() + seconds
    while time.time() < deadline:
        QCoreApplication.processEvents(QEventLoop.ProcessEventsFlag.AllEvents, 50)
        time.sleep(0.02)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="验证文档站的纯说明书形态")
    parser.add_argument("--dist", type=Path, default=BASE_DIR / "web" / ".vitepress" / "dist")
    parser.add_argument("--page", default="examples/call")
    args = parser.parse_args(argv)

    dist = args.dist.resolve()
    if not (dist / "index.html").is_file():
        print(f"找不到构建产物: {dist}", file=sys.stderr)
        return 2
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    os.environ.setdefault(
        "QTWEBENGINE_CHROMIUM_FLAGS", "--no-sandbox --disable-gpu --disable-dev-shm-usage"
    )

    from PySide6.QtCore import QUrl
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from PySide6.QtWidgets import QApplication

    httpd = start_server(dist)
    url = f"http://127.0.0.1:{httpd.server_address[1]}/{args.page}"
    app = QApplication(sys.argv[:1])
    view = QWebEngineView()  # 关键: 不挂 webChannel, 等价于普通浏览器
    view.resize(1280, 840)
    view.setUrl(QUrl(url))

    result: dict[str, object] = {}
    deadline = time.time() + 45
    while time.time() < deadline:
        box: dict[str, object] = {}
        view.page().runJavaScript(PROBE_JS, 0, lambda v: box.setdefault("v", v))
        process_events(0.4)
        raw = box.get("v")
        if raw:
            data = json.loads(raw)  # type: ignore[arg-type]
            if data.get("hooked") and data.get("loaded"):
                result = data
                break

    if not result:
        print(f"✗ 页面在 45s 内没有加载出示例卡片（{url}）")
        return 1

    checks = {
        "connected 为 false": result["connected"] is False,
        "按钮显示「需要 Python 后端」": "需要 Python 后端" in str(result["buttonText"]),
        "按钮不可点": result["buttonDisabled"] is True,
        "状态条说明是纯文档模式": "纯文档" in str(result["status"]),
        "示例代码仍可读": len(str(result["codeLine"])) > 10,
        "有离线提示文案": "纯文档模式" in str(result["offlineHint"]),
    }
    print("=== 纯文档模式验证 ===")
    for name, ok in checks.items():
        print(f"  {'✓' if ok else '✗'} {name}")
    print(f"  status: {result['status']}")
    print(f"  button: {result['buttonText']} (disabled={result['buttonDisabled']})")
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
