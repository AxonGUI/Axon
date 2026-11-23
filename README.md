# Axon（分发包名 `axon-gui`）

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

## 仓库结构

| 目录 | 内容 |
| --- | --- |
| `core-py/axon/` | Python 运行时：`AxonGUI`（窗口）、`Axon`（调 JS 的语法糖）、`AxonController`（注册 Python 控制器）、`AxonStore`、`AxonEvent`、`AxonMagicGUI` |
| `core-js/lib/` | 前端运行时：`AxonInit`、`Axon`（调 Python 的 Proxy）、`AxonController`、`AxonStore`、`AxonEvent` |
| `docs/` | 文档站（VitePress）+ 可交互示例 + 验证脚本 |
| `template/` | `axon-gui init` 使用的项目模板（Python 入口 + Vue 3 前端） |

## 快速开始

```bash
# 1. 运行环境
sudo apt-get install -y libxkbfile1     # QtWebEngine 需要
cd core-py && uv sync                   # Python 3.12 + PySide6

# 2. 建项目（模板 + core-js + Python 运行时都会 vendor 进来）
uv run axon-gui init myapp && cd myapp
uv sync
cd web/web-vue && npm install && npm run build && cd ../../..
python main.py

# 3. 看文档（同一个站点，两种形态）
cd docs/web && npm install && npm run docs:build
cd ../.. && core-py/.venv/bin/python docs/main.py     # 在 AxonGUI 里打开 -> 示例可点
cd docs/web && npm run docs:dev                       # 浏览器打开 -> 纯说明书
```

## 验证

不是「写完没跑过」：仓库里有两层自动化验证，都是真实依赖、真实窗口、真实通道。

```bash
core-py/.venv/bin/python core-py/tests/run_web_tests.py   # 32 条接口断言
core-py/.venv/bin/python docs/verify_docs.py              # 文档站 15 个可点示例
core-py/.venv/bin/python docs/verify_offline.py           # 无后端时的纯文档形态
```

最近一次：`37/37` 接口断言通过，`15/15` 可交互示例通过，纯文档形态 6 项检查通过。
逐条清单见文档站 [notes/verified](docs/web/notes/verified.md)，过程中修掉的坑见
[notes/pitfalls](docs/web/notes/pitfalls.md)。

## 状态

个人项目，API 还在动：核心通道（调用/属性/事件/Store/主线程）已经端到端跑通并有回归脚本，
发布形态（PyPI、CI、变更日志）尚未建立。适合当架构参考或直接读源码改造，不建议现在作为
生产依赖引入。
