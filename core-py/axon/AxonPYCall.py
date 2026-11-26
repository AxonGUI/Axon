"""Python -> JS 的调用入口。

通道是 ``AxonPYCall``（QWebChannel 上注册的对象）：Python 侧 ``emit`` 一个
``onCallSignal``，JS 侧执行完再调回 ``returnReceiver``，两边用 ``call_id``
配对。这里所有函数都是模块级的，``AxonCall.*`` 只是同一批函数的命名空间别名。
"""

from __future__ import annotations

import threading
import uuid
from concurrent.futures import Future
from typing import TYPE_CHECKING, Any, Callable, Literal, TypeVar, TypedDict, cast

from PySide6.QtCore import QObject, Signal, Slot

from .AxonError import AxonNotConnectedError, AxonTimeoutError, JSRuntimeError

if TYPE_CHECKING:
    from .AxonJSCallHandler import ControllerId, ControllerPropName, WebName

CallId = str
callFutures: dict[CallId, "AxonFuture[Any]"] = {}

T = TypeVar("T")


class AxonFuture(Future[T]):
    """Python -> JS 调用的返回句柄。

    ``concurrent.futures.Future`` 不能被 ``await``, 这里补一个 asyncio 桥接:
    ``await Axon("web").Ctl.func(...)`` 与 ``.result()`` 都能用。
    另外 ``cancel()`` 会顺带把还在等回包的 ``call_id`` 从表里摘掉。
    """

    _cancel_hook: Callable[[], bool] | None = None

    def __await__(self) -> Any:
        import asyncio

        return asyncio.wrap_future(self).__await__()

    def cancel(self) -> bool:
        hook = self._cancel_hook
        if hook is not None and not self.done():
            return hook()
        return super().cancel()


def _expire(call_id: CallId, future: AxonFuture[Any], timeout: float) -> None:
    """超时兜底：JS 一直不回包时把 future 标成 TimeoutError。"""
    if future.done():
        return
    callFutures.pop(call_id, None)
    future.set_exception(AxonTimeoutError(f"延时 {timeout}ms 内 JS 没有返回"))


def cancel(call_id: CallId) -> bool:
    """取消一个还在等回包的调用；返回是否真的取消了。"""
    future = callFutures.pop(call_id, None)
    if future is None:
        return False
    return future.cancel()


def _call(
    web_name: WebName,
    controller_id: ControllerId,
    prop: ControllerPropName,
    args: list[Any] | tuple[Any, ...] = (),
    type: Literal["call", "set", "get"] = "call",
    kwargs: dict[str, Any] | None = None,
    timeout: float | None = None,
) -> AxonFuture[Any]:
    from .AxonGUI import AxonGUI

    future: AxonFuture[Any] = AxonFuture()
    web = AxonGUI.get_web(web_name)
    if web is None:
        future.set_exception(AxonNotConnectedError(f"web `{web_name}` not found"))
        return future

    call_id = str(uuid.uuid4())
    callFutures[call_id] = future
    future._cancel_hook = lambda: cancel(call_id)

    if timeout is not None:
        # 目标窗口没回应时别让调用方永远挂着: 到期把 future 标成超时
        timer = threading.Timer(
            max(timeout, 0) / 1000.0,
            lambda: _expire(call_id, future, timeout),
        )
        timer.daemon = True
        timer.start()
        future.add_done_callback(lambda _f: timer.cancel())

    args_list: list[Any] = list(args)
    kwargs_dict: dict[str, Any] = kwargs or {}
    if getattr(web, "_js_codec", False):
        args_list = codec_encode(args_list)
        kwargs_dict = codec_encode(kwargs_dict)

    data = {
        "call_id": call_id,
        "controller_id": controller_id,
        "prop": prop,
        "args": args_list,
        "kwargs": kwargs_dict,
        "type": type,
    }
    channel = web.get_channel("AxonPYCall")
    if channel is None:
        callFutures.pop(call_id, None)
        future.set_exception(AxonNotConnectedError(f"web `{web_name}` 还没有 AxonPYCall 通道"))
        return future
    cast("AxonPYCall", channel).onCallSignal.emit(data)
    return future


def call(
    web_name: WebName,
    controller_id: ControllerId,
    func: ControllerPropName,
    args: list[Any] | tuple[Any, ...] = (),
    kwargs: dict[str, Any] | None = None,
    timeout: float | None = None,
) -> AxonFuture[Any]:
    """调用某个窗口里的 JS 函数；``timeout`` 单位毫秒。"""
    return _call(
        web_name, controller_id, func, args, "call", kwargs=kwargs, timeout=timeout
    )


def setVar(
    web_name: WebName,
    controller_id: ControllerId,
    var_name: ControllerPropName,
    value: Any,
) -> AxonFuture[Any]:
    """写某个窗口里 JS 对象的一个属性。"""
    return _call(web_name, controller_id, var_name, [value], "set")


def getVar(
    web_name: WebName,
    controller_id: ControllerId,
    var_name: ControllerPropName,
) -> AxonFuture[Any]:
    """读某个窗口里 JS 对象的一个属性。"""
    return _call(web_name, controller_id, var_name, type="get")


def broadcast(
    controller_id: ControllerId,
    func: ControllerPropName,
    args: list[Any] | tuple[Any, ...] = (),
    kwargs: dict[str, Any] | None = None,
    timeout: float | None = None,
    excluding: tuple[str, ...] | list[str] = (),
) -> list[AxonFuture[Any]]:
    """把一次调用发给所有开着的窗口；``excluding`` 里的窗口跳过。"""
    from .AxonGUI import AxonGUI

    futures: list[AxonFuture[Any]] = []
    for web_name in AxonGUI.windows():
        if web_name in excluding:
            continue
        futures.append(
            call(web_name, controller_id, func, args, kwargs=kwargs, timeout=timeout)
        )
    return futures


class _AxonCallNamespace:
    """``AxonCall.*`` 只是四个模块级函数的命名空间，签名完全一致。"""

    call = staticmethod(call)
    setVar = staticmethod(setVar)
    getVar = staticmethod(getVar)
    broadcast = staticmethod(broadcast)


#: 命名空间实例：``AxonCall.call(...)`` 与直接 ``call(...)`` 是同一份实现
AxonCall = _AxonCallNamespace()


class JSRetData(TypedDict):
    call_id: CallId
    state: Literal["resolve", "reject"]
    data: Any


class AxonPYCall(QObject):
    """QWebChannel 对象 ``AxonPYCall``：JS 回包从这里进来。"""

    onCallSignal = Signal(dict)
    hasControllerSignal = Signal(dict)

    @Slot(dict)
    def returnReceiver(self, data: JSRetData) -> None:
        future = callFutures.pop(data.get("call_id"), None)
        if future is None or future.done():
            return
        if data["state"] == "resolve":
            future.set_result(data.get("data"))
        else:
            future.set_exception(JSRuntimeError(data["data"]))


from .AxonCodec import encode as codec_encode  # noqa: E402  (循环导入: 放最后)
