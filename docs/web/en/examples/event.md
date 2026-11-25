# Events

<span class="channel-tag">both directions</span>

Calls return values; events do not. They suit "just tell me something happened": a button was clicked,
progress moved, the window finished loading.

The event API has nearly the same names on both sides. An event name is any string and the payload is a
JSON array.

## Python side

```python [controller.py]
# controller.py
import threading

from axon import AxonController, AxonEvent

WEB = "MainView"

@AxonController(WEB)
class DemoController:
    def __init__(self) -> None:
        self.pong_log: list[list] = []
        self._lock = threading.Lock()
        # listen to events sent from JS
        AxonEvent.add_listener("demo:pong", self._on_pong)

    def _on_pong(self, *args) -> None:
        with self._lock:
            self.pong_log.append(list(args))

    # push an event to JS
    def push_event(self, text: str) -> bool:
        AxonEvent.dispatch_js_event(WEB, "demo:event", [text])
        return True

    def get_pong(self) -> list[list]:
        with self._lock:
            return list(self.pong_log)
```

Listeners run on a worker thread — **do not do slow work inside them**.

## JS side

```js [app.js]
import { AxonEvent } from "axon-gui";

// listen to events sent from Python
function onEvent(text) {
  console.log("Python says:", text);
}
AxonEvent.addListener("demo:event", onEvent);

// the other direction: send an event to Python
AxonEvent.dispatchPYEvent({ type: "demo:pong", args: [1, 2, 3] });

// remove the listener when you are done
AxonEvent.removeListener("demo:event", onEvent);
```

## Python dispatches → JS receives

<LiveDemo id="eventPyToJs" />

## JS dispatches → Python receives (then read back what Python recorded)

<LiveDemo id="eventJsToPy" />

## Progress for long tasks

A single call waits until it finishes. To let the UI see intermediate state, push events:

```python [controller.py]
def stream(self, count: int = 4) -> dict:
    for i in range(count):
        AxonEvent.dispatch_js_event(WEB, "demo:progress", [{"step": i + 1, "total": count}])
        time.sleep(0.15)
    return {"done": count}
```

<LiveDemo id="stream" />

## Events provided by the window

Besides your own names, `AxonEvent` forwards Qt window events to JS under the same names:

| Event name | When it fires |
| --- | --- |
| `loadFinished` | the page loaded (and the JS channel is ready) |
| `contextMenu` | right-click menu |
| `dragEnter` / `dragMove` / `drop` / `dragLeave` | dragging files into the window |
| `hide` / `show` | window hidden / shown |

```js [app.js]
AxonEvent.addListener("loadFinished", () => {
  console.log("page loaded");
});
```

## Key points

- **Events have no return value** — do not expect `await` to hand you anything; use a call when you need
  a result.
- **Both sides must use the same event name**; a typo does not raise, it just never arrives.
- **`loadFinished` waits for the channel**: call `await AxonInit()` before registering the listener; the
  framework dispatches this event only after JS checks in.
- **Keep the event rate sane**: every event is a cross-process message; flooding slows the UI down.
