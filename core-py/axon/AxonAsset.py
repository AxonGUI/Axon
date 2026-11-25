"""把内存里的字节变成一个 URL，交给 Chromium 自己去取。

为什么需要：图片 / PDF / 视频 / 大附件如果走通道，要先 base64（+33%），再塞进 JSON，
两端各复制一遍；走自定义协议则由 WebEngine 流式读取，前端就是普通的 ``<img src>`` / ``fetch``。

用法::

    from axon import AxonAsset

    url = AxonAsset.register(png_bytes, name="chart.png")   # axon://asset/<token>/chart.png
    url = AxonAsset.register_file("/tmp/report.pdf")
    AxonAsset.release(url)          # 用完释放（不释放也能用到进程结束）

协议地址形如 ``axon://asset/<token>/<显示用文件名>``；token 决定内容，文件名只影响
``Content-Type`` 推断与下载时的默认名。
"""

from __future__ import annotations

import mimetypes
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SCHEME = "axon"
HOST = "asset"

_lock = threading.RLock()


@dataclass
class Asset:
    token: str
    name: str
    mime: str
    data: bytes


_assets: dict[str, Asset] = {}


def _guess_mime(name: str) -> str:
    guessed, _ = mimetypes.guess_type(name)
    return guessed or "application/octet-stream"


def _make_url(token: str, name: str) -> str:
    safe = name.replace("\\", "/").split("/")[-1] or "blob"
    return f"{SCHEME}://{HOST}/{token}/{safe}"


def register(data: bytes | bytearray | memoryview, name: str = "blob", mime: str | None = None) -> str:
    """把一段字节登记成 URL。返回的字符串可以直接给前端用。"""
    payload = bytes(data)
    token = uuid.uuid4().hex
    asset = Asset(token=token, name=name, mime=mime or _guess_mime(name), data=payload)
    with _lock:
        _assets[token] = asset
    return _make_url(token, name)


def register_file(path: str | Path, name: str | None = None) -> str:
    """把一个本地文件登记成 URL（内容读进内存；大文件也走这条路，但受内存限制）。"""
    file_path = Path(path)
    data = file_path.read_bytes()
    return register(data, name=name or file_path.name)


def _token_of(url_or_token: str) -> str:
    text = str(url_or_token)
    if text.startswith(f"{SCHEME}://"):
        parts = text[len(f"{SCHEME}://") :].split("/")
        # 形如 asset/<token>/<name>
        return parts[1] if len(parts) > 1 else ""
    return text


def lookup(url_or_token: str) -> Asset | None:
    """按 URL 或 token 取内容（给协议处理器用）。"""
    token = _token_of(url_or_token)
    with _lock:
        return _assets.get(token)


def release(url_or_token: str) -> bool:
    token = _token_of(url_or_token)
    with _lock:
        return _assets.pop(token, None) is not None


def clear() -> int:
    with _lock:
        count = len(_assets)
        _assets.clear()
    return count


def count() -> int:
    with _lock:
        return len(_assets)


# —— 模块级快捷函数（也可以写成 AxonAsset.register(...)）——

def register_asset(data: bytes | bytearray | memoryview, name: str = "blob", mime: str | None = None) -> str:
    return register(data, name=name, mime=mime)


def register_asset_file(path: str | Path, name: str | None = None) -> str:
    return register_file(path, name=name)
