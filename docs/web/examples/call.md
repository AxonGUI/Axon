# 调用 Python 方法

<span class="channel-tag">JS → PY</span>

网页里的一个 `await Axon.Xxx.方法名(...)`，会真的调用 Python 里同名的方法，返回值再回到 JS。

## Python 侧：先写方法

方法就是普通方法，写在 `@AxonController` 装饰的类里。类名就是 JS 里用的控制器名。

```python
# controller.py
from axon import AxonController

@AxonController("MainView")          # 注册给窗口 MainView
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
        return f"阻塞了 {ms}ms"

    def fail(self, reason: str = "demo") -> None:
        raise ValueError(f"Python 主动抛出的错误: {reason}")
```

同步方法跑在线程池里，`async def` 方法跑在独立的 asyncio 事件循环里，两者都不会卡住界面。

::: warning 两个名字别搞混
- **窗口名**：`@AxonController("MainView")` 的第一个参数，要和 `AxonGUI("MainView", ...)` 一致，决定这个控制器在哪个窗口里可用。不写则对所有窗口生效。
- **控制器名**：默认等于类名（这里就是 `DemoController`），JS 侧 `Axon.DemoController.xxx` 用的就是它。想改名写 `@AxonController("MainView", id="calc")`，JS 侧就变成 `Axon.calc.xxx`。
:::

## JS 侧：三种写法

```js
import { Axon, AxonInit } from "axon-gui";

await AxonInit();   // 应用启动时调一次，等通道连上

// 1. 位置参数直接摊开
const sum = await Axon.DemoController.add(2, 3);        // 5

// 2. 需要关键字参数或超时时，用「打包」写法： [位置参数, 关键字参数, 超时毫秒]
const info = await Axon.DemoController.with_kwargs([1], { b: 2, label: "hi" });
// { sum: 3, label: "hi" }

// 3. async 方法一样 await
const text = await Axon.DemoController.delayed("hi", 300);
```

判断规则只有一条：**第一个参数是数组就是打包写法，否则都是位置参数**。

## 普通调用

```js
const sum = await Axon.DemoController.add(2, 3);
```

<LiveDemo id="call" />

## 带关键字参数

```js
await Axon.DemoController.with_kwargs([1], { b: 2, label: "hi" });
```

<LiveDemo id="kwargs" />

## 调用 async 方法

```js
await Axon.DemoController.delayed("hi", 300);
```

<LiveDemo id="async" />

## 超时

第三个参数是超时毫秒数。超时后 JS 侧立刻收到 `Timeout Error`，但** Python 里那次调用仍在继续跑**，不会被打断。

```js
// Python 要阻塞 1500ms，这里只等 300ms
try {
  await Axon.DemoController.slow([1500], {}, 300);
} catch (err) {
  console.error(err.message);   // Timeout Error, py not return in 300ms
}
```

<LiveDemo id="timeout" />

## Python 抛异常

Python 的异常会变成 JS 的 rejected promise，`try/catch` 就能接住。

```js
try {
  await Axon.DemoController.fail("manual");
} catch (err) {
  console.error(err.message);   // 这是 Python 主动抛出的错误: manual
}
```

<LiveDemo id="error" />

## 要点

- **一定要 `await`**：不 await 拿到的是 Promise，不是返回值。
- **方法名就是 Python 的方法名**，控制器名是类名（或装饰器里显式写的 id）。
- **参数和返回值走 JSON**：`int` / `str` / `list` / `dict` / `bool` / `None` / `float` 都行；自定义对象、`datetime`、`bytes` 需要自己转成基本类型。
- **同步方法不要写太久**：它占的是一个工作线程；长任务请写成 `async def`，或者用[事件](/examples/event)推进度。
- **超时只是「我不等了」**，不是取消 Python 的执行。
