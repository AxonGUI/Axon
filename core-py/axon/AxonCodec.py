"""跨端大字符串的透明压缩。

只在两端都声明支持时启用（握手见 ``AxonEnv.supports_codec`` / ``AxonEnv.codec``），
因此对老版本客户端/库完全无影响。规则：

- 只压 ``str``，且长度 ≥ :data:`GZ_THRESHOLD`、压完（含 base64）比原来小 10% 以上；
- 压过的值换成一个单键对象 ``{"__axon_gz": "<base64>"}``；
- 用户自己的数据里如果正好有 ``__axon_gz`` 键，包一层 ``{"__axon_esc": ...}`` 以免被误当压缩块；
- 解码是逆过程，遇到不认识的形状原样返回。
"""

from __future__ import annotations

import base64
import gzip
from typing import Any

GZ_THRESHOLD = 256 * 1024
MIN_RATIO = 0.9
_GZ_KEY = "__axon_gz"
_ESC_KEY = "__axon_esc"


def _encode_str(value: str) -> Any:
    if len(value) < GZ_THRESHOLD:
        return value
    packed = base64.b64encode(gzip.compress(value.encode("utf-8"), 1)).decode("ascii")
    if len(packed) < len(value) * MIN_RATIO:
        return {_GZ_KEY: packed}
    return value


def encode(value: Any) -> Any:
    """把值里的大字符串换成压缩块（递归处理 dict / list / tuple）。"""
    if isinstance(value, str):
        return _encode_str(value)
    if isinstance(value, dict):
        if _GZ_KEY in value:
            return {_ESC_KEY: value}
        return {key: encode(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [encode(item) for item in value]
    return value


def _decode_str(value: Any) -> Any:
    if not isinstance(value, dict) or len(value) != 1:
        return value
    if _GZ_KEY in value:
        packed = value[_GZ_KEY]
        if isinstance(packed, str):
            return gzip.decompress(base64.b64decode(packed)).decode("utf-8")
        return value
    if _ESC_KEY in value:
        return value[_ESC_KEY]
    return value


def decode(value: Any) -> Any:
    """把压缩块还原成原字符串（递归）。"""
    if isinstance(value, dict):
        if len(value) == 1 and (_GZ_KEY in value or _ESC_KEY in value):
            return _decode_str(value)
        return {key: decode(item) for key, item in value.items()}
    if isinstance(value, list):
        return [decode(item) for item in value]
    return value
