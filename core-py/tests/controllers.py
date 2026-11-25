"""验证台用的 Python 控制器 —— 只暴露接口, 不含业务逻辑。"""

from __future__ import annotations

import asyncio
import threading
import time

from axon import Axon, AxonAsset, AxonController, AxonEvent, AxonStore

TEST_WEB = "testWeb"


def _tiny_png(width: int = 32, height: int = 16, color=(52, 81, 178)) -> bytes:
    import struct
    import zlib

    raw = b"".join(b"\x00" + bytes(color) * width for _ in range(height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )

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

    # ---- 二进制：走 axon:// URL，不走通道 ----
    def asset_image(self):
        return AxonAsset.from_bytes(_tiny_png(), name="chart.png")

    def asset_blob(self, size: int = 1_000_000):
        return AxonAsset.from_bytes(bytes((i * 7) % 251 for i in range(size)), name="blob.bin")

    def asset_text_file(self):
        import tempfile

        path = tempfile.mkdtemp() + "/hello.txt"
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("hello from disk")
        return AxonAsset.from_file(path)

    def asset_count(self):
        return AxonAsset.count()

    def asset_release(self, url):
        return AxonAsset.release(url)

    def big_text(self, n: int = 1024 * 1024):
        """可压缩的大字符串（测压缩通道）。"""
        row = '{"sym":"600000.SH","px":12.34,"ts":1764000000}'
        return (row * (int(n) // len(row) + 1))[: int(n)]

    def text_len(self, text):
        return len(text)

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
