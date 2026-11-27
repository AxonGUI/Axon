#!/usr/bin/env python
"""崩溃恢复与断线语义验证台。

    core-py/.venv/bin/python core-py/tests/run_resilience_tests.py [--show]

和 `run_web_tests.py` 一样需要真 Qt WebEngine（offscreen 即可），但它测的是
**故障路径**，所以真的把渲染进程杀掉、真的派发 `pagehide`：

1. 渲染进程被 SIGKILL 之后，Python 侧发给这个窗口、还在等回包的调用必须立刻
   变成 `AxonChannelLostError`（以前会一直挂在 `callFutures` 里，没写 timeout
   就是永远）；
2. 同一个崩溃要派发 Python 事件 `renderProcessCrashed`，并按策略自动重载；
3. 重载之后通道能重新握手，调用恢复可用（这是「恢复」而不是「报错」）；
4. `crash_recovery="none"` 时不重载，只把状态记下来；
5. 页面 `pagehide`（窗口关闭 / 导航走）时，JS 侧还在等 Python 回包的 Promise
   必须 reject 成 `AxonChannelLostError`，而不是永远悬着；
6. 窗口关闭时，发给它的调用变成 `AxonNotConnectedError`。

注意：**不能**在主线程上 `future.result(t)` 等回包——回包要经 Qt 主线程派发，
主线程阻塞着等就是死锁（框架里 `JSController.__setattr__` 那条注释说的就是这个）。
所以这里统一用 `wait_future()`：转事件循环 + 轮询 `done()`。
"""

from __future__ import annotations

import functools
import http.server
import json
import os
import signal
import socketserver
import subprocess
import sys
import threading
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
os.environ.setdefault("QTWEBENGINE_DISABLE_SANDBOX", "1")
os.environ.setdefault(
    "QTWEBENGINE_CHROMIUM_FLAGS",
    "--no-sandbox --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer",
)

sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / "core-py"))

from PySide6.QtWidgets import QApplication  # noqa: E402

from axon import (  # noqa: E402
    Axon,
    AxonChannelLostError,
    AxonController,
    AxonError,
    AxonEvent,
    AxonGUI,
    AxonMagicGUI,
    AxonNotConnectedError,
)

WEB_DIR = HERE / "web"
BUNDLE = WEB_DIR / "axon.bundle.js"
REPORT = HERE / "last_resilience_report.json"


@AxonController(["resilience", "resilience2"], id="Test")
class ResilienceController:
    """只给验证页用的最小 Python 控制器：慢方法用来制造「在飞的 JS→PY 调用」。"""

    def sleep(self, ms: int) -> str:
        time.sleep(max(ms, 0) / 1000.0)
        return f"slept {ms}"


def build_bundle() -> None:
    esbuild = REPO / "core-js" / "node_modules" / ".bin" / "esbuild"
    if not esbuild.exists():
        raise SystemExit("缺少 esbuild: 先执行 `cd core-js && npm ci`")
    print("[resilience] 打包 core-js → axon.bundle.js")
    subprocess.run(
        [
            str(esbuild),
            str(REPO / "core-js" / "lib" / "index.ts"),
            "--bundle",
            "--format=iife",
            "--global-name=AxonLib",
            "--target=es2022",
            "--log-level=warning",
            f"--outfile={BUNDLE}",
        ],
        check=True,
    )


def start_server(directory: Path):
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler, directory=str(directory)
    )
    handler.log_message = lambda *a, **k: None  # type: ignore[method-assign]
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


class Driver:
    """跑 JS 并等结果：runJavaScript 的回调要靠主线程转事件循环才会来。"""

    def __init__(self, app: QApplication):
        self.app = app

    def eval(self, view: AxonGUI, code: str, timeout: float = 15.0):
        box: list = []
        view.page().runJavaScript(code, 0, box.append)
        if not self.wait(lambda: bool(box), timeout, code):
            raise TimeoutError(f"JS 没在 {timeout}s 内返回: {code[:80]}")
        return box[0]

    def eval_json(self, view: AxonGUI, code: str, timeout: float = 15.0):
        raw = self.eval(view, code, timeout)
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return raw
        return raw

    def wait(self, predicate, timeout: float, what: str = "") -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                if predicate():
                    return True
            except Exception:  # noqa: BLE001 - 判定本身抛错当作「还没到」
                pass
            self.app.processEvents()
            time.sleep(0.01)
        return False

    def settle(self, seconds: float = 0.3) -> None:
        deadline = time.time() + seconds
        while time.time() < deadline:
            self.app.processEvents()
            time.sleep(0.01)


def main() -> int:
    show = "--show" in sys.argv
    if not show:
        os.environ["QT_QPA_PLATFORM"] = "offscreen"
    build_bundle()

    httpd = start_server(WEB_DIR)
    port = httpd.server_address[1]
    url = f"http://127.0.0.1:{port}/resilience.html"

    app = QApplication(sys.argv)
    AxonMagicGUI()
    driver = Driver(app)
    results: list[dict[str, object]] = []

    def record(name: str, ok: bool, detail: object = "") -> None:
        results.append({"name": name, "ok": bool(ok), "detail": str(detail)})
        print(f"[{'PASS' if ok else 'FAIL'}] {name:<38} {detail}")
        sys.stdout.flush()

    def wait_future(future: object, timeout: float = 10.0) -> None:
        driver.wait(lambda: getattr(future, "done")(), timeout, "future 没落定")

    def call_ok(future: object, timeout: float = 10.0) -> tuple[bool, object]:
        wait_future(future, timeout)
        try:
            return True, getattr(future, "result")(0)
        except BaseException as err:  # noqa: BLE001
            return False, f"{type(err).__name__}: {err}"

    def expect_raises(
        name: str, future: object, exc_type: type[BaseException], code: str = ""
    ) -> None:
        wait_future(future, 10)
        try:
            value = getattr(future, "result")(0)
        except BaseException as err:  # noqa: BLE001 - 验证就是要看抛的是什么
            ok = isinstance(err, exc_type) and (
                not code or getattr(err, "code", None) == code
            )
            record(name, ok, f"{type(err).__name__}({getattr(err, 'code', '')}): {err}")
            return
        record(name, False, f"本应抛 {exc_type.__name__}，却返回 {value!r}")

    crash_events: list[dict] = []
    AxonEvent.add_listener(
        "renderProcessCrashed", lambda payload: crash_events.append(payload)
    )

    def open_window(name: str, **options: object) -> AxonGUI:
        view = AxonGUI(name, url, options=options)  # type: ignore[arg-type]
        view.resize(900, 600)
        if show:
            view.show()
        ok = driver.wait(lambda: getattr(view, "_js_ready", False), 30)
        record(f"{name}/boot", ok, f"js_ready={getattr(view, '_js_ready', None)}")
        return view

    def kill_renderer(view: AxonGUI) -> int:
        pid = view.page().renderProcessPid()
        if pid <= 0:
            raise RuntimeError("拿不到 renderProcessPid()")
        os.kill(pid, signal.SIGKILL)
        return pid

    # ---------------- 1. crash_recovery="none"：不重载，只记录 ----------------
    try:
        policy = open_window("resilience2", crash_recovery="none")
        ok, value = call_ok(Axon("resilience2").Echo.echo("x"))
        record("none/roundtrip_before", ok and value == "echo:x", value)
        pending = Axon("resilience2").Echo.hang()
        driver.settle(0.4)
        pid = kill_renderer(policy)
        driver.wait(lambda: bool(crash_events), 15)
        payload = crash_events[0] if crash_events else {}
        record("none/event_fired", len(crash_events) >= 1, payload)
        record(
            "none/event_payload",
            payload.get("webName") == "resilience2"
            and payload.get("willReload") is False
            and int(payload.get("failedCalls", 0)) >= 1,
            payload,
        )
        expect_raises(
            "none/pending_call_failed",
            pending,
            AxonChannelLostError,
            "CHANNEL_LOST",
        )
        record("none/render_crashed_flag", policy.render_crashed is True, policy.last_crash)
        driver.settle(2.0)
        record(
            "none/no_reload",
            getattr(policy, "_js_ready", True) is False,
            f"js_ready={getattr(policy, '_js_ready', None)} pid={pid}",
        )
        policy.close()
        driver.settle(0.5)
    except Exception:  # noqa: BLE001 - 一条用例炸了别把整台打掉
        record("none/exception", False, traceback.format_exc(limit=3))

    # ---------------- 2. 崩溃 → 自动重载 → 恢复可用 ----------------
    main_view: AxonGUI | None = None
    try:
        crash_events.clear()
        main_view = open_window(
            "resilience", crash_recovery="reload", crash_reload_limit=3
        )
        ok, value = call_ok(Axon("resilience").Echo.echo("a"))
        record("reload/roundtrip_before", ok and value == "echo:a", value)
        pending = Axon("resilience").Echo.hang()
        driver.settle(0.4)
        kill_renderer(main_view)
        driver.wait(lambda: bool(crash_events), 15)
        payload = crash_events[0] if crash_events else {}
        record("reload/event_will_reload", payload.get("willReload") is True, payload)
        expect_raises(
            "reload/pending_call_failed",
            pending,
            AxonChannelLostError,
            "CHANNEL_LOST",
        )
        ready_again = driver.wait(
            lambda: getattr(main_view, "_js_ready", False)
            and getattr(main_view, "_page_loaded", False),
            30,
        )
        record("reload/page_ready_again", ready_again)
        ok, value = call_ok(Axon("resilience").Echo.echo("b"))
        record("reload/roundtrip_after", ok and value == "echo:b", value)
        record(
            "reload/crash_flag_cleared",
            main_view.render_crashed is False,
            main_view.last_crash,
        )
    except Exception:  # noqa: BLE001
        record("reload/exception", False, traceback.format_exc(limit=3))

    # ---------------- 3. pagehide：JS 在飞调用必须 reject ----------------
    try:
        assert main_view is not None
        started = driver.eval(main_view, "window.__startSlowCall(3000)")
        driver.settle(0.4)
        driver.eval(main_view, 'window.dispatchEvent(new Event("pagehide")), "ok"')
        got = driver.wait(
            lambda: driver.eval_json(main_view, "window.__slowResult()") is not None,
            10,
        )
        slow = driver.eval_json(main_view, "window.__slowResult()") or {}
        record(
            "pagehide/pending_rejected",
            started == "started" and got and slow.get("ok") is False,
            slow,
        )
        record(
            "pagehide/error_shape",
            slow.get("code") == "CHANNEL_LOST"
            and slow.get("name") == "AxonChannelLostError",
            slow,
        )
        status = driver.eval_json(main_view, "window.__status()")
        record(
            "pagehide/status_disconnected",
            status.get("connected") is False and status.get("reason") == "page-unloaded",
            status,
        )
    except Exception:  # noqa: BLE001
        record("pagehide/exception", False, traceback.format_exc(limit=3))

    # ---------------- 4. 关窗口：在飞调用变 NOT_CONNECTED ----------------
    try:
        victim = open_window("resilience2", crash_recovery="reload")
        pending2 = Axon("resilience2").Echo.hang()
        driver.settle(0.4)
        victim.close()
        driver.settle(0.6)
        expect_raises(
            "close/pending_call_failed",
            pending2,
            AxonNotConnectedError,
            "NOT_CONNECTED",
        )
        record(
            "close/window_unregistered",
            "resilience2" not in AxonGUI.windows(),
            AxonGUI.windows(),
        )
    except Exception:  # noqa: BLE001
        record("close/exception", False, traceback.format_exc(limit=3))

    # ---------------- 汇总 ----------------
    failed = [r for r in results if not r["ok"]]
    print("=" * 66)
    print(f"共 {len(results)} 条, 失败 {len(failed)} 条")
    for item in failed:
        print(f"  ✗ {item['name']}: {item['detail']}")
    REPORT.write_text(
        json.dumps(
            {"total": len(results), "failed": len(failed), "results": results},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"报告: {REPORT.relative_to(REPO)}")
    httpd.shutdown()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
