# 参与开发

<p align="center"><b>简体中文</b> · <a href="CONTRIBUTING.en.md">English</a></p>

这个项目把「Python 写后端、Web 写界面」的两侧做成两条同名 API，所以改动的验证
不是「能跑就行」，而是**两侧都要跑过真实通道**。

## 环境

```bash
git clone https://github.com/AxonGUI/Axon
cd Axon/core-py && uv sync            # Python 3.12 + PySide6
cd ../core-js && npm ci               # 前端运行时
cd ../docs/web && npm ci              # 文档站（只在改文档时需要）
```

Linux 缺 `libxkbfile1` 会导致 `import axon` 直接失败：

```bash
sudo apt-get install -y libxkbfile1
```

## 三条验证命令（提交前都跑一遍）

```bash
core-py/.venv/bin/python core-py/tests/run_web_tests.py   # 真 QWebEngine 上的接口断言
docs/.venv/bin/python docs/verify_docs.py                  # 文档站 22 个可点示例（含英文页）
docs/verify_offline.py                                     # 纯网页形态（无 Python 后端）
```

改了 `core-js/lib/**` 还要：

```bash
cd core-js && npm run build    # 产物进仓库，dist/build-info.json 会跟着更新
```

`dist/build-info.json` 是源码指纹（`lib/**/*.ts` 的 sha256），CI 只校验它——不要手工改。

## 目录职责

| 目录 | 里面是什么 | 改动后要跑 |
| --- | --- | --- |
| `core-py/axon/` | Python 运行时：窗口、通道、控制器、Store、事件 | 验证台 |
| `core-js/lib/` | JS 运行时：Proxy 调用、事件、Store | 验证台 + `npm run build` |
| `docs/web/` | 文档站（VitePress），同一份产物两种形态 | `npm run docs:build` + 两个 verify |
| `template/` | `axon-gui init` 用的模板 | 生成一个项目并 `npm run build` |
| `docs/` | 文档站的 Python 控制器 + 打包成客户端 | 真桌面跑一次 exe |

## 风格

- Python 侧不引第三方依赖（除 PySide6），保持 `uv sync` 就能跑。
- 对外接口改名/改语义要同时改：文档站对应页、`CHANGELOG.md` / `CHANGELOG.en.md`、验证台断言。
- 错误信息写清楚「谁找不到 / 期望什么」，用户看到的最后一个报错往往就是提示本身。

## 提交

小改动直接提 PR 也行；跨目录的改动请把验证结果贴进 PR 描述（命令 + 通过条数）。

## 发版

1. 改版本号：`core-py/pyproject.toml`，以及 `docs/web/guide/quickstart.md` 与 `docs/web/en/guide/quickstart.md` 里的 wheel URL。
2. 写 `CHANGELOG.md` 与 `CHANGELOG.en.md`（把 `Unreleased` 挪成新版本号）。
3. `git tag -a v<版本> -m "Axon <版本>"` 并 push tag → `.github/workflows/release.yml` 产出
   Python 包 / npm 包 / Windows + Linux 客户端。
4. **PyPI**：需要在 PyPI 上给这个仓库配一次 Trusted Publisher
   （Publisher: GitHub → `AxonGUI/Axon` → workflow `publish-pypi.yml` → environment `pypi`），
   然后把该 workflow 顶部的 `release:` 触发打开。配好之前 `pip install axon-gui` 不可用，
   文档里用 Release 的 wheel 兜底。
5. 发完核对 Release 资产与「解压后双击 `AxonDocs/AxonDocs.exe`」这句是否还对。
