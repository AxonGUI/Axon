# Calling Python methods

<span class="channel-tag">JS → PY</span>

A single `await Axon.Xxx.method(...)` in the page really calls the Python method with that name, and the
return value travels back to JS.

## Python side: write the method first

A method is just an ordinary method on a class decorated with `@AxonController`. The class name is the
controller name used from JS.

```python
# controller.py
from axon import AxonController

@AxonController("MainView")          # registers for the window MainView
class DemoController:
    def add(self, a: int, b: int) -> int:
        return a + b

    def with_kwargs(self, a: int, b: int = 0, label: str = "none") -> dict:
        return {"sum": a + b, "label": label}

    async def delayed(self, msg: str, ms: int = 300) -> str:
        import asyncio
        await asyncio.sleep(ms / 1000)
        return f"async:{msg}"

    def slow(self, ms: int = 1500) -> str:
        import time
        time.sleep(ms / 1000)
        return f"blocked for {ms}ms"

    def fail(self, reason: str = "demo") -> None:
        raise ValueError(f"raised on purpose in Python: {reason}")
```

Synchronous methods run on a worker pool and `async def` methods run on a dedicated asyncio event loop;
neither blocks the UI.

::: warning Two names that are easy to confuse
- **Window name**: the first argument of `@AxonController("MainView")`. It must match
  `AxonGUI("MainView", ...)` and decides which window can reach this controller. Omit it to make the
  controller available to every window.
- **Controller name**: defaults to the class name (here `DemoController`), which is what
  `Axon.DemoController.xxx` refers to. To rename it, write `@AxonController("MainView", id="calc")` and
  use `Axon.calc.xxx` from JS.
:::

## JS side: three ways to call

```js
import { Axon, AxonInit } from "axon-gui";

await AxonInit();   // call once at startup, wait for the channel

// 1. plain positional arguments
const sum = await Axon.DemoController.add(2, 3);        // 5

// 2. keyword arguments or a timeout: the packed form [args, kwargs, timeoutMs]
const info = await Axon.DemoController.with_kwargs([1], { b: 2, label: "hi" });
// { sum: 3, label: "hi" }

// 3. async methods are awaited the same way
const text = await Axon.DemoController.delayed("hi", 300);
```

There is only one rule: **if the first argument is an array it is the packed form, otherwise every
argument is positional**.

## A plain call

```js
const sum = await Axon.DemoController.add(2, 3);
```

<LiveDemo id="call" />

## With keyword arguments

```js
await Axon.DemoController.with_kwargs([1], { b: 2, label: "hi" });
```

<LiveDemo id="kwargs" />

## Calling an async method

```js
await Axon.DemoController.delayed("hi", 300);
```

<LiveDemo id="async" />

## Timeout

The third value is a timeout in milliseconds. When it fires, JS immediately gets `Timeout Error`, but the
**Python call keeps running** — it is not cancelled.

```js
// Python blocks for 1500ms, we only wait 300ms
try {
  await Axon.DemoController.slow([1500], {}, 300);
} catch (err) {
  console.error(err.message);   // Timeout Error, py not return in 300ms
}
```

<LiveDemo id="timeout" />

## Python raising an exception

A Python exception becomes a rejected promise on the JS side, so `try/catch` receives it.

```js
try {
  await Axon.DemoController.fail("manual");
} catch (err) {
  console.error(err.message);   // raised on purpose in Python: manual
}
```

<LiveDemo id="error" />

## Key points

- **Always `await`**: without it you get a Promise, not the return value.
- **The method name is the Python method name**; the controller name is the class name (or the explicit
  `id=` given to the decorator).
