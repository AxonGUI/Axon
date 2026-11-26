"""调用 Node 侧脚本，从 TS/JS 源码里抽出前端控制器的形状。"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from .schema import SchemaError

_SCRIPT = Path(__file__).with_name("extract_js.mjs")


def extract_javascript(target: Path) -> list[dict[str, Any]]:
    """返回 ``[{name, members, file}, …]``；``members`` 里 ``kind`` 是 ``method``/``prop``。"""
    if not target.exists():
        raise SchemaError(f"找不到要解析的前端路径: {target}")

    node = shutil.which("node")
    if node is None:
        raise SchemaError(
            "需要 node 才能解析前端源码（Vite 项目本来就有）；或者跳过 --js，只生成 TypeScript 侧。"
        )

    result = subprocess.run(
        [node, str(_SCRIPT), str(target)],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise SchemaError(f"解析前端源码失败（exit {result.returncode}）:\n{detail}")

    stdout = result.stdout.strip()
    if not stdout:
        raise SchemaError("解析前端源码没有输出（脚本可能没有找到任何 AxonController.register）")

    try:
        payload = json.loads(stdout.splitlines()[-1])
    except json.JSONDecodeError as exc:
        raise SchemaError(f"解析前端源码的输出不是 JSON: {exc}\n{stdout[:400]}") from exc

    controllers = payload.get("controllers") or []
    if payload.get("mode") == "regex":
        print(
            "[types] 没找到 typescript 模块（装在项目里才行），已退化为正则解析："
            "只能拿到方法名，参数类型一律 Any",
            file=sys.stderr,
        )
    return controllers
