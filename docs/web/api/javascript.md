# JavaScript 端 API

从 `axon` 包导入。所有 API 都不依赖 Qt 的全局变量即可 import —— 只有在真正需要通道时才会碰 `window.qt`。

```ts
import {
  Axon, AxonInit, isAxonReady, isAxonConnected,
  AxonCall, AxonController, AxonStore, AxonEvent,
  initChannels, AxonChannels, AxonChannelStatus,
} from "axon-gui";
```

## 初始化

### `AxonInit(): Promise<IAxonInitResult>`

幂等。返回 `{ connected, ready, reason?, objects, error? }`，**不抛错**。

### `isAxonConnected(): boolean` / `isAxonReady(): boolean`

同步查询。`isAxonReady()` 额外要求三个内置通道对象齐备。

### `initChannels(): Promise<IAxonChannelStatus>`

只建通道，不做 `AxonPYCallHandler` / `AxonCall` / `AxonStore` 的初始化。一般用 `AxonInit()` 就够。
内部用 `promise-retry` 重试 50 次（每次间隔 10ms），失败时返回 `reason: "retry-exhausted"`。

### `AxonChannels`

通道对象容器，握手成功后形如 `{ AxonEnv, AxonJSCallHandler, AxonPYCall }`。

## `Axon` —— 调用 Python 的语法糖

| 写法 | 语义 |
| --- | --- |
| `Axon.Ctl.method(a, b)` | 摊开传参：位置参数直接对应 Python 形参 |
| `Axon.Ctl.method([a, b], { kw: 1 }, 500)` | 打包写法：`args` 数组 + `kwargs` + `timeout` |
| `await Axon.Ctl.prop` | 读 Python 属性（`getVar`，惰性） |
| `Axon.Ctl.prop.then(cb)` / `.catch(cb)` / `.finally(cb)` | 同上，回调风格 |
| `Axon.Ctl.prop = value` | 写 Python 属性（`setVar`，不等返回） |

两种写法由**第一个参数是不是数组**自动区分：

- 不是数组 → 全部位置参数就是 `args`（最常用的写法，`Axon.Ctl.add(1, 2)`）；
- 是数组 → 老式打包写法 `fn([a, b], kwargs?, timeout?)`，需要传 `kwargs` 或 `timeout` 时用它。

`timeout` 是毫秒，超时后 Promise 以 `Timeout Error, py not return in <n>ms` 拒绝。

## `AxonCall` —— 低层调用

```ts
AxonCall.call({ controller_id, func, args, kwargs, timeout }): Promise<any>
AxonCall.setVar({ controller_id, var_name, value, timeout }): Promise<void>
AxonCall.getVar({ controller_id, var_name, timeout }): Promise<any>
AxonCall.crossCall({ web_name, controller_id, func, args, timeout }): Promise<any>
AxonCall.returnReceiver([call_id, "resolve" | "reject", value]): void
AxonCall.init(): Promise<void>
```

`crossCall` 用于**跨窗口**调 Python 控制器（数据里带 `web_name`，后端由 `AxonCrossCallHandler` 转交）。

## `AxonController` —— 注册 JS 控制器

被 Python 调用的 JS 对象必须先注册：

```ts
import { AxonController } from "axon-gui";

AxonController.register("DocsJS", {
  value: 7,
  mirror(payload) { return { mirrored: payload }; },
});
```

装饰器形式（`@AxonController()`）在 TS 里对类的支持见 `core-js/lib/AxonPYCallHandler.ts`；
`id` 不传时用类名。

## `AxonStore`

```ts
new AxonStore(id: string, auto_create = true)   // 同 id 复用
store.prop(name, value?): AxonStoreProperty
store.get(name): AxonStoreProperty
store.set(name, value): void                     // 等价于 store.prop(name).set(value)
store.get(name): AxonStoreProperty               // 等价于 store.prop(name)
store.setFromPeer(name, value): void             // Python 写入时的入口（只更新本地缓存）
store.release(): void

prop.get(): any            // 同步读缓存
prop.set(value): void      // 写并通知 Python（值相同时不发）
prop.setFromPeer(value): void    // 只更新本地缓存
```

`AxonStore.shared` 是 `__shared__` 实例（跨窗口共享），需在 `AxonInit()` 之后使用。

## `AxonEvent`

```ts
AxonEvent.addListener(type, listener, options?: { once?: boolean }): void
AxonEvent.removeListener(type, listener): void
AxonEvent.removeAllListeners(type): void
AxonEvent.on / AxonEvent.off                       // addListener / removeListener 的别名
AxonEvent.dispatchEvent(type, ...args): void       // 本地派发
AxonEvent.dispatchPYEvent({ type, args?, kwargs? }): Promise<void>   // 推给 Python
```

## 类型

`AxonEventQt.ts` 提供 Qt 事件相关的枚举与类型：`Reason`、`KeyboardModifier`、`MouseButton`、
`DropAction`、`QDropEvent`、`AxonQtEventMap`（`loadFinished` / `contextMenu` / `dragEnter` /
`dragMove` / `drop` / `dragLeave` / `hide` / `show`）。
