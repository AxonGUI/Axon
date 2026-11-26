"""把 schema 渲染成 TypeScript（``AxonRegistry`` + 模块增强）。

产物由 ``axon-gui types`` 写入项目，正常情况下不进版本控制之外的人工修改——
CI 用 ``--check`` 比对「现算的」与「磁盘上的」是否一致。
"""

from __future__ import annotations

import json
import keyword
import re
from typing import Any

_IDENT = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")
_TS_RESERVED = {"delete", "new", "default", "class", "function", "in", "for", "while", "return"}


def render_typescript(schema: dict[str, Any], *, source: str = "") -> str:
    """渲染成一份 ``.ts`` 文件内容。"""
    lines: list[str] = []
    lines.append("/**")
    lines.append(" * 由 `axon-gui types` 生成，请勿手改。")
    lines.append(f" * axon-gui {schema.get('axonVersion', '?')} · schema v{schema.get('schemaVersion', '?')}")
    lines.append(" */")
    lines.append("")

    controllers = schema.get("controllers", [])
    lines.append("export interface AxonRegistry {")
    if not controllers:
        lines.append("  // 没有发现任何控制器：确认 `axon-gui types --controllers <模块>` 指对了")
    for controller in controllers:
        lines.extend(_render_controller(controller))
    lines.append("}")
    lines.append("")
    lines.append("declare module \"axon-gui\" {")
    lines.append("  interface AxonControllers extends AxonRegistry {}")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def _render_controller(controller: dict[str, Any]) -> list[str]:
    webs = ", ".join(controller.get("webs") or []) or "?"
    out = [f"  /** 窗口: {webs} */"]
    key = _key(controller["id"])
    out.append(f"  {key}: {{")
    for method in controller.get("methods", []):
        out.extend(_render_method(method))
    for prop in controller.get("properties", []):
        out.append(f"    /** 属性（读要 await，写走 setVar） */")
        out.append(f"    {_key(prop['name'])}: {render_type(prop['type'])};")
    out.append("  };")
    return out


def _render_method(method: dict[str, Any]) -> list[str]:
    params: list[str] = []
    for param in method.get("params", []):
        rendered = render_type(param["type"])
        name = param["name"]
        if param.get("variadic"):
            params.append(f"...{name}: {rendered}")
            continue
        if param.get("keyword"):
            params.append(f"{name}?: {rendered}")
            continue
        optional = "?" if param.get("optional") else ""
        params.append(f"{name}{optional}: {rendered}")
    returns = render_type(method.get("returns", {"t": "unknown"}))
    # Python 侧不管是不是 async def，JS 侧拿到的都是 Promise
    return [f"    {_key(method['name'])}({', '.join(params)}): Promise<{returns}>;"]


def render_type(node: dict[str, Any]) -> str:
    """中性类型节点 → TS 类型文本。"""
    kind = node.get("t")
    if kind == "number":
        return "number"
    if kind == "string":
        return "string"
    if kind == "boolean":
        return "boolean"
    if kind == "null":
        return "null"
    if kind == "any":
        return "any"
    if kind == "unknown":
        return "unknown"
    if kind == "literal":
        return json.dumps(node.get("value"), ensure_ascii=False)
    if kind == "array":
        inner = render_type(node.get("of", {"t": "unknown"}))
        return f"Array<{inner}>"
    if kind == "tuple":
        return "[" + ", ".join(render_type(item) for item in node.get("of", [])) + "]"
    if kind == "record":
        return f"Record<string, {render_type(node.get('value', {'t': 'unknown'}))}>"
    if kind == "map":
        return f"Record<{render_type(node.get('key', {'t': 'string'}))}, {render_type(node.get('value', {'t': 'unknown'}))}>"
    if kind == "object":
        props = node.get("props") or []
        if not props:
            return "Record<string, unknown>"
        inner = "; ".join(
            f"{_key(prop['name'])}{'?' if prop.get('optional') else ''}: {render_type(prop['type'])}"
            for prop in props
        )
        return f"{{ {inner} }}"
    if kind == "union":
        parts = [render_type(item) for item in node.get("of", [])]
        deduped = list(dict.fromkeys(parts))
        if not deduped:
            return "unknown"
        return " | ".join(deduped)
    return "unknown"


def _key(name: str) -> str:
    """不是合法标识符、或是 TS 关键字时给键加引号。"""
    if _IDENT.match(name) and name not in _TS_RESERVED and not keyword.iskeyword(name):
        return name
    return json.dumps(name, ensure_ascii=False)
