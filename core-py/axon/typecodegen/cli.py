"""``axon-gui types`` 的实现：生成 / 校验类型产物。"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .schema import SchemaError, collect
from .tsgen import render_typescript

DEFAULT_OUT = Path("web") / "src" / "axon.generated.ts"
DEFAULT_PY_OUT = Path("controller") / "js_controllers.py"


def _detect_controllers() -> list[str]:
    """没指定模块时，按常见布局猜一个。"""
    for candidate in ("controller", "controllers", "app", "main"):
        if (Path(candidate) / "__init__.py").exists() or Path(f"{candidate}.py").exists():
            return [candidate]
    return []


def _write(path: Path, content: str, *, check: bool) -> bool:
    """写文件；``check`` 模式下只比对。返回 True 表示「已经是期望内容」。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    if check:
        if not path.exists():
            print(f"[types] 缺少生成物: {path}（跑一次 `axon-gui types`）", file=sys.stderr)
            return False
        current = path.read_text(encoding="utf-8")
        if current != content:
            print(f"[types] 生成物过期: {path}", file=sys.stderr)
            return False
        return True
    path.write_text(content, encoding="utf-8")
    print(f"[types] 写入 {path}")
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="axon-gui types",
        description="从 Python 控制器生成 TypeScript 类型（以及从前端控制器生成 Python 存根）。",
    )
    parser.add_argument(
        "--controllers",
        "-c",
        action="append",
        default=None,
        metavar="模块",
        help="导入哪个模块来触发 @AxonController 注册（可重复；省略则猜 controller/ 或 app.py）",
    )
    parser.add_argument("--out", "-o", default=None, metavar="文件", help=f"TypeScript 输出（默认 {DEFAULT_OUT}）")
    parser.add_argument("--js", default=None, metavar="文件或目录", help="从前端控制器生成 Python 存根")
    parser.add_argument("--py-out", default=None, metavar="文件", help=f"Python 存根输出（默认 {DEFAULT_PY_OUT}）")
    parser.add_argument(
        "--include-internal",
        action="store_true",
        help="连框架内部的转接台控制器一起生成（默认跳过）",
    )
    parser.add_argument("--check", action="store_true", help="只校验生成物是否最新（CI 用），不一致返回 1")
    parser.add_argument("--print", dest="print_only", action="store_true", help="打印到标准输出，不写文件")
    args = parser.parse_args(argv)

    modules = args.controllers or _detect_controllers()
    ok = True

    try:
        schema = collect(*modules, include_internal=args.include_internal) if modules else {
            "schemaVersion": 1,
            "axonVersion": "",
            "controllers": [],
        }
    except SchemaError as exc:
        print(f"[types] {exc}", file=sys.stderr)
        return 2
    except ModuleNotFoundError as exc:
        print(f"[types] 导入控制器模块失败: {exc}（用 --controllers 指定）", file=sys.stderr)
        return 2

    source = ", ".join(modules) if modules else "（未指定控制器模块）"
    typescript = render_typescript(schema, source=source)

    if args.print_only:
        print(typescript)
    else:
        out = Path(args.out) if args.out else DEFAULT_OUT
        ok = _write(out, typescript, check=args.check) and ok

    if args.js:
        from .pygen import render_python
        from .extract import extract_javascript

        controllers = extract_javascript(Path(args.js))
        python = render_python(controllers, source=str(args.js))
        if args.print_only:
            print(python)
        else:
            py_out = Path(args.py_out) if args.py_out else DEFAULT_PY_OUT
            ok = _write(py_out, python, check=args.check) and ok

    if args.check and not ok:
        print("[types] 类型产物与源码不一致：跑一次 `axon-gui types` 并把产物一起提交", file=sys.stderr)
        return 1
    return 0
