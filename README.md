<p align="center">
  <img src="assets/axon-mark.svg" alt="Axon" width="88" height="88" />
</p>

<p align="center"><b>简体中文</b> · <a href="README.en.md">English</a></p>

# Axon（分发包名 `axon-gui`）

[![PyPI](https://img.shields.io/badge/PyPI-axon--gui%205.3.5-3451b2)](https://pypi.org/project/axon-gui/)
[![npm](https://img.shields.io/badge/npm-axon--gui%201.1.0-cb3837)](https://www.npmjs.com/package/axon-gui)
[![docs](https://img.shields.io/badge/%E8%AF%B4%E6%98%8E%E4%B9%A6-GitHub%20Pages-3451b2)](https://axongui.github.io/)
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

- 运行时：PySide6 6.7 – 6.x（QtWebEngine，上限 < 7.0）+ 任意前端（模板用 Vue 3 + Vite）
- Python：3.12 / 3.13 / 3.14（PySide6 目前支持到 3.15，安装元数据写 `>=3.12,<3.16`）
- License：MIT

## 在线文档（中文 / English）

说明文档托管在 GitHub Pages: 中文 **<https://axongui.github.io/>** · English **<https://axongui.github.io/en/>**
（右上角地球图标可切语言；英文站与中文站共用同一套组件、同一份构建产物）

同一个站点有两种形态, 不需要两个站点:

- **浏览器直接打开** -> 纯说明书, 只有代码;
- **用说明书的桌面客户端打开** -> 按钮真的调用 Python 后端, 并把消息流逐条显示出来。

## 下载

[Releases](https://github.com/AxonGUI/Axon/releases) 里每个版本都带三类产物:

| 产物 | 用途 |
| --- | --- |
| `axon_gui-*.whl` / `axon_gui-*.tar.gz` | Python 包: `pip install axon_gui-*.whl` |
| `axon-gui-*.tgz` | 前端包: `npm i ./axon-gui-*.tgz` |

说明书的桌面客户端（`AxonDocs`，自带 Python 运行时）跟着说明书仓走：
[AxonGUI/axongui.github.io 的 Releases](https://github.com/AxonGUI/axongui.github.io/releases)。

## 相关项目

| 仓库 | 作用 |
| --- | --- |
| [AxonGUI/Axon](https://github.com/AxonGUI/Axon) | 框架本体：通道、控制器、事件、Store、语法糖 |
| [AxonGUI/AxonShell](https://github.com/AxonGUI/AxonShell) | 可选的窗口外观层（`pip install axon-shell`）：无边框窗口、拖拽/缩放命中、窗口控制、原生菜单 |
| [AxonGUI/templates](https://github.com/AxonGUI/templates) | 项目模板：Vue 3 / React 19 / Angular 20，`axon-gui init` 自动取用 |
| [AxonGUI/axongui.github.io](https://github.com/AxonGUI/axongui.github.io) | 说明书站（含可交互示例与桌面客户端打包） |

外观层单独成包，是因为窗口 chrome 属于「应用长什么样」，不属于「通道怎么走」。想用自己画的标题栏就装 `axon-shell`，只要能力就不要多一个依赖。

## 仓库结构

| 目录 | 内容 |
| --- | --- |
| `core-py/axon/` | Python 运行时：`AxonGUI`（窗口）、`Axon`（调 JS 的语法糖）、`AxonController`（注册 Python 控制器）、`AxonStore`、`AxonEvent`、`AxonMagicGUI` |
| `core-js/lib/` | 前端运行时：`AxonInit`、`Axon`（调 Python 的 Proxy）、`AxonController`、`AxonStore`、`AxonEvent` |
| `assets/` | 图标：母版 `axon-mark.svg`（A 字 + 中间那条通道）、无底板字形 `axon-mark-glyph.svg`、旧图标矢量化 `axon-mark-legacy.svg`；`tools/make_icons.py` 由母版生成 PNG / `axon.ico` / 组织头像，文档站 favicon、exe 图标、窗口图标、模板页 logo 全部同源 |
| `tools/make_icons.py` | 改图标只改母版，然后跑一次它，所有副本重生成 |
| `core-py/axon/cli.py` | `axon-gui init`：从 templates 仓取模板，把运行时 vendor 进项目 |

## 快速开始

给使用者两条路，都在[快速开始](https://axongui.github.io/guide/quickstart)里逐步展开：

```bash
# 方式一：用模板生成项目（推荐）（模板 + 前端运行时 + Python 运行时都会 vendor 进来）
#   先装命令本身，而且要全局可用：uv tool / pipx / pip install --user
uv tool install axon-gui
axon-gui init myapp && cd myapp
uv sync && ( cd web && npm install && npm run build && cd .. )
python main.py

# 方式二：装现成的包（pip / npm 各一条）
pip install axon-gui
npm install axon-gui
```

想在本仓库里改代码：

```bash
sudo apt-get install -y libxkbfile1      # Linux 上 QtWebEngine 需要
cd core-py && uv sync && cd ..           # Python 3.12 + PySide6（运行时；3.13/3.14 同样跑通验证台）
cd core-js && npm ci && npm run build && cd ..   # 前端运行时 -> dist/

cd core-js && npm ci && npm run build && cd ..   # 前端运行时 -> dist/
```

## 验证

不是「写完没跑过」：仓库里有两层自动化验证，都是真实依赖、真实窗口、真实通道。

```bash
core-py/.venv/bin/python core-py/tests/run_web_tests.py        # 37 条接口断言(真 WebEngine)
core-py/.venv/bin/python core-py/tests/run_multi_window_tests.py  # 18 条跨窗口断言(两个真窗口)
```

模板与说明书各有自己的验证：模板仓跑 `tools/verify_template.py`（真窗口点按钮），
说明书仓跑 `scripts/verify_docs.py` / `verify_offline.py`。

最近一次：`37/37` 接口断言、`18/18` 跨窗口断言、三套模板契约测试全过。

## 状态

个人项目，API 还在动：核心通道（调用/属性/事件/Store/主线程）已经端到端跑通，Linux / Windows
上有回归脚本与打包自检。PyPI 上可以 `pip install axon-gui`（5.4.0），npm 上是 `axon-gui@1.1.1`。适合当架构参考
或直接读源码改造，不建议现在作为生产依赖引入。

---

贡献与安全： [参与开发](CONTRIBUTING.md) · [安全策略](SECURITY.md) · [变更记录](CHANGELOG.md)
（For English: [Contributing](CONTRIBUTING.en.md) · [Security](SECURITY.en.md) · [Changelog](CHANGELOG.en.md)）
