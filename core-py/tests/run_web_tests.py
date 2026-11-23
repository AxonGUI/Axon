#!/usr/bin/env python
"""Axon 接口验证台。

在真实的 QWebEngine + QWebChannel 里跑一套 JS 测试, 再在 Python 侧跑一套
Python -> JS 的测试, 最后汇总成一张表 + JSON 报告。

用法:
    core-py/.venv/bin/python core-py/tests/run_web_tests.py [--show] [--no-build]

--show 会把窗口显示出来（默认 offscreen 无头运行）。
--no-build 跳过 esbuild 打包, 直接用现有的 web/axon.bundle.js（Windows 无 node 环境用）。
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

from PySide6.QtCore import QTimer  # noqa: E402
from PySide6.QtWidgets import QApplication  # noqa: E402

from axon import Axon, AxonGUI, AxonMagicGUI, AxonStore, AxonController  # noqa: E402

import controllers as ctl  # noqa: E402

WEB_DIR = HERE / "web"
BUNDLE = WEB_DIR / "axon.bundle.js"
REPORT = HERE / "last_report.json"


def build_bundle() -> None:
    esbuild = REPO / "core-js" / "node_modules" / ".bin" / "esbuild"
    if not esbuild.exists():
        raise SystemExit(
            "缺少 esbuild: 先执行 `cd core-js && npm ci`（验证台需要它把 core-js 打成浏览器包）"
        )
    src = REPO / "core-js" / "lib" / "index.ts"
    print(f"[verifier] 打包 {src.relative_to(REPO)} -> {BUNDLE.relative_to(REPO)}")
    subprocess.run(
        [
            str(esbuild),
            str(src),
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


# --------------------------------------------------------------------------- #
# Python 侧测试（在后台线程跑, 主线程保持 Qt 事件循环运转）
# --------------------------------------------------------------------------- #
def python_tests() -> list[dict]:
    results: list[dict] = []

    def record(name, fn, expected=None, snippet=None, expect_exc=None):
        try:
            value = fn()
            if expect_exc is not None:
                results.append(
                    {"name": name, "ok": False, "detail": f"本应抛 {expect_exc}, 却返回 {value!r}"}
                )
                return
            if snippet is not None:
                ok = snippet in str(value)
            elif expected is not None:
                ok = value == expected
            else:
                ok = True
            detail = "" if ok else f"期望 {expected!r}, 实际 {value!r}"
            results.append({"name": name, "ok": ok, "detail": detail})
        except Exception as exc:  # noqa: BLE001
            if expect_exc is not None and isinstance(exc, expect_exc):
                ok = snippet is None or snippet in str(exc)
                results.append(
                    {
                        "name": name,
                        "ok": ok,
                        "detail": "" if ok else f"异常信息里没有 {snippet!r}: {exc}",
                    }
                )
                return
            results.append({"name": name, "ok": False, "detail": f"{type(exc).__name__}: {exc}"})

    web = ctl.TEST_WEB

    # 1. 语法糖不再递归（旧版 JSController.__init__ 直接 RecursionError）
    record("py/sugar_no_recursion", lambda: type(Axon(web).JSBridge).__name__, "JSController")
    # 2. 同步读属性
    record("py/getVar_sync", lambda: Axon(web).JSBridge.label.get(5), "bridge")
    # 3. 同步调用 JS 方法
    record("py/call_sync", lambda: Axon(web).JSBridge.add(2, 3).result(5), 5)
    # 4. await 属性（旧版 __await__ 返回非迭代器 -> TypeError）
    def await_property():
        import asyncio

        async def main():
            return await Axon(web).JSBridge.value

        return asyncio.run(main())

    record("py/await_property", await_property, 99)
    # 5. await 方法
    def await_call():
        import asyncio

        async def main():
            return await Axon(web).JSBridge.asyncEcho("z")

        return asyncio.run(main())

    record("py/await_call", await_call, 'js-async:["z"]')
    # 6. 不存在的 web 要给出明确错误
    record(
        "py/web_not_found",
        lambda: Axon("nope").X.f().result(2),
        snippet="not found",
        expect_exc=RuntimeError,
    )
    # 7. 多 web 装饰器（旧版 return 在 for 里, 只注册第一个）
    from axon.AxonJSCallHandler import AxonController as _AC
    from axon.AxonJSCallHandler import controllerClassDict

    def multi_web():
        keys = [k for k in ("multiA", "multiB") if "MultiWebController" in controllerClassDict[k]]
        return keys

    record("py/multi_web_decorator", multi_web, ["multiA", "multiB"])
    # 8. AxonMagicGUI 投递到 Qt 主线程
    from PySide6.QtCore import QThread

    record(
        "py/magic_gui_main_thread",
        lambda: AxonMagicGUI.run(lambda: QThread.currentThread() is QApplication.instance().thread()).result(5),
        True,
    )
    # 9. store 在 Python 侧写入（旧版 value 是普通字段, 改值不会通知 JS）
    def store_write():
        ctl.store.prop("k3").set("py-direct")
        return ctl.store.prop("k3").get()

    record("py/store_set", store_write, "py-direct")
    # 10. shared store 的 web_names 可迭代（旧版是 dict_keys, add_web 会 AttributeError）
    record(
        "py/shared_store_web_names",
        lambda: sorted(AxonStore.shared.web_names),
        sorted(["testWeb"]),
    )
    # 11. broadcast
    record(
        "py/broadcast",
        lambda: [f.result(5) for f in Axon.broadcast.JSBridge.echo("b")],
        ['js-echo:["b"]'],
    )
    # 12b. store 便捷方法: store.get/set 等价于 store.prop().get()/set()
    def store_shortcut():
        ctl.store.set("k6", "shortcut")
        return ctl.store.get("k6")

    record("py/store_get_set_shortcut", store_shortcut, "shortcut")
    # 12. store 描述符 API 与 JS 对齐
    record(
        "py/store_prop_api",
        lambda: (ctl.store.prop("k3").get(), ctl.store.prop("k3").set("x"), ctl.store.prop("k3").get()),
        ("py-direct", None, "x"),
    )
    return results


# --------------------------------------------------------------------------- #
def main() -> int:
    show = "--show" in sys.argv
    skip_build = "--no-build" in sys.argv  # Windows 等无 esbuild 环境用现成 bundle
    if not show:
        os.environ["QT_QPA_PLATFORM"] = "offscreen"
    if not skip_build:
        build_bundle()
    elif not BUNDLE.is_file():
        print(f"缺少 {BUNDLE}, 先在有 esbuild 的环境里构建", file=sys.stderr)
        return 1

    httpd = start_server(WEB_DIR)
    port = httpd.server_address[1]
    url = f"http://127.0.0.1:{port}/index.html"

    app = QApplication(sys.argv)
    AxonMagicGUI()
    view = AxonGUI(ctl.TEST_WEB, url)
    view.resize(1100, 720)
    if show:
        view.show()

    state: dict = {"js": None, "py": None, "final": None, "phase": "boot"}

    def js(callback, script):
        view.page().runJavaScript(script, callback)

    def quit_now():
        if state["phase"] != "done":
            state["phase"] = "done"
            app.quit()

    def finish(value):
        state["final"] = value
        quit_now()

    def phase_final():
        state["phase"] = "final"
        js(
            finish,
            "JSON.stringify({"
            "k3: (window.__AxonStore.AxonStoreMap.get('teststore')||{prop:()=>({get:()=>null})})"
            ".prop('k3').get(),"
            " storeCount: window.__AxonStore.AxonStoreMap.size,"
            " bridgeValue: window.__bridge ? window.__bridge.value : null"
            "})",
        )

    def poll_py():
        if state["py"] is None:
            QTimer.singleShot(100, poll_py)
        else:
            phase_final()

    def start_py():
        state["phase"] = "py"
        threading.Thread(
            target=lambda: state.__setitem__("py", python_tests()), daemon=True
        ).start()
        QTimer.singleShot(100, poll_py)

    def store_js(value):
        try:
            state["js"] = json.loads(value) if value else []
        except Exception:  # noqa: BLE001
            state["js"] = [
                {"name": "js/report", "ok": False, "detail": f"无法解析 JS 结果: {value!r}"}
            ]
        start_py()

    def on_done_check(done):
        if done:
            js(store_js, "JSON.stringify(window.__results)")
        else:
            QTimer.singleShot(200, tick)

    def tick():
        if state["phase"] != "loaded":
            QTimer.singleShot(200, tick)
            return
        js(on_done_check, "window.__done === true")

    def on_load(ok):
        if not ok:
            state["js"] = [{"name": "js/load", "ok": False, "detail": "页面加载失败"}]
            state["phase"] = "loaded"
            quit_now()
            return
        state["phase"] = "loaded"
        QTimer.singleShot(400, tick)

    view.loadFinished.connect(on_load)

    def watchdog():
        if state["phase"] != "done":
            print("[verifier] 超时退出")
            state["js"] = state["js"] or []
            state["py"] = state["py"] or []
            quit_now()

    QTimer.singleShot(90000, watchdog)
    app.exec()

    js_results = state["js"] or []
    py_results = state["py"] or []
    final = None
    if state["final"]:
        try:
            final = json.loads(state["final"])
        except Exception:  # noqa: BLE001
            final = None
    if final is not None:
        py_results = py_results + [
            {
                "name": "py/store_set_visible_in_js",
                "ok": final.get("k3") in ("x", "py-direct"),
                "detail": f"JS 看到 k3 = {final.get('k3')!r}, bridgeValue = {final.get('bridgeValue')!r}",
            }
        ]

    all_results = js_results + py_results
    width = max((len(r["name"]) for r in all_results), default=10)
    print("\n" + "=" * (width + 40))
    for r in all_results:
        mark = "PASS" if r["ok"] else "FAIL"
        print(f"[{mark}] {r['name'].ljust(width)}  {r['detail']}")
    failed = [r for r in all_results if not r["ok"]]
    print("=" * (width + 40))
    print(f"共 {len(all_results)} 条, 失败 {len(failed)} 条")

    report = {
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "url": url,
        "results": all_results,
        "failed": len(failed),
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"报告: {REPORT.relative_to(REPO)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
