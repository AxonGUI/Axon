"""从一个 SVG 母版生成项目用到的所有图标位图/ICO。

母版只有一份: ``assets/axon-mark.svg``。改图标 = 改母版 → 跑这个脚本。

生成物（都进仓库, 免得打包/CI 依赖 Node 或外部图像工具）::

    assets/icon-16.png … icon-256.png      # PNG, 给 Qt 窗口图标 / Linux 桌面
    assets/axon.ico                        # Windows 可执行文件图标(多尺寸)
    docs/web/public/favicon.svg            # 文档站 favicon(母版副本)
    template/web/web-vue/public/axon.svg   # 模板页 favicon(母版副本)
    template/web/web-vue/src/assets/axon.svg  # 模板欢迎页的 logo(母版副本)
    template/assets/icon-256.png           # 模板窗口图标

用法::

    core-py/.venv/bin/python tools/make_icons.py
"""

from __future__ import annotations

import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "assets" / "axon-mark.svg"

PNG_SIZES = (16, 32, 64, 128, 256)
ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)
# 同一个母版要同步出去的副本
SVG_COPIES = {
    "docs/web/public/favicon.svg": None,
    "template/web/web-vue/public/axon.svg": None,
    "template/web/web-vue/src/assets/axon.svg": None,
}
PNG_COPIES = {
    "template/assets/icon-256.png": 256,
}


def render_png(svg: Path, size: int, out: Path) -> None:
    """用 Qt 把 SVG 渲染成 PNG(只用 PySide6, 不引入 Pillow/cairosvg)。"""
    from PySide6.QtCore import QSize, Qt
    from PySide6.QtGui import QImage, QPainter
    from PySide6.QtSvg import QSvgRenderer

    renderer = QSvgRenderer(str(svg))
    if not renderer.isValid():  # pragma: no cover - 母版写错时才会走到
        raise SystemExit(f"SVG 解析失败: {svg}")
    image = QImage(QSize(size, size), QImage.Format.Format_ARGB32_Premultiplied)
    image.fill(Qt.GlobalColor.transparent)
    painter = QPainter(image)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
    painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform, True)
    renderer.render(painter)
    painter.end()
    out.parent.mkdir(parents=True, exist_ok=True)
    if not image.save(str(out), "PNG"):  # pragma: no cover
        raise SystemExit(f"写 PNG 失败: {out}")


def _bmp_frame(png: Path) -> bytes:
    """把一张 PNG 解码成 ICO 里的 32bit BMP(DIB) 帧。

    PyInstaller 读 .ico 时按老式 DIB 处理最稳, 所以这里不用 PNG-in-ICO。
    """
    from PySide6.QtGui import QImage

    image = QImage(str(png)).convertToFormat(QImage.Format.Format_ARGB32)
    w, h = image.width(), image.height()
    # XOR 位图: BGRA, 自下而上
    rows = []
    for y in range(h - 1, -1, -1):
        row = bytearray()
        for x in range(w):
            c = image.pixelColor(x, y)
            row += bytes((c.blue(), c.green(), c.red(), c.alpha()))
        rows.append(bytes(row))
    xor = b"".join(rows)
    # AND mask: 1bit, 行按 32bit 对齐, 全 0 表示"不透明"(配合 alpha 使用)
    mask_row_bytes = ((w + 31) // 32) * 4
    and_mask = b"\x00" * (mask_row_bytes * h)
    header = struct.pack(
        "<IiiHHIIiiII",
        40,  # biSize
        w,  # biWidth
        h * 2,  # biHeight: XOR + AND 两段
        1,  # biPlanes
        32,  # biBitCount
        0,  # biCompression = BI_RGB
        len(xor) + len(and_mask),  # biSizeImage
        0, 0, 0, 0,  # 分辨率与调色板
    )
    return header + xor + and_mask


def write_ico(png_by_size: dict[int, Path], out: Path) -> None:
    frames = [(size, _bmp_frame(png)) for size, png in sorted(png_by_size.items())]
    header = struct.pack("<HHH", 0, 1, len(frames))
    offset = len(header) + 16 * len(frames)
    entries = []
    body = []
    for size, data in frames:
        entries.append(
            struct.pack(
                "<BBBBHHII",
                0 if size >= 256 else size,
                0 if size >= 256 else size,
                0,
                0,
                1,
                32,
                len(data),
                offset,
            )
        )
        body.append(data)
        offset += len(data)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(header + b"".join(entries) + b"".join(body))


def main() -> int:
    if not MASTER.is_file():
        print(f"缺少图标母版: {MASTER}", file=sys.stderr)
        return 2

    made: list[Path] = []
    png_by_size: dict[int, Path] = {}
    for size in ICO_SIZES:
        out = ROOT / "assets" / f"icon-{size}.png"
        render_png(MASTER, size, out)
        png_by_size[size] = out
        made.append(out)

    ico = ROOT / "assets" / "axon.ico"
    write_ico(png_by_size, ico)
    made.append(ico)

    for rel in SVG_COPIES:
        dst = ROOT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(MASTER, dst)
        made.append(dst)

    for rel, size in PNG_COPIES.items():
        dst = ROOT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(png_by_size[size], dst)
        made.append(dst)

    for path in made:
        print(f"  {path.relative_to(ROOT)}  {path.stat().st_size:,} B")
    print(f"[icons] {len(made)} 个文件已更新（母版 assets/axon-mark.svg）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
