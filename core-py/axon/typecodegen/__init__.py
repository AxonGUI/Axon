"""从 Python 控制器生成 TypeScript 类型（以及从前端控制器生成 Python 存根）。

这个包只做「类型」这一件事，不参与运行时：

* :func:`collect` 反射已注册的控制器，得到一份与语言无关的 schema；
* :func:`render_typescript` 把 schema 渲染成 ``.ts``（含模块增强）；
* :func:`render_python` 把前端控制器的形状渲染成 ``.pyi``；
* :func:`main` 是 ``axon-gui types`` 的实现。

设计取舍（见文档 ``guide/types``）：

* 生成是**构建期**的，产物进仓库，CI 用 ``--check`` 防止漂移；
* 类型节点是一棵中性树（``{"t": "number"}`` 这类），一份 schema 两个渲染器，
  不各自解析注解；
* 反射用 ``typing.get_type_hints``，所以 ``from __future__ import annotations``
  的字符串注解也能解析。
"""

from __future__ import annotations

from typing import Any

from .schema import SchemaError, collect
from .tsgen import render_typescript

__all__ = ["SchemaError", "collect", "render_typescript", "render_python", "main"]


def render_python(
    controllers: list[dict[str, Any]],
    *,
    source: str = "",
) -> str:  # 延迟导入: 只有反向生成才需要
    from .pygen import render_python as _render

    return _render(controllers, source=source)


def main(argv: list[str] | None = None) -> int:
    from .cli import main as _main

    return _main(argv)
