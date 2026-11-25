#!/usr/bin/env python3
"""测 axon 的调用开销：JS→PY、PY→JS、属性读、并发、载荷、扇出、启动。

用法：
    python core-py/benchmarks/run_bench.py [--calls 500] [--json out.json]

说明：默认 offscreen 跑（CI/无显示器可用）。offscreen 下 Chromium 会节流定时器，
但 QWebChannel 消息不受定时器节流影响，所以往返延迟仍然可比；渲染相关的指标不要看这里。
"""
from __future__ import annotations

import argparse
import http.server
import json
import os
import shutil
import socketserver
import statistics
import sys
import threading
import time
from pathlib import Path

# 默认 offscreen；有 X 显示时用 xcb 更接近真实（offscreen 下 Chromium 会把页面的
# setTimeout 节流到 1s/次，把每次调用都量成 ~1s，全是假的）。
if not os.environ.get("DISPLAY"):
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
# offscreen 下 Chromium 会把后台页的定时器节流到 1s/次，qwebchannel 的传输靠 setTimeout
# 驱动，不关掉节流会把每次调用量成 ~1s（假数据）。
os.environ.setdefault(
    "QTWEBENGINE_CHROMIUM_FLAGS",
    "--no-sandbox --disable-gpu --disable-dev-shm-usage "
    "--disable-background-timer-throttling --disable-renderer-backgrounding "
    "--disable-backgrounding-occluded-windows",
)

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
BUNDLE = REPO / "core-js" / "dist" / "axon.umd.cjs"
sys.path.insert(0, str(REPO / "core-py"))

from PySide6.QtCore import QTimer  # noqa: E402
from PySide6.QtWidgets import QApplication  # noqa: E402

from axon import (  # noqa: E402
    Axon,
    AxonController,
    AxonCross,
    AxonEvent,
    AxonGUI,
    AxonMagicGUI,
)

WEB = "bench"
WEB2 = "bench2"
WEB3 = "bench3"


@AxonController(WEB, id="Bench")
class BenchController:
    def __init__(self) -> None:
        self.counter = 0

    def echo(self, value=None):
        return value

    def nothing(self, value=None):
        return None

    async def aecho(self, value=None):
        return value

    def burn(self, ms: int = 200):
        """纯 Python 忙循环：占着 GIL，别的线程进不来。"""
        end = time.perf_counter() + ms / 1000.0
        x = 0
        while time.perf_counter() < end:
            x += 1
        return x

    def sleeper(self, ms: int = 200):
        """time.sleep：让出 GIL，线程池能并行。"""
        time.sleep(ms / 1000.0)
        return ms

    async def aburn(self, ms: int = 200):
        """asyncio.sleep：让出事件循环。"""
        import asyncio
        await asyncio.sleep(ms / 1000.0)
        return ms


@AxonController(["bench2", "bench3"], id="Echo")
class BenchEcho:
    def echo(self, value=None):
        return value


class _Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(HERE / "web"), **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def ensure_bundle() -> None:
    """把前端产物拷进 bench 的 web 目录（避免页面 404）。"""
    if not BUNDLE.exists():
        raise SystemExit(f"缺少前端产物：{BUNDLE}（先在 core-js 里 npm run build）")
    target = HERE / "web" / "axon.umd.cjs"
    if not target.exists() or target.stat().st_mtime < BUNDLE.stat().st_mtime:
        shutil.copyfile(BUNDLE, target)


def start_server() -> socketserver.ThreadingTCPServer:
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), _Handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def wait_future(future, timeout: float = 60.0):
    """在主线程里等 Future：必须一边等一边 processEvents，否则回包进不来。"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        QApplication.processEvents()
        if future.done():
            return future.result()
        time.sleep(0.002)
    raise TimeoutError("future 超时")


def pct(values, p):
    s = sorted(values)
    return s[min(len(s) - 1, int(p * len(s)))]


def stat(values):
    return {
        "n": len(values),
        "p50": round(pct(values, 0.5), 3),
        "p95": round(pct(values, 0.95), 3),
        "p99": round(pct(values, 0.99), 3),
        "mean": round(statistics.fmean(values), 3),
        "min": round(min(values), 3),
        "max": round(max(values), 3),
    }


def wait_js_ready(view: AxonGUI, timeout: float = 20.0) -> bool:
    deadline = time.time() + timeout
    holder = {}
    while time.time() < deadline:
        view.page().runJavaScript(
            "(window.__bench && (!window.__bench.error || window.__bench.error === 'not-ready')) ? JSON.stringify(window.__bench) : (window.axon ? 'booting' : 'no-lib')",
            0,
            lambda r: holder.__setitem__("v", r),
        )
        QApplication.processEvents()
        v = holder.get("v")
        # 'booting' = 库已加载；JSON 字符串 = 套件已有结果（可能已完成）
        if v and v != "no-lib":
            return True
        if os.environ.get("BENCH_DEBUG"):
            h2 = {}
            view.page().runJavaScript(
                "JSON.stringify({href: location.href, rs: document.readyState, lib: typeof window.axon, scripts: [...document.scripts].map(s => s.src)})",
                0, lambda r: h2.__setitem__("v", r))
            for _ in range(100):
                QApplication.processEvents(); time.sleep(0.003)
                if "v" in h2: break
            print(f"  [wait] {view.web_name} -> {v!r} {h2.get('v')}", flush=True)
        time.sleep(0.02)
    return False


def js_blocking(view: AxonGUI, code: str, timeout: float = 40.0):
    """在 Qt 主线程里等一个 JS 结果（用 processEvents 轮询，避免堵住事件循环）。"""
    holder = {}
    view.page().runJavaScript(code, 0, lambda r: holder.__setitem__("v", r))
    deadline = time.time() + timeout
    while time.time() < deadline:
        QApplication.processEvents()
        if "v" in holder:
            return holder["v"]
        time.sleep(0.005)
    raise TimeoutError(f"JS 超时：{code[:60]}")


def measure_py2js(view: AxonGUI, n: int = 50):
    """Python 侧发起调用并计时（含 Future 解析开销）。"""
    jsv = Axon(WEB)
    jsv.Echo.echo(0)  # 预热
    small, medium, large, getvar = [], [], [], []
    # 并发一批，摊薄固定开销
    t0 = time.perf_counter()
    futures = [jsv.Echo.echo(1) for _ in range(n)]
    for f in futures:
        wait_future(f, 60)
    total = (time.perf_counter() - t0) * 1000
    out = {"burst-n": n, "total": round(total, 1), "perCall": round(total / n, 3), "perSec": round(n / (total / 1000))}
    for _ in range(10):
        t0 = time.perf_counter()
        jsv.Echo.echo(1)
        small.append((time.perf_counter() - t0) * 1000)
    for _ in range(100):
        t0 = time.perf_counter()
        jsv.Echo.echo("x" * 64 * 1024)
        medium.append((time.perf_counter() - t0) * 1000)
    for _ in range(20):
        t0 = time.perf_counter()
        jsv.Echo.echo("x" * 1024 * 1024)
        large.append((time.perf_counter() - t0) * 1000)
    for _ in range(200):
        t0 = time.perf_counter()
        _ = jsv.Echo.value
        getvar.append((time.perf_counter() - t0) * 1000)
    return {
        "burst": out,
        "seq-1B": stat(small),
        "call-64KB": stat(medium),
        "call-1MB": stat(large),
        "getVar": stat(getvar),
    }


def measure_fanout(views: list[AxonGUI], n: int = 50):
    """广播到 N 个窗口，以及跨窗口 A→B 的点对点调用。"""
    out = {}
    for count in range(2, len(views) + 1):
        webs = [v.web_name for v in views[:count]]
        vals = []
        for _ in range(n):
            t0 = time.perf_counter()
            futures = AxonCross.broadcast("Echo", "echo", 1)
            for f in futures.values():
                wait_future(f, 30)
            vals.append((time.perf_counter() - t0) * 1000)
        out[f"broadcast-{count}win"] = stat(vals)
    vals = []
    for _ in range(n):
        t0 = time.perf_counter()
        wait_future(AxonCross.call(views[1].web_name, "Echo", "echo", 1), 30)
        vals.append((time.perf_counter() - t0) * 1000)
    out["cross-A->B"] = stat(vals)

    # 事件：Python 发到所有窗口（不等回执，测发出耗时）
    vals = []
    for _ in range(n):
        t0 = time.perf_counter()
        AxonEvent.dispatch_js_event_batch("bench:ping", [[1]], [v.web_name for v in views])
        vals.append((time.perf_counter() - t0) * 1000)
    out["event-fanout"] = stat(vals)
    return out


CONCURRENCY_JS = """
(async () => {
  const lib = window.axon;
  const time = async (fn) => { const s = performance.now(); await fn(); return Math.round(performance.now() - s); };
  const out = {};
  out.cpu_4x200 = await time(() => Promise.all([1,2,3,4].map(() => lib.Axon.Bench.burn(200))));
  out.sleep_4x300 = await time(() => Promise.all([1,2,3,4].map(() => lib.Axon.Bench.sleeper(300))));
  out.async_4x300 = await time(() => Promise.all([1,2,3,4].map(() => lib.Axon.Bench.aburn(300))));
  window.__conc = JSON.stringify(out);
})()
"""


def measure_concurrency(view: AxonGUI):
    """并发伸缩：CPU 密集 / 阻塞 IO / asyncio 三种处理器各 4 个并发。"""
    view.page().runJavaScript(CONCURRENCY_JS, 0, lambda _r: None)
    deadline = time.time() + 120
    while time.time() < deadline:
        QApplication.processEvents()
        holder = {}
        view.page().runJavaScript("window.__conc || ''", 0, lambda r: holder.__setitem__("v", r))
        for _ in range(40):
            QApplication.processEvents()
            if holder.get("v"):
                return json.loads(holder["v"])
            time.sleep(0.003)
        time.sleep(0.02)
    return {"error": "timeout"}


def measure_memory():
    """Python + 所有 Chromium 子进程的常驻内存（MB）。"""
    total = 0
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue
        try:
            cmd = open(f"/proc/{pid}/cmdline", "rb").read().decode("utf8", "replace")
            if "QtWebEngineProcess" not in cmd and "run_bench.py" not in cmd:
                continue
            for line in open(f"/proc/{pid}/status"):
                if line.startswith("VmRSS"):
                    total += int(line.split()[1])
        except OSError:
            pass
    return round(total / 1024)


def measure_startup(url: str):
    """建窗口 → loadFinished → JS AxonInit 完成，各段耗时。"""
    t0 = time.perf_counter()
    view = AxonGUI(WEB, url)
    view.show()
    app = QApplication.instance()
    t_page = t_channel = None
    while time.perf_counter() - t0 < 30:
        app.processEvents()
        current = view.page().url().toString() if view.page() else ""
        if t_page is None and current.startswith("http"):
            holder = {}
            view.page().runJavaScript("(() => document.readyState === 'complete' && window.__ready === true) ? 1 : 0", 0, lambda r: holder.__setitem__("v", r))
            for _ in range(50):
                app.processEvents()
                if "v" in holder:
                    break
                time.sleep(0.002)
            if holder.get("v") == 1:
                t_page = time.perf_counter() - t0
        if t_page and t_channel is None:
            if wait_js_ready(view, timeout=0.5):
                t_channel = time.perf_counter() - t0
                break
        time.sleep(0.01)
    view.deleteLater()
    app.processEvents()
    return {"window+page": round(t_page or -1, 1), "channel-ready": round(t_channel or -1, 1)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", default=str(HERE / "last_bench.json"))
    args = parser.parse_args()

    ensure_bundle()
    httpd = start_server()
    if os.environ.get("BENCH_DEBUG"):
        import urllib.request
        for p in ("/index.html", "/axon.umd.cjs", "/bench.js"):
            url = f"http://127.0.0.1:{httpd.server_address[1]}{p}"
            try:
                with urllib.request.urlopen(url) as r:
                    print(f"  [http] {p} {r.status} {len(r.read())}", flush=True)
            except Exception as e:
                print(f"  [http] {p} FAILED {e}", flush=True)
    base = f"http://127.0.0.1:{httpd.server_address[1]}"

    app = QApplication(sys.argv[:1])
    AxonMagicGUI()

    # 三个窗口：bench / bench2 / bench3
    views = []
    for name in (WEB, WEB2):
        view = AxonGUI(name, base + "/index.html")
        view.show()
        views.append(view)
    for v in views:
        if not wait_js_ready(v):
            print("页面没就绪", v.web_name, file=sys.stderr)
            return 2

    print("[bench] 等三个窗口的 JS 套件跑完…")
    deadline = time.time() + 180
    payload = None
    while time.time() < deadline:
        raw = js_blocking(views[0], "window.__bench ? JSON.stringify(window.__bench) : ''", 10)
        if raw:
            payload = json.loads(raw)
            break
        time.sleep(0.2)
    if not payload:
        print("JS 套件没有结果", file=sys.stderr)
        return 2
    if payload.get("error"):
        print("JS 套件报错：\n" + str(payload["error"])[:2000], file=sys.stderr)
        return 2

    concurrency = measure_concurrency(views[0])
    memory_before = measure_memory()
    result = {
        "env": {
            "platform": os.environ.get("QT_QPA_PLATFORM"),
            "chromium_flags": os.environ.get("QTWEBENGINE_CHROMIUM_FLAGS"),
            "cpu_count": os.cpu_count(),
        },
        "js_side": payload,
        "py2js": measure_py2js(views[0]),
        "fanout": measure_fanout(views),
        "concurrency": concurrency,
        "memory_mb": {"two_windows": memory_before},
    }
    Path(args.json).write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(json.dumps(result, indent=2, ensure_ascii=False))
    for v in views:
        v.close()
    QApplication.processEvents()
    httpd.shutdown()
    shutil.rmtree(HERE / "web" / "__pycache__", ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
