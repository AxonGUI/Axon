import os
import sys
import shutil
import urllib.request
import zipfile
import tempfile
from pathlib import Path

# 模板遠端地址（建議指向 GitHub 的 main 分支 zip）
TEMPLATE_URL = "https://github.com"


def init_project():
    if len(sys.argv) < 3 or sys.argv[1] != "init":
        print("用法: axon-gui init <項目名稱>")
        return

    project_name = sys.argv[2]
    target_path = Path.cwd() / project_name

    if target_path.exists():
        print(f"錯誤: 目錄 {project_name} 已存在")
        return

    print(f"正在從遠端拉取 AxonGUI 模板...")

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = Path(tmpdir) / "template.zip"

            # 1. 下載模板 zip
            urllib.request.urlretrieve(TEMPLATE_URL, zip_path)

            # 2. 解壓
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(tmpdir)

            # 3. 找到解壓後的目錄（GitHub zip 通常會多套一層文件夾）
            extracted_dir = next(Path(tmpdir).glob("AxonGUI-Template-*"))

            # 4. 拷貝到目標路徑
            shutil.copytree(extracted_dir, target_path)

        # 5. 項目個性化配置（如修改 package.json）
        # ... (同之前的邏輯)

        print(f"✨ 項目 {project_name} 初始化成功！")
    except Exception as e:
        print(f"初始化失敗: {e}")
