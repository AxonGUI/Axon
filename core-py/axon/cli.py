"""``axon init <项目名>``: 从模板创建一个可运行的项目。

模板就是本仓库的 ``template/`` 目录：

- 在仓库里直接运行时，直接拷本地 ``template/``（不联网）；
- 装成包之后运行时，从 GitHub 拉 main 分支的 zip。

生成出来的项目自带 ``vendor/axon-core``（core-js 的源码），这样 ``web/web-vue`` 的
``"axon": "file:..."`` 依赖不依赖用户的仓库位置，``npm install`` 就能直接跑。
"""

from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

TEMPLATE_REPO = "https://github.com/AxonGUI/Axon"
TEMPLATE_URL = f"{TEMPLATE_REPO}/archive/refs/heads/main.zip"

# core-js 里生成项目需要的部分（不要 node_modules / dist）
_CORE_JS_ITEMS = (
    "lib",
    "dist",  # 预构建产物: 模板的 vue-tsc / vite 直接吃它, 不用在 vendor 里再装依赖
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "README.md",
)

_VENDOR_PYPROJECT = """[project]
name = "axon-gui"
version = "{version}"
description = "Axon 的 Python 运行时（随项目 vendor）"
requires-python = ">=3.12"
dependencies = ["PySide6"]

[tool.setuptools]
packages = {{ find = {{}} }}
"""


def _repo_root() -> Path | None:
    """当前包是不是就在仓库里（.../core-py/axon/cli.py）。"""
    root = Path(__file__).resolve().parents[2]
    if (root / "template" / "main.py").is_file() and (root / "core-js" / "lib").is_dir():
        return root
    return None


def _fetch_template(dest: Path) -> Path:
    archive = dest / "axon-main.zip"
    print(f"正在下载模板: {TEMPLATE_URL}")
    urllib.request.urlretrieve(TEMPLATE_URL, archive)  # noqa: S310
    with zipfile.ZipFile(archive) as zf:
        zf.extractall(dest)
    for candidate in dest.iterdir():
        if candidate.is_dir() and (candidate / "template" / "main.py").is_file():
            return candidate / "template"
    raise RuntimeError("下载到的压缩包里没有 template/main.py")


def _copy_core_js(src: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    if not (src / "dist" / "axon.js").is_file():
        print(
            "提示: 本地 core-js 还没构建过 dist，生成的项目需要先执行\n"
            "      cd vendor/axon-core && npm install && npm run build\n"
            "      或者先在仓库里执行 cd core-js && npm run build 再重新 init",
            file=sys.stderr,
        )
    for name in _CORE_JS_ITEMS:
        item = src / name
        if not item.exists():
            continue
        if item.is_dir():
            shutil.copytree(item, dest / name, ignore=shutil.ignore_patterns("node_modules", "dist"))
        else:
            shutil.copy2(item, dest / name)


def _copy_python_core(src: Path, dest: Path, version: str) -> None:
    """把 Python 端的 axon 包一起 vendor 进来, 生成的项目不依赖本仓库路径。"""
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copytree(
        src / "axon",
        dest / "axon",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    (dest / "pyproject.toml").write_text(
        _VENDOR_PYPROJECT.format(version=version), encoding="utf-8"
    )


def _write_project_pyproject(target: Path, name: str) -> None:
    target.joinpath("pyproject.toml").write_text(
        f"""[project]
name = "{name}"
version = "0.1.0"
description = "{name}: 用 Python + Web 写的 Axon 应用"
requires-python = ">=3.12"
dependencies = ["axon-gui"]

[tool.uv.sources]
axon-gui = {{ path = "vendor/axon-py" }}
""",
        encoding="utf-8",
    )


def _vendorize_web_dependency(web_dir: Path) -> None:
    """把 template 里指向仓库 core-js 的相对路径改成项目内的 vendor/axon-core。"""
    package_json = web_dir / "package.json"
    if not package_json.is_file():
        return
    text = package_json.read_text(encoding="utf-8")
    text = text.replace('"file:../../../core-js"', '"file:../../vendor/axon-core"')
    package_json.write_text(text, encoding="utf-8")


def _read_core_version(pyproject: Path) -> str:
    try:
        import tomllib

        data = tomllib.loads(pyproject.read_text(encoding="utf-8"))
        return str(data["project"]["version"])
    except Exception:  # noqa: BLE001 - 版本号读不到就退回一个安全默认值
        return "0.0.0"


def create_project(name: str, where: Path | None = None, force: bool = False) -> Path:
    target = (where or Path.cwd()) / name
    if target.exists() and not force:
        raise FileExistsError(f"目录已存在: {target}")

    root = _repo_root()
    if root is not None:
        template_dir = root / "template"
        core_js_dir = root / "core-js"
        print(f"使用本地模板: {template_dir}")
    else:
        with tempfile.TemporaryDirectory() as tmp:
            template_dir = _fetch_template(Path(tmp))
            core_js_dir = None
            # 下载来的模板旁边通常没有 core-js，只能提示用户
            shutil.copytree(template_dir, target)
            print(f"✨ 项目创建成功: {target}")
            print("   web 依赖指向 file:../../vendor/axon-core，需要把你的 core-js 放到 vendor/axon-core")
            return target

    shutil.copytree(
        template_dir,
        target,
        ignore=shutil.ignore_patterns(
            "node_modules", "dist", "__pycache__", ".venv", "uv.lock"
        ),
    )
    version = _read_core_version(root / "core-py" / "pyproject.toml")
    _copy_core_js(core_js_dir, target / "vendor" / "axon-core")
    _copy_python_core(root / "core-py", target / "vendor" / "axon-py", version)
    _vendorize_web_dependency(target / "web" / "web-vue")
    _write_project_pyproject(target, name)

    print(f"✨ 项目创建成功: {target}")
    print(f"   cd {name}")
    print("   uv sync                          # 依赖指向 vendor/axon-py")
    print("   cd web/web-vue && npm install    # 依赖指向 vendor/axon-core")
    print("   python main.py")
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="axon", description="Axon 项目管理")
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init", help="用官方模板创建项目")
    init.add_argument("name", help="项目目录名")
    init.add_argument("--force", action="store_true", help="目录已存在时覆盖")
    args = parser.parse_args(argv)

    if args.command == "init":
        try:
            create_project(args.name, force=args.force)
        except (FileExistsError, RuntimeError, OSError) as err:
            print(f"初始化失败: {err}", file=sys.stderr)
            return 1
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
