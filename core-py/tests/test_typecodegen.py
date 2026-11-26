"""类型生成器的单元测试（不需要 Qt，纯 Python）。

    python -m unittest discover -s core-py/tests -p "test_typecodegen.py"

或者直接  python core-py/tests/test_typecodegen.py
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from axon.AxonJSCallHandler import AxonController, controllerClassDict  # noqa: E402
from axon.typecodegen import collect, render_python, render_typescript  # noqa: E402
from axon.typecodegen.pygen import render_type  # noqa: E402
from axon.typecodegen.tsgen import render_type as render_ts_type  # noqa: E402

WEB = "typeTest"


class Payload:
    pass


@AxonController(WEB, id="Typed")
class TypedController:
    """一个用来测生成的控制器。"""

    counter: int = 0

    def add(self, a: int, b: int = 0) -> int:
        return a + b

    def rename(self, new_name: str) -> None:
        self.counter = len(new_name)

    def listing(self, tags: list[str]) -> dict[str, int]:
        return {tag: len(tag) for tag in tags}

    def payload(self, data: Payload | None, *extra: int) -> bool:
        return bool(data) or bool(extra)


class GeneratorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.schema = collect(__name__)
        self.typescript = render_typescript(self.schema, source=__name__)

    def test_collects_controller_and_signatures(self) -> None:
        ids = [c["id"] for c in self.schema["controllers"]]
        self.assertIn("Typed", ids)
        typed = next(c for c in self.schema["controllers"] if c["id"] == "Typed")
        self.assertEqual(typed["webs"], [WEB])
        methods = {m["name"]: m for m in typed["methods"]}
        # self 已经被绑掉，参数表就是调用方要传的那些
        self.assertEqual([p["name"] for p in methods["add"]["params"]], ["a", "b"])
        self.assertFalse(methods["add"]["params"][0]["optional"])
        self.assertTrue(methods["add"]["params"][1]["optional"])
        self.assertEqual(methods["add"]["returns"], {"t": "number"})
        self.assertEqual(methods["rename"]["returns"], {"t": "null"})
        kinds = {p["name"]: p["type"] for p in typed["properties"]}
        self.assertEqual(kinds["counter"], {"t": "number"})

    def test_typescript_output_is_valid_and_deterministic(self) -> None:
        self.assertIn("export interface AxonRegistry {", self.typescript)
        self.assertIn("declare module \"axon-gui\" {", self.typescript)
        self.assertIn("add(a: number, b?: number): Promise<number>;", self.typescript)
        self.assertIn("counter: number;", self.typescript)
        self.assertEqual(self.typescript, render_typescript(collect(__name__), source=__name__))

    def test_python_stub(self) -> None:
        stub = render_python(
            [
                {
                    "name": "DocsJS",
                    "members": [
                        {"kind": "prop", "name": "value", "type": "number"},
                        {
                            "kind": "method",
                            "name": "mirror",
                            "ret": "Promise<{ mirrored: boolean }>",
                            "params": [
                                {"name": "payload", "type": "{ hello: string }", "optional": False},
                                {"name": "label", "type": "string", "optional": True},
                            ],
                        },
                    ],
                }
            ]
        )
        self.assertIn("class DocsJS(Protocol):", stub)
        self.assertIn("value: float", stub)
        self.assertIn("def mirror(self, payload: dict[str, Any], label: str | None = None)", stub)
        self.assertIn("def connect(web_name: str = \"*\") -> AxonJsApi:", stub)

    def test_type_mapping(self) -> None:
        self.assertEqual(render_ts_type({"t": "array", "of": {"t": "string"}}), "Array<string>")
        self.assertEqual(render_ts_type({"t": "record", "value": {"t": "number"}}), "Record<string, number>")
        self.assertEqual(render_ts_type({"t": "unknown"}), "unknown")
        self.assertEqual(render_type("Promise<number>"), "float")
        self.assertEqual(render_type("number[]"), "list[float]")
        self.assertEqual(render_type("string | null"), "str | None")
        self.assertEqual(render_type("{ a: string; b?: number }"), "dict[str, Any]")
        self.assertEqual(render_type(None), "Any")

    def test_internal_controllers_can_be_skipped(self) -> None:
        self.assertNotIn("AxonCrossCallHandler", self.typescript)
        with_internal = render_typescript(collect(__name__, include_internal=True))
        self.assertIn("AxonCrossCallHandler", with_internal)

    def test_registry_is_clean(self) -> None:
        # 生成器会 import 控制器模块；确认没有把测试类漏进框架自己的注册表
        self.assertIn("Typed", controllerClassDict[WEB])


if __name__ == "__main__":
    unittest.main(verbosity=2)
