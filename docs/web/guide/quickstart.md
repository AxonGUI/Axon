# 快速开始

Axon 由两半组成：`core-py`（PySide6 里的窗口、通道、Python 侧 API）和 `core-js`（前端用的 `Axon` 语法糖、Store、事件）。
Python 要求 **3.12+**。

## 1. 装 Python 依赖

```bash
cd core-py
uv sync                # 或 pip install -e .
```

`PySide6` 是硬依赖。在 Linux 上还需要系统库 `libxkbfile1`（QtWebEngine 的间接依赖），否则
`import axon` 会直接抛 `ImportError`：

```bash
sudo apt-get install -y libxkbfile1
```

## 2. 装前端依赖

```bash
cd core-js && npm ci        # 给库自己用（打包 / 类型检查 / 验证台）
```

前端工程引用本库有两种方式：

```jsonc
// 指向源码（开发时最省事，Vite 会直接编译 TS）
"axon-gui": "file:../../core-js"
```

```bash
# 或者把 core-js 打成 npm 包
cd core-js && npm run build     # 产物在 core-js/dist
```

## 3. 写一个最小的窗口

`main.py`：

```python
import os
import sys

from PySide6.QtWidgets import QApplication

from axon import AxonGUI, AxonMagicGUI, AxonController


@AxonController("MainView")           # 这个控制器只对名叫 MainView 的窗口生效
class HelloController:
    def greet(self, name: str):
        return f"你好，{name}！这条消息来自 Python 进程。"


if __name__ == "__main__":
    app = QApplication(sys.argv)
    AxonMagicGUI()                     # 要在任何 AxonMagicGUI.run 之前创建
    view = AxonGUI("MainView", "http://127.0.0.1:5173/")
    view.resize(1100, 720)
    view.show()
    sys.exit(app.exec())
```

前端 `src/main.ts`：

```ts
import { createApp } from "vue";
import { Axon, AxonInit } from "axon-gui";
import App from "./App.vue";

const status = await AxonInit();        // 返回状态对象，不会抛错
createApp(App).mount("#app");

// 通道通了就能直接调
if (status.ready) {
  console.log(await Axon.HelloController.greet(["Axon"]));
}
```

::: tip 为什么 `AxonInit()` 要尽早调
Qt 的 `loadFinished` 早于前端握手完成是常态。前端在 `AxonInit()` 里会主动向后端报到，
后端收到报到后才派发 `loadFinished` 事件 —— 所以 `AxonInit()` 越早调用，事件越不容易错过。
:::

## 4. 把文档站当桌面程序打开

`docs/main.py` 会起一个只监听 `127.0.0.1` 的静态服务器，把 VitePress 的构建产物塞进 AxonGUI 窗口：

```bash
# 构建文档（首次需要装依赖）
cd docs/web && npm install && npm run docs:build

# 用桌面窗口打开，附带可交互示例
cd ../.. && python docs/main.py
```

`--dev` 模式下不读构建产物，而是直接加载 Vite dev server（<http://127.0.0.1:5174>），
改文档即时生效：

```bash
cd docs/web && npm run docs:dev      # 终端 1
python docs/main.py --dev            # 终端 2
```

## 在 AxonGUI 里打开文档

`docs/main.py` 用的窗口名是 `AxonDocs`，`DemoController` 就注册在这个窗口上。
页面顶部状态条显示「交互模式」时，说明通道通了；显示「纯文档模式」则是没有后端（比如直接用浏览器打开
`dist/index.html`）。

## 下一步

- 想理解两条通道怎么配对：[架构与消息流](/guide/architecture)
- 想直接试接口：[可交互示例](/examples/call)
- 遇到怪问题先看：[已知坑与修复](/notes/pitfalls)
