# 事件

<span class="channel-tag">双向</span>

调用有返回值，事件没有。适合「通知一声」的场景：按钮被点了、进度更新了、窗口加载完了。

两端的事件 API 名字几乎一样，事件名是任意字符串，参数是 JSON 数组。

## Python 侧

```python
# controller.py
import threading

from axon import AxonController, AxonEvent

WEB = "MainView"


@AxonController(WEB)
class DemoController:
    def __init__(self) -> None:
        self.pong_log: list[list] = []
        self._lock = threading.Lock()
        # 监听 JS 发来的事件
        AxonEvent.add_listener("demo:pong", self._on_pong)

    def _on_pong(self, *args) -> None:
        with self._lock:
            self.pong_log.append(list(args))

    # 主动向 JS 发事件
    def push_event(self, text: str) -> bool:
        AxonEvent.dispatch_js_event(WEB, "demo:event", [text])
        return True

    def get_pong(self) -> list[list]:
        with self._lock:
            return list(self.pong_log)
```

监听器在工作线程里执行，**不要在里面做耗时操作**。

## JS 侧

```js
import { AxonEvent } from "axon-gui";

// 监听 Python 发来的事件
function onEvent(text) {
  console.log("Python 说:", text);
}
AxonEvent.addListener("demo:event", onEvent);

// 反过来：给 Python 发事件
AxonEvent.dispatchPYEvent({ type: "demo:pong", args: [1, 2, 3] });

// 用完记得摘掉监听
AxonEvent.removeListener("demo:event", onEvent);
```

## 点一下试试

### Python 发事件 → JS 收到

<LiveDemo id="eventPyToJs" />

### JS 发事件 → Python 收到（再回查 Python 记了什么）

<LiveDemo id="eventJsToPy" />

### 长任务推进度

一次性调用会一直等到结束；如果想让界面先看到中间状态，就用事件推：

```python
def stream(self, count: int = 4) -> dict:
    for i in range(count):
        AxonEvent.dispatch_js_event(WEB, "demo:progress", [{"step": i + 1, "total": count}])
        time.sleep(0.15)
    return {"done": count}
```

<LiveDemo id="stream" />

## 窗口自带的事件

除了自己起名字，`AxonEvent` 还会把 Qt 窗口的事件转成同名事件发给 JS：

| 事件名 | 什么时候发 |
| --- | --- |
| `loadFinished` | 页面加载完成（并且 JS 通道已就绪） |
| `contextMenu` | 右键菜单 |
| `dragEnter` / `dragMove` / `drop` / `dragLeave` | 拖文件进窗口 |
| `hide` / `show` | 窗口隐藏 / 显示 |

```js
AxonEvent.addListener("loadFinished", () => {
  console.log("页面加载完成");
});
```

## 要点

- **事件没有返回值**，别指望 `await` 拿到东西；需要结果就用调用。
- **事件名两端必须一致**，写错不会报错，只是收不到。
- **`loadFinished` 要等通道连上**：先 `await AxonInit()` 再注册监听；框架会等 JS 报到后才派发这个事件。
- **事件量控制一下**：每条事件都是一次跨端消息，刷太密会拖慢界面。
