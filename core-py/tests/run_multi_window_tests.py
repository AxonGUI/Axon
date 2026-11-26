"""跨窗口交互验证：开两个真窗口，用它们互相调。

    core-py/.venv/bin/python core-py/tests/run_multi_window_tests.py

和 `run_web_tests.py` 一样需要真 Qt WebEngine（offscreen 即可），
会开两个 `AxonGUI`：web_name = "A" 与 "B"，都加载 `web/multi.html`。
"""

from __future__ import annotations

import functools
import http.server
import json
import os
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

from axon import AxonCross, AxonGUI, AxonMagicGUI  # noqa: E402

WEB_DIR = HERE / "web"
BUNDLE = WEB_DIR / "axon.bundle.js"
REPORT = HERE / "last_multi_window_report.json"


def build_bundle() -> None:
    esbuild = REPO / "core-js" / "node_modules" / ".bin" / "esbuild"
    if not esbuild.exists():
        raise SystemExit("缺少 esbuild: 先执行 `cd core-js && npm ci`")
    print("[multi] 打包 core-js → axon.bundle.js")
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
        deadline = time.time() + timeout
        while not box and time.time() < deadline:
            self.app.processEvents()
            time.sleep(0.005)
        if not box:
            raise TimeoutError(f"JS 没在 {timeout}s 内返回: {code[:80]}")
        return box[0]

    def wait(self, view: AxonGUI, expr: str, timeout: float = 20.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                if self.eval(view, expr, timeout=2.0):
                    return True
            except TimeoutError:
                pass
            self.app.processEvents()
            time.sleep(0.02)
        raise TimeoutError(f"等不到条件: {expr}")

    def assert_js(
        self,
        view: AxonGUI,
        key: str,
        thunk: str,
        check,
        timeout: float = 20.0,
    ):
        """在页面里跑 thunk（一个返回 Promise 的箭头函数），把结果交给 check 判。"""
        self.eval(view, f"window.__assert({json.dumps(key)}, {thunk})")
        deadline = time.time() + timeout
        payload = None
        while time.time() < deadline:
            raw = self.eval(view, f"JSON.stringify(window.__out[{json.dumps(key)}] ?? null)")
            if raw and raw != "null":
                payload = json.loads(raw)
                break
            self.app.processEvents()
            time.sleep(0.02)
        if payload is None:
            return False, f"超时（等 {key}）"
        if not payload.get("ok"):
            return False, f"JS 抛错: {payload.get('error')}"
        value = payload.get("value")
        try:
            ok = check(value)
        except Exception as exc:  # noqa: BLE001
            return False, f"判据异常 {exc}: value={value!r}"
        return bool(ok), f"value={value!r}"


def wait_future(app: QApplication, future, timeout: float = 15.0):
    """等一个 Future：主线程必须继续转 Qt 事件循环，否则 JS 的回包永远进不来。"""
    deadline = time.time() + timeout
    while not future.done() and time.time() < deadline:
        app.processEvents()
        time.sleep(0.005)
    if not future.done():
        raise TimeoutError(f"Future 在 {timeout}s 内没有结果")
    return future.result()


def main() -> int:
    if "--no-build" not in sys.argv:
        build_bundle()
    elif not BUNDLE.exists():
        raise SystemExit("没有 axon.bundle.js，去掉 --no-build 先打包")

    httpd = start_server(WEB_DIR)
    base = f"http://127.0.0.1:{httpd.server_address[1]}/multi.html"

    app = QApplication(sys.argv[:1])
    AxonMagicGUI()
    driver = Driver(app)

    win_a = AxonGUI("A", f"{base}?web=A")
    win_b = AxonGUI("B", f"{base}?web=B")
    win_a.resize(900, 620)
    win_b.resize(900, 620)
    win_a.show()
    win_b.show()

    results: list[dict] = []

    def record(name: str, ok: bool, detail: str = ""):
        results.append({"name": name, "ok": bool(ok), "detail": detail})
        print(f"  {'PASS' if ok else 'FAIL'}  {name}{'' if ok else '  ← ' + detail}")

    try:
        for name, win in (("A", win_a), ("B", win_b)):
            driver.wait(win, "!!window.__ready")
            state = driver.eval(win, "JSON.stringify(window.__multi)")
            info = json.loads(state)
            record(f"boot/{name}", bool(info.get("connected")), state)

        # 1. 有哪些窗口
        ok, detail = driver.assert_js(
            win_a,
            "windows_list",
            "async () => await AxonCross.windows()",
            lambda v: sorted(v) == ["A", "B"],
        )
        record("windows/from-js", ok, detail)

        # 2. A 调 B（摊开传参）
        ok, detail = driver.assert_js(
            win_a,
            "a_to_b",
            'async () => await AxonCross.web("B").Node.echo("hi", 1)',
            lambda v: v == '["hi",1]',
        )
        record("call/a-to-b", ok, detail)

        # 3. A 调 B（带 kwargs + 超时）
        ok, detail = driver.assert_js(
            win_a,
            "a_to_b_kwargs",
            "async () => await AxonCross.call({ web: 'B', controller: 'Node', func: 'echo', args: ['x'], kwargs: { k: 1 }, timeout: 5000 })",
            lambda v: v == '["x",{"k":1}]',
        )
        record("call/a-to-b-kwargs", ok, detail)

        # 4. B 调 A（反方向）
        ok, detail = driver.assert_js(
            win_b,
            "b_to_a",
            'async () => await AxonCross.web("A").Node.echo("back")',
            lambda v: v == '["back"]',
        )
        record("call/b-to-a", ok, detail)

        # 5. 广播：每个窗口各自返回自己的名字
        ok, detail = driver.assert_js(
            win_a,
            "broadcast",
            'async () => await AxonCross.broadcast({ controller: "Node", func: "who" })',
            lambda v: len(v) == 2 and all(item["ok"] for item in v)
            and sorted(item["value"] for item in v) == ["A", "B"],
        )
        record("broadcast/from-js", ok, detail)

        # 6. 事件：发到所有窗口（等 emit 自己 settle，再分别看两个窗口收到没有）
        ok, detail = driver.assert_js(
            win_a,
            "emit",
            'async () => await AxonCross.emit("cross:ping", "hello")',
            lambda v: v.get("count") == 2,
        )
        record("emit/all/settles", ok, detail)
        for name, win in (("A", win_a), ("B", win_b)):
            deadline = time.time() + 5
            got = []
            while time.time() < deadline:
                got = json.loads(driver.eval(win, "JSON.stringify(window.__events)"))
                if "hello" in got:
                    break
                app.processEvents()
                time.sleep(0.1)
            record(f"emit/all/{name}", "hello" in got, f"events={got}")

        # 7. 事件：只发一个窗口
        wait_future(app, AxonCross.emit_to("B", "cross:from-py", "only-b"), 10)
        time.sleep(0.4)
        events_b = json.loads(driver.eval(win_b, "JSON.stringify(window.__events)"))
        events_a = json.loads(driver.eval(win_a, "JSON.stringify(window.__events)"))
        record("emit/to-one", "py:only-b" in events_b and "py:only-b" not in events_a,
               f"A={events_a} B={events_b}")

        # 8. 嵌套：A → B → A，不能互相卡死
        ok, detail = driver.assert_js(
            win_a,
            "nested",
            'async () => await AxonCross.web("B").Node.chain("A")',
            lambda v: v == "A",
        )
        record("nested/a-b-a", ok, detail)

        # 9. 错误隔离：B 里的异常要能传回 A
        ok, detail = driver.assert_js(
            win_a,
            "error",
            'async () => { try { await AxonCross.web("B").Node.boom(); return "没抛"; } catch (e) { return String(e.message || e); } }',
            lambda v: "node-boom" in v,
        )
        record("error/propagates", ok, detail)

        # 10. Python → 所有窗口
        futures = AxonCross.broadcast("Node", "who")
        values = sorted(wait_future(app, f, 10) for f in futures.values())
        record("py/broadcast", values == ["A", "B"], f"values={values}")

        # 11. 共享 Store 跨窗口
        driver.eval(win_a, "window.__AxonStore.shared.set('cross:key', 'from-a')")
        shared_value = None
        deadline = time.time() + 8
        while time.time() < deadline:
            raw = driver.eval(
                win_b, "JSON.stringify(window.__AxonStore.shared.get('cross:key'))"
            )
            if raw and raw != "null":
                shared_value = json.loads(raw)
                break
            app.processEvents()
            time.sleep(0.1)
        record(
            "store/shared-cross-window",
            shared_value == "from-a",
            f"B 读到 {shared_value!r}",
        )

        # 12. 超时：目标窗口慢，调用方按 timeout 放弃
        ok, detail = driver.assert_js(
            win_a,
            "timeout",
            "async () => { try { await AxonCross.call({ web: 'B', controller: 'Node', func: 'slow', args: [800], timeout: 120 }); return '没超时'; } catch (e) { return `${e.name}|${e.code}|${e.message}`; } }",
            lambda v: v.startswith("AxonTimeoutError|TIMEOUT|"),
        )
        record("call/timeout", ok, detail)

        # 13. 窗口关掉之后要从窗口表里消失
        win_b.close()
        app.processEvents()
        deadline = time.time() + 8
        while time.time() < deadline and "B" in AxonCross.windows():
            app.processEvents()
            time.sleep(0.05)
        record("lifecycle/closed-removed", AxonCross.windows() == ["A"], f"windows={AxonCross.windows()}")
        try:
            wait_future(app, AxonCross.call("B", "Node", "who"), 3)
            record("lifecycle/call-closed", False, "本应报错却成功了")
        except Exception as exc:  # noqa: BLE001
            record("lifecycle/call-closed", "not found" in str(exc), str(exc))

    except Exception:  # noqa: BLE001
        traceback.print_exc()
        record("harness/crashed", False, "见上面的栈")
    finally:
        win_a.close()
        app.processEvents()

    failed = [r for r in results if not r["ok"]]
    REPORT.write_text(
        json.dumps({"total": len(results), "failed": len(failed), "results": results},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n[multi] 共 {len(results)} 条, 失败 {len(failed)} 条 → {REPORT}")
    return len(failed)


if __name__ == "__main__":
    sys.exit(main())
