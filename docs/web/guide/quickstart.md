# 快速开始

一个 Axon 应用由两部分组成：

- **Python 侧**：一个普通 Python 程序，用 `AxonGUI` 打开一个窗口。
- **网页侧**：一个普通 HTML/Vue 页面，放在窗口里显示。

两端通过 `Axon` 这个对象互相调用。两种安装方式选一种，都能在几分钟内看到第一个「JS 调用 Python」的往返；想尽快看到东西就走方式一（官方模板，框架、构建、示例都配好了），想自己接线、或者只要一个纯 HTML 页面就走方式二。

## 前置条件

| 需要 | 说明 |
| --- | --- |
| Python 3.12+ | `python --version` 确认一下 |
| Node.js 20+ | 只有网页侧需要构建（Vue/TypeScript）时才用到；纯 HTML 页面不需要 |
| Linux 额外依赖 | `sudo apt-get install -y libxkbfile1`（Qt WebEngine 需要，缺了 `import axon` 会直接失败） |

## 方式一：用官方模板生成项目（推荐）

模板里 Vue 3 + Vite + TypeScript 都配好了，适合直接开始写正式界面。

**第一步仍然是安装 `axon-gui`**——`init` 这个命令来自它，而且它要能在任意目录里调用
（装在全局、或者用 `uv tool` / `pipx` 这类独立的命令行环境里），不能只在某个项目的
虚拟环境里：

```bash
# 装命令本身（三选一）
uv tool install axon-gui        # 推荐：独立环境，命令全局可用
pipx install axon-gui           # 同上
pip install --user axon-gui     # 没装 uv/pipx 时，装到用户目录

# 第二步：生成项目（在任何空目录里都行）
axon-gui init myapp
```

::: tip 只用装这一次
`axon-gui init` 会把 Python 运行时和网页运行时（含预构建的 `dist`）一起 vendor 进
`myapp/vendor/`，所以生成出来的项目不再需要 `axon-gui` 这个命令、也不依赖你 clone 过本仓库。

模板取的是**与你装的这个版本对应的 tag**（`v5.3.4` 就取 v5.3.4 的模板），拿不到才退 main，所以 CLI 和模板不会错版本。

生成的结构：

```text
myapp/
├── main.py                  # 窗口入口，已经接好本地静态服务
├── pyproject.toml           # 依赖 axon-gui（指向项目内的 vendor/axon-py）
├── controller/
│   └── JSCallPY.py          # 一个示例控制器：接收 JS 调用并打印参数
├── vendor/
│   ├── axon-py/             # Python 运行时（随项目走，不依赖全局安装）
│   └── axon-core/           # 网页运行时（预构建的 dist，npm 直接能吃）
└── web/web-vue/
    └── src/components/JSCallPY.vue   # 一个示例组件：调用上面的控制器
```

然后三步跑起来：

```bash
cd myapp
uv sync                            # 装 Python 依赖（装的是项目里自带的 vendor/axon-py）
cd web/web-vue && npm install && npm run build   # 构建前端
cd ../.. && python main.py
```

模板会把运行时直接 vendor 进项目（`vendor/axon-py`、`vendor/axon-core`），所以这里不需要
clone 本仓库、也不需要从源码构建——`uv sync` 装的就是项目自带的副本。

窗口打开后点页面上的按钮，Python 控制台会打印 `-----JSCallPYController-onCall- count 1-----`，页面上显示 Python 返回的文字。

开发前端时不用每次构建，用 Vite 热更新：

```bash
cd web/web-vue && npm run dev       # 5173 端口
WEB_ENV=dev python main.py          # 窗口直接连 5173
```

## 方式二：从 PyPI / npm 安装

```bash
pip install axon-gui      # Python 侧
npm install axon-gui      # 网页侧（纯 HTML 页面可以不用 npm，见下）
```

::: tip 版本
`axon-gui` 已发布在 [PyPI](https://pypi.org/project/axon-gui/)，`npm install axon-gui` 拿的是网页运行时，
两边版本号分别是 **5.3.4**（Python）和 **1.0.0**（npm），页面运行时跟框架版本解耦，各自升级即可。
:::

装好之后，一个能跑起来的最小项目只有两个文件。

### `main.py` —— Python 侧

```python
import sys
from pathlib import Path

from PySide6.QtWidgets import QApplication

from axon import AxonController, AxonGUI

HERE = Path(__file__).resolve().parent

@AxonController("MainView")          # 注册给名为 MainView 的窗口
class Greeter:
    def greet(self, name: str) -> str:   # 普通方法，返回值会自动回到 JS
        return f"你好, {name}!"

def main() -> int:
    app = QApplication(sys.argv)
    view = AxonGUI("MainView", (HERE / "index.html").as_uri())
    view.resize(900, 600)
    view.show()
    return app.exec()

if __name__ == "__main__":
    raise SystemExit(main())
```

关键只有三行：`@AxonController("MainView")` 把类注册给窗口、`AxonGUI("MainView", url)` 创建窗口、方法照常写。

### `index.html` —— 网页侧

```html
<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><title>Hello Axon</title></head>
  <body>
    <h1>Hello Axon</h1>
    <button id="run">调用 Python</button>
    <pre id="out"></pre>

    <script src="./node_modules/axon-gui/dist/axon.umd.cjs"></script>
    <script>
      const { Axon, AxonInit } = window.axon;

      // 启动时连一次通道（await 写法；普通 <script> 里没有顶层 await，包一层 async 函数）
      (async () => {
        const status = await AxonInit();
        console.log("connected:", status.connected);
      })();

      document.getElementById("run").addEventListener("click", async () => {
        // 就是这一行：调用 Python 侧的 Greeter.greet
        document.getElementById("out").textContent = await Axon.Greeter.greet("Axon");
      });
    </script>
  </body>
</html>
```

跑起来：

```bash
python main.py
```

窗口里点一下「调用 Python」，页面上出现 `你好, Axon!` —— 这句话是 Python 算完传回来的。

::: tip 用打包器（Vite / webpack）时
页面里改成 `import { Axon, AxonInit } from "axon-gui";` 即可，后面所有示例都是这种写法。上面用 `window.axon` 只是为了不开打包工具也能跑。
:::

## 下一步

- [调用 Python 方法](/examples/call)：参数、关键字参数、async、超时、异常
- [读写 Python 属性](/examples/property)：属性怎么双向同步
- [从 Python 调 JS](/examples/py-to-js)：反方向的调用
- [事件](/examples/event)：不等返回值的那种通知
- [架构与消息流](/guide/architecture)：一次调用到底经过了什么
