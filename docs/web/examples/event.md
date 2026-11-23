# 事件

两端的 `AxonEvent` 都是 EventTarget 风格，事件名就是普通字符串。

## Python → JS

```python
from axon import AxonEvent

AxonEvent.dispatch_js_event("AxonDocs", "demo:event", ["hello from python"])
```

```ts
import { AxonEvent } from "axon-gui";

const listener = (text: string) => console.log(text);
AxonEvent.addListener("demo:event", listener);
// 用完记得摘掉：AxonEvent.removeListener("demo:event", listener);
```

<LiveDemo id="eventPyToJs" />

## JS → Python

```ts
AxonEvent.dispatchPYEvent({ type: "demo:pong", args: [1, 2, 3] });
```

```python
@AxonController("AxonDocs")
class DemoController:
    def __init__(self):
        AxonEvent.add_listener("demo:pong", self._on_pong)

    def _on_pong(self, *args):
        self.pong.append(list(args))
```

<LiveDemo id="eventJsToPy" />

## 长任务进度

长任务不需要轮询：Python 边算边推事件，JS 收到就渲染。

<LiveDemo id="stream" />

## Qt 窗口事件

`AxonGUI` 会把 Qt 的窗口/拖拽事件转发给页面，事件名与参数：

| 事件名 | 参数 |
| --- | --- |
| `loadFinished` | 无（见下方说明） |
| `contextMenu` | `{reason, globalPos: {x, y}, pos: {x, y}}` |
| `dragEnter` / `dragMove` / `drop` | `QDropEventToDict(e)`：`mimeData`（urls/text/html/formats）、`pos`、`posF`、`modifiers`、`dropAction` 等 |
| `dragLeave` / `hide` / `show` | 无 |

::: tip loadFinished 的时序
后端把 `loadFinished` 攒到前端 `AxonInit()` 报到（`AxonEnv.ready()`）之后才派发，
所以你在 `await AxonInit()` 之后注册的监听器收得到它。页面加载完成但前端还没握手时派发，
事件会丢 —— 这是旧版的实际行为。
:::
