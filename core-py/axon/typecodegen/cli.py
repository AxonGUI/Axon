"""``axon-gui types`` 的实现：生成 / 校验类型产物。

默认**两个方向都生成**（不需要带任何参数）：

* Python 控制器 → ``web/src/axon.generated.ts``
* 前端控制器 → ``controller/js_controllers.py``

想换位置就用 ``--out`` / ``--py-out``；只想要一边用 ``--skip-ts`` / ``--skip-py``。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .schema import SchemaError, collect
from .tsgen import render_typescript

DEFAULT_OUT = Path("web") / "src" / "axon.generated.ts"
DEFAULT_PY_OUT = Path("controller") / "js_controllers.py"

#: 没给 ``--js`` 时按这些目录找前端源码（先找到先用）
JS_SEARCH_ROOT = ("web/src", "src", "web", "app")
SOURCE_EXT = (".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs")
SKIP_DIRS = {"node_modules", "dist", ".git", "coverage", ".vitepress", ".angular"}


def _project_root() -> Path:
    """命令可能从 ``web/``（前端工程目录）里跑，这时项目根在上一级。

    判据：当前目录有 ``package.json``，而上一级有 ``controller/``。
    """
    cwd = Path.cwd()
    if (cwd / "package.json").exists() and (cwd.parent / "controller").is_dir():
        return cwd.parent
    return cwd


def _detect_controllers(root: Path) -> list[str]:
    """没指定模块时，按常见布局猜一个。"""
    for candidate in ("controller", "controllers", "app", "main"):
        if (root / candidate / "__init__.py").exists() or (root / f"{candidate}.py").exists():
            return [candidate]
    return []


def _has_sources(path: Path, *, max_depth: int = 4) -> bool:
    """目录里有没有前端源码（跳过 node_modules / dist 之类）。"""
    base_depth = len(path.parts)
    for child in path.rglob("*"):
        if len(child.parts) - base_depth > max_depth:
            continue
        if any(part in SKIP_DIRS for part in child.parts[base_depth:]):
            continue
        if child.is_file() and child.suffix in SOURCE_EXT:
            return True
    return False


def _detect_js_source(root: Path) -> Path | None:
    """没给 ``--js`` 时自动找一个放前端源码的目录，找不到返回 None。"""
    for candidate in JS_SEARCH_ROOT:
        path = root / candidate
        if path.is_dir() and _has_sources(path):
            return path
    return None


def _write(path: Path, content: str, *, check: bool) -> bool:
    """写文件；``check`` 模式下只比对。返回 True 表示「已经是期望内容」。"""
    if check:
        if not path.exists():
            print(f"[types] 缺少生成物: {path}（跑一次 `axon-gui types`）", file=sys.stderr)
            return False
        current = path.read_text(encoding="utf-8")
        if current != content:
            print(f"[types] 生成物过期: {path}", file=sys.stderr)
            return False
        return True
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"[types] 写入 {path}")
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="axon-gui types",
        description="生成两端类型：Python 控制器 → TS（默认 web/src/axon.generated.ts），"
        "前端控制器 → Python（默认 controller/js_controllers.py）。不带参数就两个都生成。",
    )
    parser.add_argument(
        "--controllers",
        "-c",
        action="append",
        default=None,
        metavar="模块或路径",
        help="导入哪个模块来触发 @AxonController 注册（可重复；省略则猜 controller/ 或 app.py）",
    )
    parser.add_argument("--out", "-o", default=None, metavar="文件", help=f"TypeScript 输出（默认 {DEFAULT_OUT}）")
    parser.add_argument(
        "--js", default=None, metavar="文件或目录", help="前端源码位置（省略则自动找 web/src、src 等）"
    )
    parser.add_argument("--py-out", default=None, metavar="文件", help=f"Python 存根输出（默认 {DEFAULT_PY_OUT}）")
    parser.add_argument("--skip-ts", action="store_true", help="不生成 TypeScript")
    parser.add_argument("--skip-py", action="store_true", help="不生成 Python 存根")
    parser.add_argument(
        "--include-internal",
        action="store_true",
        help="连框架内部的转接台控制器一起生成（默认跳过）",
    )
    parser.add_argument("--check", action="store_true", help="只校验生成物是否最新（CI 用），不一致返回 1")
    parser.add_argument("--print", dest="print_only", action="store_true", help="打印到标准输出，不写文件")
    args = parser.parse_args(argv)

    if args.skip_ts and args.skip_py:
        print("[types] --skip-ts 和 --skip-py 不能同时用", file=sys.stderr)
        return 2

    want_ts = not args.skip_ts
    want_py = not args.skip_py
    ok = True
    root = _project_root()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))  # 让 `controller` 这类包能按项目根导入

    # ---- 方向一：Python → TS ----
    if want_ts:
        modules = args.controllers or _detect_controllers(root)
        try:
            schema = (
                collect(*modules, include_internal=args.include_internal)
                if modules
                else {"schemaVersion": 1, "axonVersion": "", "controllers": []}
            )
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
            out = Path(args.out) if args.out else root / DEFAULT_OUT
            ok = _write(out, typescript, check=args.check) and ok

    # ---- 方向二：TS → Python ----
    if want_py:
        js_source = Path(args.js) if args.js else _detect_js_source(root)
        if js_source is None:
            if args.check:
                print(
                    "[types] 没找到前端源码（用 --js 指定，或用 --skip-py 跳过），Python 存根无法校验",
                    file=sys.stderr,
                )
                return 1
            print("[types] 没找到前端源码（用 --js 指定，或用 --skip-py 跳过），跳过 Python 存根", file=sys.stderr)
        else:
            from .extract import extract_javascript
            from .pygen import render_python

            try:
                controllers = extract_javascript(js_source)
            except SchemaError as exc:
                print(f"[types] {exc}", file=sys.stderr)
                return 2
            python = render_python(controllers, source=str(js_source))
            if args.print_only:
                print(python)
            else:
                py_out = Path(args.py_out) if args.py_out else root / DEFAULT_PY_OUT
                ok = _write(py_out, python, check=args.check) and ok

    if args.check and not ok:
        print("[types] 类型产物与源码不一致：跑一次 `axon-gui types` 并把产物一起提交", file=sys.stderr)
        return 1
    return 0
