# 读写 Python 属性

属性访问走的是同一条通道，但方向不同：读是 `getVar`（`type: "get"`），写是 `setVar`（`type: "set"`）。

```ts
const value = await Axon.Ctl.counter;   // 读（惰性：await 时才发请求）
Axon.Ctl.counter = 42;                  // 写（立即返回，不等结果）
```

<LiveDemo id="property" />

## 三种读法

| 写法 | 行为 |
| --- | --- |
| `await Axon.Ctl.prop` | 发 `getVar`，等结果（推荐） |
| `Axon.Ctl.prop.then(cb)` | 同上，回调风格 |
| `Axon.Ctl.prop()` | 把它当方法调用 —— 会尝试调用 JS/Python 的 `prop` 方法，读属性时**别这么写** |

## Python 侧读 JS 属性

反过来也成立，见[从 Python 调 JS](/examples/py-to-js)。

## 为什么写属性不等返回

`setVar` 是 fire-and-forget：`Axon.Ctl.prop = v` 在 Proxy 的 `set` 陷阱里直接返回 `true`，
Promise 被丢弃。这样写起来像普通赋值，代价是**写入失败你不会知道**。需要确认写入成功时，
在 Python 端提供一个显式的 setter 方法，用方法调用（有返回值）代替属性赋值。
