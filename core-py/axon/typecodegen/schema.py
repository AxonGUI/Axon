"""反射已注册的控制器，产出与语言无关的类型 schema。

schema 的形状（``schemaVersion`` 变了就说明下游渲染器要跟着改）::

    {
      "schemaVersion": 1,
      "axonVersion": "5.5.0",
      "controllers": [
        {
          "id": "DemoController",
          "webs": ["AxonDocs"],
          "methods": [
            {
              "name": "add",
              "async": false,
              "params": [
                {"name": "a", "type": {"t": "number"}, "optional": false}
              ],
              "returns": {"t": "number"}
            }
          ],
          "properties": [
            {"name": "counter", "type": {"t": "number"}}
          ]
        }
      ]
    }

类型节点（只列渲染器要处理的）::

    {"t": "number" | "string" | "boolean" | "null" | "any" | "unknown"}
    {"t": "array", "of": <node>}
    {"t": "record", "value": <node>}              # dict[str, V]
    {"t": "map", "key": <node>, "value": <node>}  # dict[K, V]，K 不是 str
    {"t": "object", "props": [{"name", "type", "optional"}]}
    {"t": "union", "of": [<node>, ...]}
    {"t": "literal", "value": <json 标量>}
    {"t": "tuple", "of": [<node>, ...]}
"""

from __future__ import annotations

import dataclasses
import datetime
import decimal
import enum
import inspect
import sys
import types
import typing
import uuid
from pathlib import Path
from typing import Any

MAX_DEPTH = 4
"""对象递归的深度上限：再深的类型对补全没有价值，只会把接口撑爆。"""


class SchemaError(RuntimeError):
    """反射过程中遇到无法继续的情况（例如注册的「类」其实是实例）。"""


_SCALARS: dict[Any, str] = {
    int: "number",
    float: "number",
    decimal.Decimal: "number",
    str: "string",
    bool: "boolean",
    type(None): "null",
    Any: "any",
    object: "unknown",
    list: "array",
    dict: "record",
    datetime.datetime: "string",
    datetime.date: "string",
    datetime.time: "string",
    uuid.UUID: "string",
    bytes: "string",
}


def type_node(annotation: Any, _depth: int = 0, _seen: frozenset[Any] = frozenset()) -> dict[str, Any]:
    """把 Python 注解翻译成中性类型节点。认不出来的一律 ``unknown``。"""
    if annotation is inspect.Parameter.empty or annotation is None:
        return {"t": "unknown"}

    # 字符串注解（没写 from __future__ import annotations 但被写成字符串）
    if isinstance(annotation, str):
        return _type_node_from_string(annotation)

    if annotation in _SCALARS:
        scalar = _SCALARS[annotation]
        if scalar == "array":
            return {"t": "array", "of": {"t": "unknown"}}
        if scalar == "record":
            return {"t": "record", "value": {"t": "unknown"}}
        return {"t": scalar}

    # bool 是 int 的子类，上面的 dict 查表已经处理；这里处理枚举
    if isinstance(annotation, type) and issubclass(annotation, enum.Enum):
        values = [{"t": "literal", "value": member.value} for member in annotation]
        if not values:
            return {"t": "string"}
        return values[0] if len(values) == 1 else {"t": "union", "of": values}

    origin = typing.get_origin(annotation)
    args = typing.get_args(annotation)

    if origin in (list, typing.List):
        return {"t": "array", "of": type_node(args[0], _depth, _seen) if args else {"t": "unknown"}}
    if origin in (set, frozenset, typing.Set, typing.FrozenSet):
        return {"t": "array", "of": type_node(args[0], _depth, _seen) if args else {"t": "unknown"}}
    if origin in (tuple, typing.Tuple):
        return {"t": "tuple", "of": [type_node(a, _depth, _seen) for a in args]}
    if origin in (dict, typing.Dict):
        if len(args) == 2:
            key = type_node(args[0], _depth, _seen)
            value = type_node(args[1], _depth, _seen)
            if key == {"t": "string"}:
                return {"t": "record", "value": value}
            return {"t": "map", "key": key, "value": value}
        return {"t": "record", "value": {"t": "unknown"}}
    if origin is typing.Literal:
        if not args:
            return {"t": "unknown"}
        literals = [{"t": "literal", "value": a} for a in args]
        return literals[0] if len(literals) == 1 else {"t": "union", "of": literals}
    if origin is typing.Annotated:
        return type_node(args[0], _depth, _seen) if args else {"t": "unknown"}
    if origin in (typing.Union, types.UnionType):
        return {"t": "union", "of": [type_node(a, _depth, _seen) for a in args]}
    if origin is not None:
        # 其它泛型（Iterator/Coroutine/...）：这些不是数据形状，不展开
        return {"t": "unknown"}

    # 用户定义的类型：dataclass / TypedDict / Pydantic / 普通类
    if isinstance(annotation, type):
        if annotation in _seen or _depth >= MAX_DEPTH:
            return {"t": "unknown"}
        return _class_node(annotation, _depth + 1, _seen | {annotation})

    return {"t": "unknown"}


def _type_node_from_string(text: str) -> dict[str, Any]:
    """兜底解析 ``"int"`` / ``"list[str]"`` 这类字符串注解。"""
    simple = {
        "int": "number",
        "float": "number",
        "str": "string",
        "bool": "boolean",
        "None": "null",
        "Any": "any",
        "object": "unknown",
        "bytes": "string",
    }
    text = text.strip()
    if text in simple:
        return {"t": simple[text]}
    if text.startswith("list[") or text.startswith("List["):
        inner = text[text.index("[") + 1 : -1]
        return {"t": "array", "of": _type_node_from_string(inner)}
    if text.startswith("dict[str,") or text.startswith("Dict[str,"):
        inner = text[text.index(",") + 1 : -1]
        return {"t": "record", "value": _type_node_from_string(inner)}
    return {"t": "unknown"}


def _class_node(cls: type, depth: int, seen: frozenset[Any]) -> dict[str, Any]:
    """dataclass / TypedDict / pydantic 模型展开成 object 节点，其它类算 unknown。"""
    props: list[dict[str, Any]] = []

    if dataclasses.is_dataclass(cls):
        for f in dataclasses.fields(cls):
            optional = f.default is not dataclasses.MISSING or f.default_factory is not dataclasses.MISSING
            props.append({"name": f.name, "type": type_node(f.type, depth, seen), "optional": optional})
        return {"t": "object", "props": props}

    if typing.is_typeddict(cls):
        required: frozenset[str] = getattr(cls, "__required_keys__", frozenset())
        for name, annotation in typing.get_type_hints(cls).items():
            props.append({"name": name, "type": type_node(annotation, depth, seen), "optional": name not in required})
        return {"t": "object", "props": props}

    model_fields = getattr(cls, "model_fields", None)  # pydantic v2
    if isinstance(model_fields, dict):
        for name, field in model_fields.items():
            optional = not getattr(field, "is_required", lambda: True)()
            props.append({"name": name, "type": type_node(field.annotation, depth, seen), "optional": optional})
        return {"t": "object", "props": props}

    return {"t": "unknown"}


def _is_property(value: Any) -> bool:
    return isinstance(value, property) or inspect.isdatadescriptor(value)


INTERNAL_CONTROLLERS = frozenset(
    {
        "AxonCrossCallHandler",
        "PYAxonStoreSyncManager",
        "JSAxonStoreSyncManager",
    }
)
"""框架自己的转接台，不是给用户补全用的。"""


def collect(
    *modules: str,
    version: str | None = None,
    include_internal: bool = False,
) -> dict[str, Any]:
    """导入若干模块（触发 ``@AxonController`` 注册），把注册表反射成 schema。"""
    import importlib

    from ..AxonJSCallHandler import controllerClassDict

    for module in modules:
        name = module
        if "/" in module or "\\" in module:
            # 允许写成路径（`--controllers ../controller`）：把它的父目录放进 sys.path
            candidate = Path(module).resolve()
            if candidate.is_dir():
                sys.path.insert(0, str(candidate.parent))
                name = candidate.name
        importlib.import_module(name)

    controllers: dict[str, dict[str, Any]] = {}
    for web_name, entries in controllerClassDict.items():
        for controller_id, meta in entries.items():
            if not include_internal and controller_id in INTERNAL_CONTROLLERS:
                continue
            klass = meta.get("klass")
            if not isinstance(klass, type):
                raise SchemaError(f"控制器 {controller_id!r} 注册的不是类: {klass!r}")

            entry = controllers.setdefault(
                controller_id,
                {"id": controller_id, "webs": [], "methods": [], "properties": []},
            )
            if web_name not in entry["webs"]:
                entry["webs"].append(web_name)

            for name in dir(klass):
                if name.startswith("_"):
                    continue
                raw = inspect.getattr_static(klass, name)

                if _is_property(raw):
                    entry["properties"].append(
                        {"name": name, "type": type_node(_return_annotation(raw))}
                    )
                    continue
                if isinstance(raw, (int, float, str, bool)):
                    entry["properties"].append({"name": name, "type": type_node(type(raw))})
                    continue
                if not callable(raw):
                    continue

                method = _method_schema(name, klass)
                if method is not None:
                    entry["methods"].append(method)

    ordered = sorted(controllers.values(), key=lambda c: c["id"])
    for entry in ordered:
        entry["webs"].sort()
        entry["methods"].sort(key=lambda m: m["name"])
        entry["properties"].sort(key=lambda p: p["name"])

    return {
        "schemaVersion": 1,
        "axonVersion": version or _package_version(),
        "controllers": ordered,
    }


def _return_annotation(prop: property) -> Any:
    getter = prop.fget
    if getter is None:
        return inspect.Parameter.empty
    try:
        return typing.get_type_hints(getter).get("return", inspect.Parameter.empty)
    except Exception:
        return inspect.Parameter.empty


def _method_schema(name: str, klass: type) -> dict[str, Any] | None:
    func = getattr(klass, name, None)
    if not inspect.isfunction(func):
        return None
    try:
        hints = typing.get_type_hints(func)
    except Exception:
        hints = {}
    try:
        signature = inspect.signature(func)
    except (TypeError, ValueError):
        return None

    params: list[dict[str, Any]] = []
    has_var_keyword = False
    for index, param in enumerate(signature.parameters.values()):
        if index == 0 and param.name in ("self", "cls"):
            continue
        if param.kind is inspect.Parameter.VAR_POSITIONAL:
            params.append({"name": "args", "type": {"t": "array", "of": {"t": "any"}}, "optional": True, "variadic": True})
            continue
        if param.kind is inspect.Parameter.VAR_KEYWORD:
            has_var_keyword = True
            continue
        params.append(
            {
                "name": param.name,
                "type": type_node(hints.get(param.name, param.annotation)),
                "optional": param.default is not inspect.Parameter.empty,
            }
        )

    if has_var_keyword:
        params.append({"name": "kwargs", "type": {"t": "record", "value": {"t": "any"}}, "optional": True, "keyword": True})

    return {
        "name": name,
        "async": inspect.iscoroutinefunction(func),
        "params": params,
        "returns": type_node(hints.get("return", signature.return_annotation)),
    }


def _package_version() -> str:
    from importlib.metadata import PackageNotFoundError, version

    try:
        return version("axon-gui")
    except PackageNotFoundError:
        return "0.0.0"
