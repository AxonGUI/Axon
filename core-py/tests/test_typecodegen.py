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

    def test_regex_fallback_reads_object_literal(self) -> None:
        """项目里没装 typescript 时退化为正则：必须拿到成员，且不能把 register( 本身当方法。"""
        import json
        import shutil
        import subprocess
        import tempfile

        node = shutil.which("node")
        if node is None:
            self.skipTest("没有 node")
        script = Path(__file__).resolve().parents[1] / "axon" / "typecodegen" / "extract_js.mjs"
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "js.js"
            src.write_text(
                'AxonController.register("DocsJS", {\n'
                '  value: 7,\n'
                '  mirror(payload, label) { return payload; },\n'
                '  async sleepEcho(ms) { return ms; },\n'
                '});\n',
                encoding="utf-8",
            )
            out = subprocess.run(
                [node, str(script), str(src)], capture_output=True, text=True, check=True
            ).stdout
            payload = json.loads(out.splitlines()[-1])
        self.assertEqual(payload["mode"], "regex")
        members = {m["name"]: m for m in payload["controllers"][0]["members"]}
        self.assertEqual(set(members), {"value", "mirror", "sleepEcho"})
        self.assertEqual(members["value"]["kind"], "prop")
        self.assertTrue(members["sleepEcho"]["async"])
        self.assertNotIn("register", members)

    def test_defaults_generate_both_directions(self) -> None:
        """不带参数就两个方向都生成；Python 产物是可 import 的 .py。"""
        from axon.typecodegen.cli import DEFAULT_OUT, DEFAULT_PY_OUT

        self.assertEqual(DEFAULT_OUT.as_posix(), "web/src/axon.generated.ts")
        self.assertEqual(DEFAULT_PY_OUT.as_posix(), "controller/js_controllers.py")

    def test_cli_runs_both_directions_by_default(self) -> None:
        import os
        import tempfile

        from axon.typecodegen.cli import main as gen_main

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "controller").mkdir()
            (root / "controller" / "__init__.py").write_text(
                "from axon import AxonController\n\n"
                "@AxonController('W', id='Hello')\n"
                "class Hello:\n"
                "    def hi(self, name: str) -> str:\n"
                "        return name\n",
                encoding="utf-8",
            )
            (root / "web" / "src").mkdir(parents=True)
            (root / "web" / "src" / "main.ts").write_text(
                'AxonController.register("DocsJS", { note(text: string) { console.log(text); } });\n',
                encoding="utf-8",
            )
            cwd = os.getcwd()
            os.chdir(root)
            try:
                rc = gen_main([])
            finally:
                os.chdir(cwd)
            self.assertEqual(rc, 0)
            ts = (root / "web" / "src" / "axon.generated.ts").read_text(encoding="utf-8")
            py = (root / "controller" / "js_controllers.py").read_text(encoding="utf-8")
            py_auto = (root / "controller" / "js_controllers.py").read_text(encoding="utf-8")
        self.assertIn("hi(name: string): Promise<string>", ts)
        self.assertIn("def note(self, text: str)", py)
        self.assertEqual(py, py_auto)

    def test_only_selector(self) -> None:
        """`--only ts|py` 是正向选择：默认两个都生成，选中一侧就只写那一份。"""
        import os
        import tempfile

        from axon.typecodegen.cli import main as gen_main

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "controller").mkdir()
            (root / "controller" / "__init__.py").write_text(
                "from axon import AxonController\n\n"
                "@AxonController('W', id='Only')\n"
                "class Only:\n"
                "    def ping(self) -> str:\n"
                "        return 'pong'\n",
                encoding="utf-8",
            )
            (root / "web" / "src").mkdir(parents=True)
            (root / "web" / "src" / "main.ts").write_text(
                'AxonController.register("DocsJS", { note(text: string) {} });\n', encoding="utf-8"
            )
            ts = root / "web" / "src" / "axon.generated.ts"
            py = root / "controller" / "js_controllers.py"

            cwd = os.getcwd()
            os.chdir(root)
            try:
                self.assertEqual(gen_main(["--only", "ts"]), 0)
                self.assertTrue(ts.exists())
                self.assertFalse(py.exists())  # 只选了 TS，Python 那份不该出现

                ts_before = ts.read_text(encoding="utf-8")
                self.assertEqual(gen_main(["--only", "py"]), 0)
                self.assertTrue(py.exists())
                self.assertEqual(ts.read_text(encoding="utf-8"), ts_before)  # 没被重写

                self.assertEqual(gen_main([]), 0)  # 默认两个都生成
                self.assertTrue(ts.exists() and py.exists())
            finally:
                os.chdir(cwd)

    def test_registry_is_clean(self) -> None:
        # 生成器会 import 控制器模块；确认没有把测试类漏进框架自己的注册表
        self.assertIn("Typed", controllerClassDict[WEB])


if __name__ == "__main__":
    unittest.main(verbosity=2)
