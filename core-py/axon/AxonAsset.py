"""把字节（或本地文件）变成一个 URL，交给 Chromium 自己去取。

为什么需要：图片 / PDF / 视频 / 大附件如果走通道，要先 base64（+33%），再塞进 JSON，
两端各复制一遍；走自定义协议则由 WebEngine 直接读取，前端就是普通的 ``<img src>`` / ``fetch``。

用法::

    from axon import AxonAsset

    url = AxonAsset.from_bytes(png_bytes, name="chart.png")  # axon://asset/<token>/chart.png
    url = AxonAsset.from_file("/tmp/report.pdf")             # 文件不进内存，请求时再读
    AxonAsset.release(url)                                   # 用完释放（不释放也能用到进程结束）

协议地址形如 ``axon://asset/<token>/<显示用文件名>``：token 决定内容，文件名只影响
``Content-Type`` 推断与下载时的默认名。

命名说明：早先这几个入口叫 ``register`` / ``register_file``，与「把对象注册到某个窗口」
（``AxonController.register``）撞了语义，已改名并保留旧名为弃用别名。
"""

from __future__ import annotations

import mimetypes
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

SCHEME = "axon"
HOST = "asset"

_lock = threading.RLock()


# 自动回收：空闲超过 TTL 的资产会被清理；字节总量超过 BUDGET 时按最久未用淘汰。
# 想关掉或调整：环境变量 AXON_ASSET_TTL（秒，<=0 表示不按时间回收）、
# AXON_ASSET_BUDGET_MB（<=0 表示不限），或运行期 AxonAsset.configure(...)。
DEFAULT_TTL = 600.0          # 10 分钟
DEFAULT_BUDGET = 256 << 20   # 256 MB（只算 bytes 类资产；文件类不占内存）


@dataclass
class Asset:
    """一条已登记的资产：内存里的字节，或者一个待读取的本地文件。"""

    token: str
    name: str
    mime: str
    data: bytes | None = None
    path: Path | None = None
    created: float = field(default_factory=time.monotonic)
    last_used: float = field(default_factory=time.monotonic)

    @property
    def size(self) -> int:
        if self.data is not None:
            return len(self.data)
        if self.path is not None:
            try:
                return self.path.stat().st_size
            except OSError:
                return 0
        return 0


_assets: dict[str, Asset] = {}

_settings = {
    "ttl": float(os.environ.get("AXON_ASSET_TTL", DEFAULT_TTL) or 0),
    "budget": int(float(os.environ.get("AXON_ASSET_BUDGET_MB", DEFAULT_BUDGET >> 20) or 0) * (1 << 20)),
}
_sweeper_started = False
_stop = threading.Event()


def configure(ttl: float | None = None, budget: int | None = None) -> None:
    """调整自动回收参数：``ttl`` 秒（<=0 不按时间回收）、``budget`` 字节（<=0 不限）。"""
    with _lock:
        if ttl is not None:
            _settings["ttl"] = float(ttl)
        if budget is not None:
            _settings["budget"] = int(budget)


def _ensure_sweeper() -> None:
    global _sweeper_started
    if _sweeper_started:
        return
    _sweeper_started = True
    thread = threading.Thread(target=_sweep_loop, name="axon-asset-sweeper", daemon=True)
    thread.start()


def _sweep_loop() -> None:
    while not _stop.wait(15.0):
        try:
            sweep()
        except Exception:  # 回收失败绝不能影响主流程
            pass


def sweep(now: float | None = None) -> int:
    """清一次：先按空闲时间，再按总字节预算（最久未用优先）。返回清掉的条数。"""
    moment = time.monotonic() if now is None else now
    with _lock:
        ttl = _settings["ttl"]
        budget = _settings["budget"]
        gone = 0
        if ttl > 0:
            for token, asset in list(_assets.items()):
                if moment - asset.last_used > ttl:
                    _assets.pop(token, None)
                    gone += 1
        if budget > 0:
            total = sum(len(a.data) for a in _assets.values() if a.data is not None)
            if total > budget:
                for asset in sorted(_assets.values(), key=lambda a: a.last_used):
                    if total <= budget:
                        break
                    if asset.data is None:
                        continue
                    total -= len(asset.data)
                    _assets.pop(asset.token, None)
                    gone += 1
        return gone


def _guess_mime(name: str) -> str:
    guessed, _ = mimetypes.guess_type(name)
    return guessed or "application/octet-stream"


def _make_url(token: str, name: str) -> str:
    safe = name.replace("\\", "/").split("/")[-1] or "blob"
    return f"{SCHEME}://{HOST}/{token}/{safe}"


def from_bytes(
    data: bytes | bytearray | memoryview,
    name: str = "blob",
    mime: str | None = None,
) -> str:
    """把一段字节变成一个 URL。返回的字符串可以直接给前端用。"""
    payload = bytes(data)
    token = uuid.uuid4().hex
    asset = Asset(token=token, name=name, mime=mime or _guess_mime(name), data=payload)
    with _lock:
        _assets[token] = asset
        _ensure_sweeper()
        _enforce_budget_locked()
    return _make_url(token, name)


def from_file(path: str | Path, name: str | None = None, mime: str | None = None) -> str:
    """把一个本地文件变成一个 URL。

    文件内容**不读进内存**：请求到达时才打开读取，所以几百 MB 的视频 / 安装包也可以。
    文件被删除或移动后该 URL 会返回 404。
    """
    file_path = Path(path).expanduser()
    if not file_path.is_file():
        raise FileNotFoundError(f"没有这个文件：{file_path}")
    token = uuid.uuid4().hex
    display = name or file_path.name
    asset = Asset(
        token=token,
        name=display,
        mime=mime or _guess_mime(display),
        path=file_path.resolve(),
    )
    with _lock:
        _assets[token] = asset
        _ensure_sweeper()
        _enforce_budget_locked()
    return _make_url(token, display)


def _token_of(url_or_token: str) -> str:
    text = str(url_or_token)
    if text.startswith(f"{SCHEME}://"):
        parts = text[len(f"{SCHEME}://") :].split("/")
        # 形如 asset/<token>/<name>
        return parts[1] if len(parts) > 1 else ""
    return text


def lookup(url_or_token: str) -> Asset | None:
    """按 URL 或 token 取资产（给协议处理器用）；取用会刷新空闲计时。"""
    token = _token_of(url_or_token)
    with _lock:
        asset = _assets.get(token)
        if asset is not None:
            asset.last_used = time.monotonic()
        return asset


def _enforce_budget_locked() -> None:
    """新资产进来时如果超预算，立刻按最久未用淘汰（调用方已持锁）。"""
    budget = _settings["budget"]
    if budget <= 0:
        return
    total = sum(len(a.data) for a in _assets.values() if a.data is not None)
    if total <= budget:
        return
    for asset in sorted(_assets.values(), key=lambda a: a.last_used):
        if total <= budget:
            break
        if asset.data is None:
            continue
        total -= len(asset.data)
        _assets.pop(asset.token, None)


def release(url_or_token: str) -> bool:
    """释放一条资产；返回是否真的存在。"""
    token = _token_of(url_or_token)
    with _lock:
        return _assets.pop(token, None) is not None


def clear() -> int:
    """清空所有资产，返回清掉的条数。"""
    with _lock:
        count = len(_assets)
        _assets.clear()
    return count


def count() -> int:
    with _lock:
        return len(_assets)
