# 从 Python 调 JS

Python 侧语法糖：`Axon(web_name)` 得到一个代理，取到的每个成员既是方法也是属性。

```python
from axon import Axon

ax = Axon("AxonDocs")

# 调用 JS 方法 → Future（可 .result(timeout) / await）
ax.DocsJS.mirror({"hello": "python"}).result(5)

# 读 JS 属性（同步阻塞）
ax.DocsJS.value.get(5)

# 写 JS 属性（不等返回）
ax.DocsJS.value = 99
```

下面这个示例会走完整一圈：JS 点按钮 → Python 方法 → Python 调 JS 的 `DocsJS.mirror` → 结果回到 Python → 结果回到 JS。

<LiveDemo id="pyToJs" />

## 读写 JS 属性

<LiveDemo id="pyToJsProperty" />

## Future 的三种用法

```python
future = Axon("AxonDocs").DocsJS.mirror(payload)

future.result(5)      # 同步等 5 秒，超时抛 TimeoutError
await future           # 在 async 方法里等（AxonFuture 自带 asyncio 桥接）
future.add_done_callback(lambda f: print(f.result()))
```

::: tip await 的两种写法
- `await Axon(web).JS.method(...)`：`method()` 返回的 `AxonFuture` 本身可 await。
- `await Axon(web).JS.prop`：属性走 `_JSProperty.__await__`，内部 `asyncio.wrap_future`。

旧版两处都会抛 `TypeError: object Future can't be used in 'await' expression`
（`concurrent.futures.Future` 不是 awaitable，`__await__` 又返回了非迭代器），已修。
:::

## 广播

`Axon.broadcast` 会把调用发给**所有**打开的窗口，返回每个窗口的 Future 列表：

<LiveDemo id="broadcast" />
