"""`axon-gui` 命令行：从模板仓生成一个能跑的项目。

    axon-gui init myapp                  # 默认 vue 模板
    axon-gui init myapp --template react
    axon-gui init myapp --template angular --shell   # 无边框窗口版
    axon-gui init --list                 # 看看有哪些模板

模板不在这个包里：它们住在 https://github.com/AxonGUI/templates，
`init` 时按需下载，然后把该 vendor 的东西 vendor 进项目，用户不用管 core-js / core-py。
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tarfile
import tempfile
import tomllib
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

TEMPLATES_REPO = "https://github.com/AxonGUI/templates"
TEMPLATES_BRANCH = "main"
TEMPLATES_ZIP = f"{TEMPLATES_REPO}/archive/refs/heads/{TEMPLATES_BRANCH}.zip"
BACKEND_ZIP = "https://github.com/AxonGUI/Axon/archive/refs/heads/main.zip"
NPM_REGISTRY = "https://registry.npmjs.org"
DEFAULT_TEMPLATE = "vue"

# 从模板工程里删掉的东西
_IGNORE = shutil.ignore_patterns(
    "node_modules", "dist", "__pycache__", ".venv", "uv.lock", "package-lock.json", ".angular",
)

_CORE_JS_ITEMS = ("lib", "dist", "package.json", "tsconfig.json", "vite.config.ts", "README.md")


def _repo_root() -> Path | None:
    """在 axon 仓库里跑（改代码时）就返回仓库根；装成包跑时返回 None。"""
    here = Path(__file__).resolve().parent
    for parent in here.parents:
        if (parent / "core-js" / "lib").is_dir() and (parent / "core-py" / "axon").is_dir():
            return parent
    return None


def _download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"[axon] 下载 {url}")
    with urllib.request.urlopen(url, timeout=120) as resp, open(dest, "wb") as fh:
        shutil.copyfileobj(resp, fh)
    return dest


def _extract_zip(zip_path: Path, dest: Path) -> Path:
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(dest)
        top = {Path(n).parts[0] for n in zf.namelist() if n.strip()}
    if len(top) != 1:
        raise RuntimeError(f"压缩包结构看不懂: {sorted(top)}")
    return dest / top.pop()


def _fetch_templates(dest: Path) -> Path:
    """返回包含 templates.json 的目录。"""
    root = _extract_zip(_download(TEMPLATES_ZIP, dest / "templates.zip"), dest / "templates")
    if (root / "templates.json").is_file():
        return root
    for candidate in root.rglob("templates.json"):
        return candidate.parent
    raise RuntimeError("下载下来的模板仓里没有 templates.json")


def _templates_root(work: Path) -> Path:
    """本地开发/测试可设 AXON_TEMPLATES_DIR 跳过下载。"""
    import os

    if local := os.environ.get("AXON_TEMPLATES_DIR"):
        return Path(local).resolve()
    return _fetch_templates(work)


def _load_index(root: Path) -> list[dict]:
    data = json.loads((root / "templates.json").read_text(encoding="utf-8"))
    items = data.get("templates") or []
    if not isinstance(items, list) or not items:
        raise RuntimeError("templates.json 里没有 templates")
    return items


def _print_list(items: list[dict]) -> None:
    print("可用模板：\n")
    for item in items:
        print(f"  {item['id']:<10} {item.get('title', '')}")
        if desc := item.get("description"):
            print(f"  {'':<10} {desc}")
    print("\n用法：axon-gui init myapp --template <id>")


def _core_js_version(repo: Path) -> str:
    try:
        data = json.loads((repo / "core-js" / "package.json").read_text(encoding="utf-8"))
        return str(data.get("version") or "0.0.0")
    except (OSError, json.JSONDecodeError):
        return "0.0.0"


def _python_version(repo: Path) -> str:
    try:
        with open(repo / "core-py" / "pyproject.toml", "rb") as fh:
            return str(tomllib.load(fh)["project"]["version"])
    except (OSError, KeyError, tomllib.TOMLDecodeError):
        return "0.0.0"


def _npm_tarball(version: str) -> str:
    urls = [f"{NPM_REGISTRY}/axon-gui/{version}", f"{NPM_REGISTRY}/axon-gui/latest"]
    last: Exception | None = None
    for url in urls:
        try:
            with urllib.request.urlopen(url, timeout=60) as resp:
                data = json.load(resp)
            tarball = (data.get("dist") or {}).get("tarball")
            if tarball:
                return tarball
        except (urllib.error.URLError, json.JSONDecodeError) as exc:  # pragma: no cover - 网络
            last = exc
    raise RuntimeError(f"从 npm 取 axon-gui 产物失败: {last}")


def _ensure_core_js_dist(core_js_dir: Path) -> bool:
    """dist 缺失时，从 npm 取同版本预构建产物。返回 True 表示用了兜底。"""
    if (core_js_dir / "dist" / "axon.js").is_file():
        return False
    version = _core_js_version(core_js_dir.parent if core_js_dir.name == "core-js" else core_js_dir)
    if core_js_dir.name != "core-js":
        pkg = core_js_dir / "package.json"
        if pkg.is_file():
            version = str(json.loads(pkg.read_text(encoding="utf-8")).get("version") or version)
    print(f"[axon] 本地没有前端产物，从 npm 取 axon-gui@{version}")
    with tempfile.TemporaryDirectory() as tmp:
        tar = _download(_npm_tarball(version), Path(tmp) / "axon-gui.tgz")
        with tarfile.open(tar) as tf:
            members = [m for m in tf.getmembers() if m.name.startswith("package/dist/")]
            tf.extractall(tmp, members=members, filter="data")
        src = Path(tmp) / "package" / "dist"
        if not src.is_dir():
            raise RuntimeError("npm 包里没有 dist/")
        shutil.copytree(src, core_js_dir / "dist")
    return True


def _copy_python_core(source: Path, target: Path, version: str) -> None:
    pkg_dir = target / "vendor" / "axon-py"
    pkg_dir.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, pkg_dir / "axon", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    (pkg_dir / "pyproject.toml").write_text(
        f"""[project]
name = "axon-gui"
version = "{version}"
description = "Axon: Python + Web 桌面应用框架（随项目 vendor 的运行时）"
requires-python = ">=3.12"
dependencies = ["PySide6"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools]
packages = ["axon"]
""",
        encoding="utf-8",
    )


def _copy_core_js(repo: Path, target: Path, web_dir: Path) -> None:
    vendor = target / "vendor" / "axon-core"
    core_js = repo / "core-js"
    vendor.mkdir(parents=True, exist_ok=True)
    for item in _CORE_JS_ITEMS:
        src = core_js / item
        if not src.exists():
            continue
        dst = vendor / item
        if src.is_dir():
            shutil.copytree(src, dst, ignore=shutil.ignore_patterns("node_modules", "__pycache__"))
        else:
            shutil.copy2(src, dst)
    _ensure_core_js_dist(vendor)
    _vendorize_web_dependency(web_dir)


def _vendorize_web_dependency(web_dir: Path) -> None:
    pkg_file = web_dir / "package.json"
    if not pkg_file.is_file():
        return
    data = json.loads(pkg_file.read_text(encoding="utf-8"))
    deps = data.setdefault("dependencies", {})
    if "axon-gui" in deps:
        deps["axon-gui"] = "file:../vendor/axon-core"
    pkg_file.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _write_project_pyproject(target: Path, name: str, template_id: str, shell_deps: list[str]) -> None:
    deps = ["axon-gui", *shell_deps]
    deps_text = ", ".join(json.dumps(d) for d in deps)
    (target / "pyproject.toml").write_text(
        f"""[project]
name = {json.dumps(name)}
version = "0.1.0"
description = "Axon 项目（{template_id} 模板）"
requires-python = ">=3.12"
dependencies = [{deps_text}]

[tool.uv.sources]
axon-gui = {{ path = "vendor/axon-py" }}

[tool.uv]
package = false
""",
        encoding="utf-8",
    )


def create_project(
    name: str,
    where: Path | None = None,
    force: bool = False,
    template: str = DEFAULT_TEMPLATE,
    shell: bool = False,
) -> Path:
    name = name.strip()
    if not name or "/" in name or "\\" in name:
        raise SystemExit("项目名不能为空，也不能带路径分隔符")

    target = (where or Path.cwd()) / name
    if target.exists() and any(target.iterdir()):
        if not force:
            raise SystemExit(f"目录已存在且不为空: {target}（要覆盖加 --force）")
        shutil.rmtree(target)

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        root = _templates_root(work)
        items = _load_index(root)
        entry = next((it for it in items if it.get("id") == template), None)
        if entry is None:
            ids = ", ".join(it.get("id", "?") for it in items)
            raise SystemExit(f"没有这个模板: {template}（可选: {ids}）")

        tpl_dir = root / entry["dir"]
        meta = json.loads((tpl_dir / "template.json").read_text(encoding="utf-8"))
        shutil.copytree(tpl_dir, target, ignore=_IGNORE)

        web_meta = meta["web"]
        web_dir = target / web_meta["dir"]

        if shell:
            shell_meta = meta.get("shell") or {}
            if not shell_meta:
                raise SystemExit(f"模板 {template} 不支持 --shell（template.json 里没有 shell 段）")
            main_src = tpl_dir / shell_meta["main"]
            shutil.copy2(main_src, target / "main.py")
            if index := shell_meta.get("index"):
                shutil.copy2(tpl_dir / index, web_dir / "index.html")

        repo = _repo_root()
        if repo is None:
            repo = _extract_zip(_download(BACKEND_ZIP, work / "axon.zip"), work / "axon")
        _copy_core_js(repo, target, web_dir)
        _copy_python_core(repo / "core-py" / "axon", target, _python_version(repo))
        _write_project_pyproject(target, name, template, (meta.get("shell") or {}).get("deps", []) if shell else [])

    print(f"[axon] 已生成 {target}（模板 {template}{'，无边框窗口' if shell else ''}）")
    print(f"[axon] 下一步:\n  cd {target.name}\n  uv sync\n  cd {web_meta['dir']} && {web_meta['install']} && {web_meta['build']}\n  cd .. && python main.py")
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="axon-gui", description="Axon 项目脚手架")
    sub = parser.add_subparsers(dest="command")

    init = sub.add_parser("init", help="生成一个项目")
    init.add_argument("name", nargs="?", help="项目目录名")
    init.add_argument("--template", "-t", default=DEFAULT_TEMPLATE, help="模板 id（默认 vue）")
    init.add_argument("--shell", action="store_true", help="无边框窗口版（需要 axon-shell）")
    init.add_argument("--force", action="store_true", help="目标目录非空时覆盖")
    init.add_argument("--dir", default=".", help="生成到哪个目录下（默认当前目录）")
    init.add_argument("--list", action="store_true", help="列出可用模板")

    args = parser.parse_args(argv)
    if args.command != "init":
        parser.print_help()
        return 1

    if args.list or not args.name:
        with tempfile.TemporaryDirectory() as tmp:
            _print_list(_load_index(_templates_root(Path(tmp))))
        return 0 if args.list else 1

    create_project(args.name, Path(args.dir), args.force, args.template, args.shell)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
