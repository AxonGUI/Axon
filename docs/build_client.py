"""把文档站打包成桌面客户端(AxonDocs)。

产物是一个自带 Python + PySide6 + 文档站构建产物的可执行文件:

- Windows: ``dist/AxonDocs.exe``
- macOS / Linux: ``dist/AxonDocs``

用法::

    cd docs/web && npm ci && npm run docs:build && cd ../..
    python docs/build_client.py                 # 依赖: pip install pyinstaller pyside6

可选参数 ``--dist`` 指定 VitePress 构建产物目录, ``--name`` 改产物名。
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Windows 控制台默认 cp1252, 中文 print 会 UnicodeEncodeError; 统一成 utf-8 兜底。
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except Exception:
        pass

DOCS_DIR = Path(__file__).resolve().parent
REPO_ROOT = DOCS_DIR.parent
DEFAULT_DIST = DOCS_DIR / "web" / ".vitepress" / "dist"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="打包 Axon 文档客户端")
    parser.add_argument("--dist", type=Path, default=DEFAULT_DIST, help="VitePress 构建产物目录")
    parser.add_argument("--name", default="AxonDocs", help="可执行文件名")
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "build" / "client", help="PyInstaller 工作目录")
    parser.add_argument("--onefile", action="store_true", default=True, help="打成单文件(默认)")
    parser.add_argument("--onedir", dest="onefile", action="store_false", help="打成目录")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    dist = args.dist.resolve()
    if not (dist / "index.html").is_file():
        print(f"找不到文档站构建产物: {dist}", file=sys.stderr)
        print("先执行: cd docs/web && npm ci && npm run docs:build", file=sys.stderr)
        return 2

    try:
        import PyInstaller.__main__ as pyinstaller  # noqa: PLC0415
    except ImportError:
        print("缺少 pyinstaller: pip install pyinstaller", file=sys.stderr)
        return 2

    out = args.out.resolve()
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)

    # --add-data 的分隔符跟着平台走: Windows 用 ';', 其他平台用 ':'
    sep = os.pathsep
    cmd = [
        "--noconfirm",
        "--clean",
        "--name",
        args.name,
        "--onefile" if args.onefile else "--onedir",
        "--windowed",
        "--distpath",
        str(out / "dist"),
        "--workpath",
        str(out / "work"),
        "--specpath",
        str(out),
        "--paths",
        str(DOCS_DIR),
        "--add-data",
        f"{dist}{sep}web_dist",
        str(DOCS_DIR / "main.py"),
    ]
    print("[build] pyinstaller " + " ".join(cmd))
    pyinstaller.run(cmd)

    produced = out / "dist" / (args.name + (".exe" if os.name == "nt" else ""))
    if produced.is_file():
        print(f"[build] done: {produced} ({produced.stat().st_size / 1024 / 1024:.1f} MB)")
    else:
        print(f"[build] done: {out / 'dist'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
