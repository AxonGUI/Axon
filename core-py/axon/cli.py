"""``axon init <项目名>``: 从模板创建一个可运行的项目。

模板就是本仓库的 ``template/`` 目录：

- 在仓库里直接运行时，直接拷本地 ``template/``（不联网）；
- 装成包之后运行时，从 GitHub 拉**与本包同版本 tag** 的 zip（没打 tag 就退 main）。

生成出来的项目自带 ``vendor/axon-core``（core-js 的源码 + 预构建 dist）与
``vendor/axon-py``（本包的运行时），所以生成的项目既不依赖本仓库路径、也不需要
用户自己先构建前端运行时。装成包之后运行时，模板与 core-js/core-py 来自 GitHub 的
归档；万一份归档里没有预构建的 ``dist``，就退回从 npm 取同版本的预构建产物。
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path

TEMPLATE_REPO = "https://github.com/AxonGUI/Axon"
TEMPLATE_URL = f"{TEMPLATE_REPO}/archive/refs/heads/main.zip"
TEMPLATE_TAG_URL = TEMPLATE_REPO + "/archive/refs/tags/v{version}.zip"

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


def _fetch_repo(dest: Path, version: str | None = None) -> Path:
    """下载仓库归档, 返回解出来的仓库根目录。

    优先取**与本包同版本的 tag**（``v5.3.4`` 之类），这样 ``pip install axon-gui==5.3.4``
    再 ``axon-gui init`` 拿到的是 5.3.4 的模板，而不是 main 上还没发布的形状；tag 不存在
    （本地开发装的、或还没打 tag）就退回 main。
    """
    urls = []
    if version:
        urls.append((f"v{version}", TEMPLATE_TAG_URL.format(version=version)))
    urls.append(("main", TEMPLATE_URL))
    last_error: Exception | None = None
    for label, url in urls:
        archive = dest / f"axon-{label}.zip"
        print(f"正在下载模板 ({label}): {url}")
        try:
            urllib.request.urlretrieve(url, archive)  # noqa: S310
        except Exception as error:  # noqa: BLE001 - tag 不存在时退 main
            last_error = error
            print(f"  取 {label} 失败（{error}），换下一个来源", file=sys.stderr)
            continue
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(dest)
        for candidate in dest.iterdir():
            if candidate.is_dir() and (candidate / "template" / "main.py").is_file():
                return candidate
        raise RuntimeError("下载到的压缩包里没有 template/main.py")
    raise RuntimeError(f"下载模板失败: {last_error}")


def _npm_packument(version: str | None) -> dict:
    spec = version or "latest"
    url = f"https://registry.npmjs.org/axon-gui/{spec}"
    with urllib.request.urlopen(url, timeout=30) as resp:  # noqa: S310
        return json.loads(resp.read().decode("utf-8"))


def _core_js_version(core_js_dir: Path) -> str | None:
    package_json = core_js_dir / "package.json"
    try:
        return str(json.loads(package_json.read_text(encoding="utf-8"))["version"])
    except Exception:  # noqa: BLE001 - 读不到就用 npm 的 latest
        return None


def _ensure_core_js_dist(core_js_dir: Path, _python_version: str) -> None:
    """保证 core_js_dir/dist 里有一套预构建产物。

    仓库里改完 lib 忘了 build、或者 GitHub 归档里没带 dist 时，退回从 npm 取同版本
    （取 core-js/package.json 里的版本，缺失则用 latest）的预构建产物，这样 ``axon-gui init``
    出来的项目 ``npm install`` 就能直接用，不需要用户自己构建前端运行时。
    """
    if (core_js_dir / "dist" / "axon.js").is_file():
        return
    version = _core_js_version(core_js_dir)
    print(
        f"本地没有预构建的 core-js/dist，改为从 npm 取 axon-gui@{version or 'latest'} 的产物 ...",
        file=sys.stderr,
    )
    meta = _npm_packument(version)
    tarball = meta["dist"]["tarball"]
    with tempfile.TemporaryDirectory() as tmp:
        tgz = Path(tmp) / "axon-gui.tgz"
        urllib.request.urlretrieve(tarball, tgz)  # noqa: S310
        with tarfile.open(tgz) as tf:
            members = [m for m in tf.getmembers() if m.name.startswith("package/dist/")]
            if not members:
                raise RuntimeError("npm 包里没有 dist/ 目录")
            tf.extractall(tmp, members=members, filter="data")  # noqa: S202 - 只取 package/dist/
        src = Path(tmp) / "package" / "dist"
        if not src.is_dir():
            raise RuntimeError("npm 包里没有 dist/ 目录")
        shutil.copytree(src, core_js_dir / "dist")
    print(f"已从 npm 取到 axon-gui@{meta.get('version')} 的 dist", file=sys.stderr)


def _copy_core_js(src: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
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


def _installed_version() -> str | None:
    """装在环境里的 axon-gui 版本（仓库里直接跑时装的是自身，也能读到）。"""
    try:
        from importlib.metadata import version as dist_version

        return dist_version("axon-gui")
    except Exception:  # noqa: BLE001 - 读不到就只用 main
        return None


def create_project(name: str, where: Path | None = None, force: bool = False) -> Path:
    target = (where or Path.cwd()) / name
    if target.exists() and not force:
        raise FileExistsError(f"目录已存在: {target}")

    cleanup: tempfile.TemporaryDirectory | None = None
    root = _repo_root()
    if root is not None:
        print(f"使用本地模板: {root / 'template'}")
        repo = root
    else:
        cleanup = tempfile.TemporaryDirectory(prefix="axon-init-")
        repo = _fetch_repo(Path(cleanup.name), _installed_version())

    try:
        template_dir = repo / "template"
        core_js_dir = repo / "core-js"
        python_dir = repo / "core-py"
        version = _read_core_version(python_dir / "pyproject.toml")

        # 让包里带上预构建产物（仓库里没 build 时退回 npm）
        _ensure_core_js_dist(core_js_dir, version)

        shutil.copytree(
            template_dir,
            target,
            ignore=shutil.ignore_patterns(
                "node_modules", "dist", "__pycache__", ".venv", "uv.lock"
            ),
        )
        _copy_core_js(core_js_dir, target / "vendor" / "axon-core")
        _copy_python_core(python_dir, target / "vendor" / "axon-py", version)
        _vendorize_web_dependency(target / "web" / "web-vue")
        _write_project_pyproject(target, name)
    finally:
        if cleanup is not None:
            cleanup.cleanup()

    print(f"✨ 项目创建成功: {target}")
    print(f"   cd {name}")
    print("   uv sync                          # 依赖指向 vendor/axon-py")
    print("   cd web/web-vue && npm install && npm run build")
    print("   cd ../.. && python main.py")
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
