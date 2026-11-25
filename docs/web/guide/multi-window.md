# 跨窗口交互

一个 Axon 应用可以同时开好几个窗口（每个窗口一个 `AxonGUI`）。窗口之间也能互相调：
A 窗口的 JS 可以调 B 窗口的 JS，也可以一次打到所有窗口。

::: tip 一句话
窗口之间没有直连的通道，所有跨窗口调用都经 Python 中转——因为只有 Python 知道现在到底有哪些窗口活着。
:::

## 三种用法

| 想要的效果 | JS 侧 | Python 侧 |
| --- | --- | --- |
| 问一下有哪些窗口 | `AxonCross.windows()` | `AxonCross.windows()` |
| 调指定窗口里的 JS 方法 | `AxonCross.web("charts").Charts.reload()` | `AxonCross.call("charts", "Charts", "reload")` |
| 一次打到所有窗口 | `AxonCross.broadcast({...})` | `AxonCross.broadcast("Toasts", "show", "已保存")` |
| 发事件给所有窗口 | `AxonCross.emit("theme:changed", "dark")` | `AxonCross.emit("theme:changed", "dark")` |
| 发事件给一个窗口 | `AxonCross.emitTo("charts", "theme:changed", "dark")` | `AxonCross.emit_to("charts", "theme:changed", "dark")` |

「窗口名」就是建窗口时给 `AxonGUI` 的第一个参数。

## 调指定窗口

假设 `main` 窗口想通知 `charts` 窗口重新拉数据。

```python
# main.py —— 先把两个窗口开出来
from axon import AxonGUI, AxonMagicGUI, AxonCross

app = QApplication([])
AxonMagicGUI()
main = AxonGUI("main", "http://127.0.0.1:5173/")
charts = AxonGUI("charts", "http://127.0.0.1:5173/charts.html")
```

```javascript
// charts 窗口里：注册一个 JS 控制器，别人就能调它
import { AxonController } from "axon-gui";

AxonController.register("Charts", {
  reload(range = "1d") {
    return loadSeries(range); // 返回 Promise 也行
  },
});
```

```javascript
// main 窗口里：调 charts 窗口的 Charts.reload()
import { AxonCross } from "axon-gui";

await AxonCross.web("charts").Charts.reload("600s");
```

写法跟 `Axon.xxx` 一样：位置参数直接摊开；要 kwargs / 超时就用打包写法
`Charts.reload([args], { kwargs }, timeoutMs)`。

也可以显式写全：

```javascript
const value = await AxonCross.call({
  web: "charts",
  controller: "Charts",
  func: "reload",
  args: ["600s"],
  timeout: 5000,
});
```

## 一次打到所有窗口

「所有人都刷新一下」这种，用广播。每个窗口各自返回结果，**一个窗口失败不影响别的**。

```javascript
import { AxonCross } from "axon-gui";

import { AxonCross, AxonChannels } from "axon-gui";

const results = await AxonCross.broadcast({
  controller: "Toasts",
  func: "show",
  args: ["配置已保存"],
  exclude: [AxonChannels.AxonEnv.web_name], // 不用发给自己就不发
});

for (const item of results) {
  if (!item.ok) console.warn(item.web, "没收到:", item.error);
}
```

Python 侧：

```python
from axon import AxonCross

futures = AxonCross.broadcast("Toasts", "show", "配置已保存")

# 一次等齐，单个窗口失败只记在它自己那条结果里
for item in AxonCross.results(futures, timeout=5):
    if not item["ok"]:
        print(f"{item['web']} 没收到: {item['error']}")

# 也可以逐窗口等：
for web, future in futures.items():
    try:
        future.result(5)
    except TimeoutError:
        print(f"{web} 没回应")
```

## 发事件

事件是「只通知、不要返回值」，比调用更轻，适合主题切换、菜单命令这类。

```javascript
// charts 窗口里接
import { AxonEvent } from "axon-gui";

AxonEvent.addListener("theme:changed", (theme) => applyTheme(theme));
```

```javascript
// main 窗口里发（默认发给所有窗口，包括自己）
await AxonCross.emit("theme:changed", "dark");

// 只发给 charts
await AxonCross.emitTo("charts", "theme:changed", "dark");
```

Python 侧同样能发，接事件的仍然是 JS：

```python
from axon import AxonCross

AxonCross.emit("theme:changed", "dark")          # 所有窗口
AxonCross.emit_to("charts", "theme:changed", "dark")  # 指定窗口
```

## 窗口表与生命周期

`AxonCross.windows()`（JS / Python 都一样）返回**现在还开着**的窗口名。

窗口关闭时会自动从表里摘掉；对已经关掉的窗口发起调用会立刻失败，而不是一直挂着：

```
RuntimeError: web `charts` not found
```

想在 JS 里开新窗口，让 Python 帮你开：写一个控制器方法就行。

```python
@AxonController("main")
class Shell:
    def open_window(self, web_name: str, url: str):
        from axon import AxonGUI

        if AxonCross.has(web_name):
            return False
        window = AxonGUI(web_name, url)
        window.show()
        return True
```

## 超时与错误

- JS 侧的 `timeout` 单位是**毫秒**（和 `Axon` 一致）；Python 侧的 `timeout` 单位是**秒**（和 `.result(5)` 一致）。
- 目标窗口里的异常会原样传回调用方：JS 侧是 rejected Promise（消息里带 Python 侧栈），
  Python 侧是 Future 里的异常。
- 广播里某个窗口超时/报错只影响它自己那条结果（`{web, ok:false, error}`）。

::: warning 别写成环
A → B → A 这种「回头调」是可以的（不会互相卡死），但别写出不带出口的递归：
每次跨窗口调用都是真实的往返，环会一直转下去。要传递结果就一路 return 回去。
:::

## 跨窗口共享状态

如果需求是「两个窗口看到同一份数据」，不要用调用硬凑，用共享 Store：

```javascript
import { AxonStore } from "axon-gui";

AxonStore.shared.set("theme", "dark"); // 所有窗口的 shared 都会更新
```

细节见 [跨端 Store](/examples/store)。
