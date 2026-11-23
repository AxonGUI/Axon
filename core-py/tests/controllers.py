"""验证台用的 Python 控制器 —— 只暴露接口, 不含业务逻辑。"""

from __future__ import annotations

import asyncio
import threading
import time

from axon import Axon, AxonController, AxonEvent, AxonStore

TEST_WEB = "testWeb"

# store 在窗口创建前就建好（此时 AxonCall 发不出去, 属预期, 会在失败 Future 里体现）
store = AxonStore("teststore", TEST_WEB)


@AxonController(TEST_WEB)
class TestController:
    def __init__(self) -> None:
        self.counter = 0
        self.pong_log: list = []
        AxonEvent.add_listener("pong", self._on_pong)

    def _on_pong(self, *args):
        self.pong_log.append(list(args))

    # ---- JS -> PY ----
    def add(self, a, b):
        return a + b

    def with_kwargs(self, a, b=0):
        return a + b

    async def async_echo(self, s):
        await asyncio.sleep(0)
        return f"{s}:async"

    def sleep(self, ms):
        time.sleep(ms / 1000)
        return "done"

    def boom(self):
        raise ValueError("py-boom")

    def get_counter(self):
        return self.counter

    # ---- PY -> JS ----
    def call_js_echo(self, *args):
        return Axon(TEST_WEB).JSBridge.echo(*args).result(5)

    async def call_js_async(self, *args):
        # 走 __await__（asyncio 桥接）而不是 .result()
        return await Axon(TEST_WEB).JSBridge.asyncEcho(*args)

    def read_js_value(self):
        return Axon(TEST_WEB).JSBridge.value.get(5)

    def write_js_value(self, value):
        Axon(TEST_WEB).JSBridge.value = value
        return True

    def call_js_boom(self):
        return Axon(TEST_WEB).JSBridge.boom().result(5)

    def call_js_kwargs(self, a, b):
        return Axon(TEST_WEB).JSBridge.echo(a, b=b).result(5)

    # ---- store ----
    def store_read(self, k):
        return store.prop(k).get()

    def store_write(self, k, v):
        store.prop(k).set(v)
        return True

    # ---- event ----
    def dispatch_ping(self, msg):
        AxonEvent.dispatch_js_event(TEST_WEB, "ping", [msg])
        return True

    def get_pong_log(self):
        return self.pong_log


# 多 web 装饰器（纯 Python 侧断言用）
@AxonController(["multiA", "multiB"], id="MultiWebController")
class MultiWebController:
    def ping(self):
        return "pong"


THREAD_SENTINEL = threading.get_ident()
