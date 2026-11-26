"""跨窗口调用：在 A 窗口里操作 B 窗口，或者一次打到所有窗口。

一个 Axon 应用可以同时开好几个窗口（每个窗口一个 :class:`~axon.AxonGUI`）。
窗口之间的调用都从这里过一手：Python 是唯一知道「现在有哪些窗口」的地方，
所以跨窗口的路由放在 Python 侧，而不是让窗口之间直接连。

两种用法：

    # 1. 指名道姓调另一个窗口里的 JS 控制器
    from axon import AxonCross

    AxonCross.call("main", "Charts", "reload", "600s").result(5)

    # 2. 一次打到所有窗口
    for web, future in AxonCross.broadcast("Toasts", "show", "已保存").items():
        try:
            future.result(5)
        except Exception as e:
            print(f"{web} 没收到: {e}")

窗口名就是建窗口时给 :class:`~axon.AxonGUI` 的第一个参数。
"""

from __future__ import annotations

import asyncio
from typing import Any, Iterable, Mapping

from .AxonEvent import AxonEvent
from .AxonJSCallHandler import ControllerId, ControllerPropName, WebName
from .AxonPYCall import AxonFuture, call as _py_call

__all__ = [
    "windows",
    "has",
    "call",
    "broadcast",
    "emit",
    "emit_to",
    "results",
]


def windows() -> list[WebName]:
    """当前还活着的窗口名（关掉的窗口会自动从列表里消失）。"""
    from .AxonGUI import AxonGUI

    return AxonGUI.windows()


def has(web_name: WebName) -> bool:
    """这个窗口现在还在不在。"""
    from .AxonGUI import AxonGUI

    return AxonGUI.get_web(web_name) is not None


def call(
    web_name: WebName,
    controller_id: ControllerId,
    func: ControllerPropName,
    *args: Any,
    kwargs: dict[str, Any] | None = None,
    timeout: float | None = None,
) -> AxonFuture[Any]:
    """调另一个窗口里的 JS 控制器方法，返回 Future。

    ``timeout`` 单位是**秒**（和 ``.result(5)`` 一致）；到期还没回应就抛
    :class:`TimeoutError`，不会一直挂着。
    """
    return _py_call(
        web_name,
        controller_id,
        func,
        args,
        kwargs=kwargs,
        timeout=None if timeout is None else timeout * 1000,
    )


def broadcast(
    controller_id: ControllerId,
    func: ControllerPropName,
    *args: Any,
    kwargs: dict[str, Any] | None = None,
    timeout: float | None = None,
    exclude: Iterable[WebName] = (),
) -> dict[WebName, AxonFuture[Any]]:
    """一次调所有窗口（可跳过 sender 之类的窗口），按窗口返回 Future。"""
    from .AxonGUI import AxonGUI

    skipped = set(exclude)
    futures: dict[WebName, AxonFuture[Any]] = {}
    for web_name in AxonGUI.windows():
        if web_name in skipped:
            continue
        futures[web_name] = call(
            web_name,
            controller_id,
            func,
            *args,
            kwargs=kwargs,
            timeout=timeout,
        )
    return futures


def emit(
    type: str, *args: Any, exclude: Iterable[WebName] = ()
) -> list[AxonFuture[Any]]:
    """把一个事件发给所有窗口（对方用 ``AxonEvent.addListener`` 接）。"""
    skipped = set(exclude)
    return [
        AxonEvent.dispatch_js_event(web_name, type, list(args))
        for web_name in windows()
        if web_name not in skipped
    ]


def emit_to(web_name: WebName, type: str, *args: Any) -> AxonFuture[Any]:
    """把一个事件发给指定窗口。"""
    return AxonEvent.dispatch_js_event(web_name, type, list(args))


def results(
    futures: dict[WebName, AxonFuture[Any]], timeout: float | None = None
) -> list[dict[str, Any]]:
    """等一组广播的结果，按窗口给出 ``{web, ok, value|error}``，单窗口失败不影响别人。"""
    out: list[dict[str, Any]] = []
    for web_name, future in futures.items():
        try:
            out.append({"web": web_name, "ok": True, "value": future.result(timeout)})
        except Exception as e:  # noqa: BLE001 - 单个窗口的失败要如实报出来
            out.append({"web": web_name, "ok": False, "error": f"{type(e).__name__}: {e}"})
    return out


async def _wait_call(  # pyright: ignore[reportUnusedFunction]  # 由 AxonJSCallHandler 跨模块调用
    data: Mapping[str, Any],
) -> Any:
    """JS 发来的单点跨窗口调用：转到目标窗口并等结果。"""
    future = call(
        data["web_name"],
        data["controller_id"],
        data["func"],
        *(data.get("args") or []),
        kwargs=data.get("kwargs"),
        timeout=None
        if data.get("timeout") is None
        else data["timeout"] / 1000.0,
    )
    return await asyncio.wrap_future(future)


async def _wait_all(  # pyright: ignore[reportUnusedFunction]  # 由 AxonJSCallHandler 跨模块调用
    futures: dict[WebName, AxonFuture[Any]], timeout_ms: float | None
) -> list[dict[str, Any]]:
    """JS 侧用的异步等待：所有窗口并行等，谁超时只影响它自己。"""

    async def one(web_name: WebName, future: AxonFuture[Any]) -> dict[str, Any]:
        try:
            waiter = asyncio.wrap_future(future)
            if timeout_ms is None:
                value = await waiter
            else:
                value = await asyncio.wait_for(waiter, max(timeout_ms, 0) / 1000.0)
            return {"web": web_name, "ok": True, "value": value}
        except Exception as e:  # noqa: BLE001
            return {
                "web": web_name,
                "ok": False,
                "error": f"{type(e).__name__}: {e}",
            }

    if not futures:
        return []
    return list(await asyncio.gather(*(one(w, f) for w, f in futures.items())))
