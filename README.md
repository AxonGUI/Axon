<p align="center">
  <img src="assets/axon-mark.svg" alt="Axon" width="88" height="88" />
</p>

# Axon（分发包名 `axon-gui`）

[![docs](https://img.shields.io/badge/%E8%AF%B4%E6%98%8E%E4%B9%A6-GitHub%20Pages-3451b2)](https://axongui.github.io/Axon/)
[![release](https://img.shields.io/badge/%E4%B8%8B%E8%BD%BD-Windows%20%7C%20Linux-2ea44f)](https://github.com/AxonGUI/Axon/releases)

用 Python 写后端、用 Web 写界面的混合桌面框架：一个 `QWebEngineView` 里跑你的前端，
Python 对象通过 QWebChannel 双向暴露成「语法糖」，两端都能像调本地对象一样调对方。

```python
# Python: 调前端
Axon("main").UserCard.render({"name": "Ada"})     # JS: UserCard.render(...)
await Axon("main").UserCard.theme                 # 读 JS 属性

# 前端: 调 Python
await Axon.Users.add("Ada", 36)                   # 调用 @AxonController("main") 的方法
await Axon.Users.count                            # 读 Python 属性
await Axon.Users.add(["Ada", 36])                 # 打包写法（要带 kwargs / timeout 时用）
```

- 运行时：PySide6 6.x（QtWebEngine）+ 任意前端（模板用 Vue 3 + Vite）
- Python：>= 3.12
- License：MIT

## 在线文档

说明文档托管在 GitHub Pages: **<https://axongui.github.io/Axon/>**

同一个站点有两种形态, 不需要两个站点:

- **浏览器直接打开** -> 纯说明书, 只有代码;
- **用 AxonGUI 打开**(`python docs/main.py`) -> 按钮真的调用 Python 后端, 并把消息流逐条显示出来。

## 下载

[Releases](https://github.com/AxonGUI/Axon/releases) 里每个版本都带三类产物:

| 产物 | 用途 |
| --- | --- |
| `AxonDocs-windows-x64.zip` / `AxonDocs-linux-x64.tar.gz` | 文档站桌面客户端: 自带 Python + PySide6 + 文档构建产物, 解压即用(Linux 需 `libxkbfile1`) |
| `axon_gui-*.whl` / `axon_gui-*.tar.gz` | Python 包: `pip install axon_gui-*.whl` |
| `axon-gui-*.tgz` | 前端包: `npm i ./axon-gui-*.tgz` |

客户端自检: `AxonDocs --smoke`(退出码 0 = 通道连通且示例能跑)。

macOS 客户端不在 CI 里出(本仓库拉不到 macOS runner, 任务会在启动前被取消), 需要的话在 Mac 上自己打一份:

```bash
python3 -m venv .venv
.venv/bin/pip install -e core-py pyside6 pyinstaller
( cd docs/web && npm ci && npm run docs:build )
.venv/bin/python docs/build_client.py --name AxonDocs      # -> build/client/dist/AxonDocs
```

## 仓库结构

| 目录 | 内容 |
| --- | --- |
| `core-py/axon/` | Python 运行时：`AxonGUI`（窗口）、`Axon`（调 JS 的语法糖）、`AxonController`（注册 Python 控制器）、`AxonStore`、`AxonEvent`、`AxonMagicGUI` |
| `core-js/lib/` | 前端运行时：`AxonInit`、`Axon`（调 Python 的 Proxy）、`AxonController`、`AxonStore`、`AxonEvent` |
| `docs/` | 文档站（VitePress，发布到 GitHub Pages）+ 可交互示例 + 客户端打包 + 验证脚本 |
| `template/` | `axon-gui init` 使用的项目模板（Python 入口 + Vue 3 前端） |
| `assets/` | 图标母版 `axon-mark.svg` 与生成出的 PNG / `axon.ico`：文档站 favicon、exe 图标、窗口图标、模板页 favicon 都用它 |
| `tools/make_icons.py` | 改图标只改母版，然后跑一次它，所有副本重生成 |

## 快速开始

给使用者两条路，都在[快速开始](https://axongui.github.io/Axon/guide/quickstart)里逐步展开：

```bash
# 方式一：用模板生成项目（推荐）（模板 + 前端运行时 + Python 运行时都会 vendor 进来）
#   先装命令本身，而且要全局可用：uv tool / pipx / pip install --user
uv tool install axon-gui
axon-gui init myapp && cd myapp
uv sync && ( cd web/web-vue && npm install && npm run build && cd ../../.. )
python main.py

# 方式二：装现成的包（PyPI 上架中；没上架时先装 Release 里的 wheel）
pip install axon-gui
npm install axon-gui
```

想在本仓库里改代码或重新构建文档站：

```bash
sudo apt-get install -y libxkbfile1      # Linux 上 QtWebEngine 需要
cd core-py && uv sync && cd ..           # Python 3.12 + PySide6（本仓库的运行时）
cd core-js && npm ci && npm run build && cd ..   # 前端运行时 -> dist/

cd docs/web && npm ci && npm run docs:build && cd ../.. && core-py/.venv/bin/python docs/main.py
cd docs/web && npm run docs:dev           # 浏览器打开 -> 同一站点的纯文档形态
```

## 验证

不是「写完没跑过」：仓库里有两层自动化验证，都是真实依赖、真实窗口、真实通道。

```bash
core-py/.venv/bin/python core-py/tests/run_web_tests.py   # 37 条接口断言(真 WebEngine)
core-py/.venv/bin/python docs/verify_docs.py              # 文档站 14 个可点示例
core-py/.venv/bin/python docs/verify_offline.py           # 无后端时的纯文档形态
python docs/build_client.py && ./build/client/dist/AxonDocs --smoke   # 打包客户端 + 自检
```

最近一次：`37/37` 接口断言通过，`14/14` 可交互示例通过，纯文档形态 6 项检查通过。
逐条清单见文档站 [notes/verified](docs/web/notes/verified.md)，过程中修掉的坑见
[notes/pitfalls](docs/web/notes/pitfalls.md)。

## 状态

个人项目，API 还在动：核心通道（调用/属性/事件/Store/主线程）已经端到端跑通，Linux / Windows
上有回归脚本与打包自检，npm 上可以装到 `axon-gui@1.0.0`（PyPI 正在上架流程中）。适合当架构参考
或直接读源码改造，不建议现在作为生产依赖引入。
