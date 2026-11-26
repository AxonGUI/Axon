"""Axon 的异常基类。

两端各有一套，但语义对齐：

- ``AxonTimeoutError`` —— 等不到对端回包（Python 侧同时是内置 ``TimeoutError``）
- ``JSRuntimeError``   —— JS 侧抛出、Python 侧收到
- ``AxonNotConnectedError`` —— 目标窗口不存在 / 通道没连好
"""

from __future__ import annotations


class AxonError(Exception):
    """所有 Axon 异常的基类；``code`` 是稳定的机器可读错误码。"""

    code = "AXON"


class AxonTimeoutError(AxonError, TimeoutError):
    """等不到对端回包。"""

    code = "TIMEOUT"


class AxonNotConnectedError(AxonError):
    """目标窗口不存在（或已经关掉）。"""

    code = "NOT_CONNECTED"


class JSRuntimeError(AxonError):
    """JS 侧抛出、被转成 Python 异常。"""

    code = "JS_RUNTIME"
