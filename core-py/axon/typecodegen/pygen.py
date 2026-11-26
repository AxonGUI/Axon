"""把前端控制器的形状渲染成 Python 存根（``Protocol`` + ``connect()``）。

Python 没有 TypeScript 的「模块增强」，所以拿补全的方式是一个生成出来的入口：

    from controller.js_controllers import connect
    api = connect("MainView")
    api.DocsJS.mirror({...}, "标签")

生成物是普通的 ``.py``（不是 ``.pyi``），因为 ``connect()`` 需要真实运行。
"""

from __future__ import annotations

import json
import re
from typing import Any

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_PY_RESERVED = {
    "class",
    "def",
    "from",
    "import",
    "lambda",
    "None",
    "True",
    "False",
    "global",
    "nonlocal",
    "pass",
    "return",
    "yield",
    "while",
    "for",
    "in",
    "is",
    "not",
    "and",
    "or",
    "if",
    "else",
    "elif",
    "try",
    "except",
    "finally",
    "with",
    "as",
    "assert",
    "del",
    "raise",
    "await",
    "async",
    "match",
    "case",
}


def render_python(controllers: list[dict[str, Any]], *, source: str = "") -> str:
    lines = [
        '"""由 `axon-gui types --js` 生成，请勿手改。',
        "",
    ]
    lines.append("用法:")
    lines.extend(
        [
            "",
            "    from controller.js_controllers import connect",
            "",
            "    api = connect(\"MainView\")",
            "    api.DocsJS.mirror({\"hello\": \"world\"})",
            '"""',
            "",
            "from __future__ import annotations",
            "",
            "from typing import Any, Protocol, cast",
            "",
        ]
    )

    if not controllers:
        lines.append("# 没有在前端源码里找到 AxonController.register(...)")

    for controller in controllers:
        name = _safe_name(controller["name"])
        lines.append(f"class {name}(Protocol):")
        lines.append('    """前端注册的控制器。"""')
        members = controller.get("members") or []
        if not members:
            lines.append("    ...")
        for member in members:
            lines.extend(_render_member(member))
        lines.append("")

    lines.append("class AxonJsApi(Protocol):")
    lines.append('    """所有已注册的前端控制器（跨窗口时是并集）。"""')
    for controller in controllers:
        lines.append(f"    {_safe_name(controller['name'])}: {_safe_name(controller['name'])}")
    if not controllers:
        lines.append("    ...")
    lines.append("")
    lines.extend(
        [
            "def connect(web_name: str = \"*\") -> AxonJsApi:",
            '    """拿到带类型的前端控制器入口。运行时就是 ``Axon(web_name)``。"""',
            "    from axon import Axon",
            "",
            "    return cast(AxonJsApi, Axon(web_name))",
            "",
        ]
    )
    return "\n".join(lines)


def _render_member(member: dict[str, Any]) -> list[str]:
    name = _safe_member(member["name"])
    if member.get("kind") == "prop":
        annotation = render_type(member.get("type"))
        optional = " | None" if member.get("optional") else ""
        return [f"    {name}: {annotation}{optional}"]

    params: list[str] = ["self"]
    for param in member.get("params") or []:
        annotation = render_type(param.get("type"))
        if param.get("optional"):
            params.append(f"{_safe_member(param['name'])}: {annotation} | None = None")
        else:
            params.append(f"{_safe_member(param['name'])}: {annotation}")
    returns = render_type(member.get("ret"))
    if returns == "None":
        returns = "None"
    return [f"    def {name}({', '.join(params)}) -> {returns}: ..."]


_TS_TO_PY = {
    "number": "float",
    "string": "str",
    "boolean": "bool",
    "any": "Any",
    "unknown": "Any",
    "void": "None",
    "null": "None",
    "undefined": "None",
    "object": "dict[str, Any]",
    "bigint": "int",
}


def render_type(node: str | None) -> str:
    if not node:
        return "Any"
    text = node.strip()

    # Promise<T> 在 Python 侧就是 T：JS 侧的 async 方法到 Python 变成「拿到结果要 .result()」
    promise = re.match(r"^Promise<(.+)>$", text, re.S)
    if promise:
        return render_type(promise.group(1))

    # 数组
    array = re.match(r"^Array<(.+)>$", text, re.S)
    if array:
        return f"list[{render_type(array.group(1))}]"
    if text.endswith("[]"):
        return f"list[{render_type(text[:-2])}]"

    # 联合
    if "|" in text and "<" not in text.split("|")[0]:
        parts = [render_type(part) for part in text.split("|")]
        return " | ".join(dict.fromkeys(parts))

    lowered = text.lower()
    if lowered in _TS_TO_PY:
        return _TS_TO_PY[lowered]

    # 字面量
    if re.match(r'^".*"$', text) or re.match(r"^'.*'$", text):
        return "str"
    if re.match(r"^-?\d+(\.\d+)?$", text):
        return "float"

    # 内联对象类型：{ a: string; b?: number }
    if text.startswith("{") and text.endswith("}"):
        inner = text[1:-1].strip()
        if not inner:
            return "dict[str, Any]"
        fields = []
        for piece in _split_fields(inner):
            field, _, field_type = piece.partition(":")
            key = field.strip().rstrip("?")
            optional = field.strip().endswith("?")
            if not _IDENT.match(key):
                return "dict[str, Any]"
            fields.append(f"{key}{'?' if optional else ''}: {render_type(field_type.strip())}")
        if not fields:
            return "dict[str, Any]"
        return "dict[str, Any]"

    # Record<K, V>
    record = re.match(r"^Record<(.+),\s*(.+)>$", text, re.S)
    if record:
        return "dict[str, Any]"

    # 已知的标识符当作用户自定义类型名（TS 侧接口），Python 侧没有对应物，回退 Any
    return "Any"


def _split_fields(inner: str) -> list[str]:
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for char in inner:
        if char in "<{([":
            depth += 1
        elif char in ">})]":
            depth -= 1
        if char in ";," and depth == 0:
            parts.append("".join(current))
            current = []
            continue
        current.append(char)
    if current:
        parts.append("".join(current))
    return [part.strip() for part in parts if part.strip()]


def _safe_name(name: str) -> str:
    if _IDENT.match(name) and name not in _PY_RESERVED:
        return name
    return "_" + re.sub(r"\W", "_", name)


def _safe_member(name: str) -> str:
    return _safe_name(name)


def dump(controllers: list[dict[str, Any]]) -> str:
    """调试用：把抽取结果打成 JSON。"""
    return json.dumps(controllers, ensure_ascii=False, indent=2)
