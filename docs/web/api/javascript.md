# JavaScript 端 API

导入方式（打包器）：

```js
import {
  Axon, AxonInit, isAxonReady, isAxonConnected,
  AxonCall, AxonChannels, initChannels,
  AxonController, AxonEvent, AxonStore,
} from "axon-gui";
```

不开打包器时用 UMD 版本，全局变量是 `axon`：

```html
<script src="./node_modules/axon-gui/dist/axon.umd.cjs"></script>
<script>const { Axon, AxonInit } = window.axon;</script>
```

## 初始化

### `AxonInit(): Promise<IAxonInitResult>`

连接 QWebChannel 并初始化各子系统。**整个页面调一次**，重复调用复用同一连接。

```js
const status = await AxonInit();
// { connected, ready, reason?, objects, error? }
```

没有 Python 后端时不抛错，返回 `{connected: false, ready: false, reason: "no-qt-transport"}`。

### `isAxonReady(): boolean`

同步查询是否「已连上且三个通道对象齐全」。适合初始化之后再用来做条件判断。

### `isAxonConnected(): boolean`

同步查询是否连上了通道。

### `initChannels(): Promise<IAxonChannelStatus>`

只建通道、不初始化子系统。一般不需要直接用。

## `Axon` —— 调用 Python

`Axon` 是代理对象，`Axon.控制器名.方法名` 就是一次调用。

```js
// 位置参数
await Axon.Calc.add(2, 3);

// 打包写法：[位置参数, 关键字参数, 超时毫秒]
await Axon.Calc.with_kwargs([1], { b: 2 });
await Axon.Calc.slow([1500], {}, 300);      // 300ms 超时

// 读属性（一次往返，必须 await）
const n = await Axon.Calc.counter;

// 写属性（发出即忘）
Axon.Calc.counter = 42;
```

| 形式 | 说明 |
| --- | --- |
| `Axon.Ctl.fn(...)` | 位置参数即 `args`，返回 `Promise` |
| `Axon.Ctl.fn([args], kwargs?, timeoutMs?)` | 第一个参数是数组时为打包写法 |
| `await Axon.Ctl.prop` | 读属性（`getVar`） |
| `Axon.Ctl.prop = v` | 写属性（`setVar`），不等待 |

超时会 reject，消息形如 `Timeout Error, py not return in 300ms`。Python 侧的调用不会因此中断。

## `AxonCall` —— 低层调用

需要手工控制时用它（框架内部也用它）。

```js
await AxonCall.call({ controller_id: "Calc", func: "add", args: [2, 3], kwargs: {}, timeout: 3000 });
await AxonCall.setVar({ controller_id: "Calc", var_name: "counter", value: 42 });
const v = await AxonCall.getVar({ controller_id: "Calc", var_name: "counter" });
await AxonCall.crossCall({ web_name: "MainView", controller_id: "Calc", func: "add", args: [1, 2] });
```

`AxonCall.init()` 负责挂上接收 Python 回调的信号，`AxonInit()` 已经调过。

## `AxonController` —— 让 Python 能调用 JS

```js
import { AxonController } from "axon-gui";

// 1) 直接注册对象（推荐，写法最清楚）
AxonController.register("DocsJS", {
  value: 7,
  mirror(payload) { return { mirrored: payload }; },
  async sleepEcho(payload, ms = 300) { /* ... */ },
});

// 2) 装饰器写法，控制器名默认取类名
@AxonController()
class DocsJS { ... }
```

| 方法 | 说明 |
| --- | --- |
| `AxonController.register(id, object)` | 注册一个对象 |
| `AxonController.unregister(id)` | 注销 |
| `AxonController.get(id)` | 取回已注册对象，没有则抛错 |

## `AxonEvent` —— 事件

```js
AxonEvent.addListener("demo:event", handler);
AxonEvent.addListener("loadFinished", handler, { once: true });
AxonEvent.removeListener("demo:event", handler);
AxonEvent.removeAllListeners("demo:event");

// 在 JS 侧派发（本页监听器会被调用）
AxonEvent.dispatchEvent("demo:event", 1, 2);

// 发给 Python
AxonEvent.dispatchPYEvent({ type: "demo:pong", args: [1, 2, 3] });
```

`on` / `off` 是 `addListener` / `removeListener` 的别名。

内置事件（由 Qt 窗口派发）：`loadFinished`、`contextMenu`、`dragEnter`、`dragMove`、`drop`、`dragLeave`、`hide`、`show`。

## `AxonStore` —— 跨端键值

```js
const store = new AxonStore("docs-store");     // 同名即同一份

store.set("k", 1);                             // 写，并推给 Python
store.get("k").get();                          // 读本地缓存
store.get("k").set(2);                         // 等价于 store.set("k", 2)
store.prop("k").get();                         // store.get("k") 的另一种写法

store.release();                               // 注销这个 store
```

| 成员 | 说明 |
| --- | --- |
| `new AxonStore(id)` | 同名复用同一实例；会通知 Python 侧创建对应 store |
| `get(name)` / `prop(name)` | 取一个 `AxonStoreProperty` |
| `set(name, value)` | 写并同步 |
| `setFromPeer(name, value)` | 接收对端写入（框架内部用） |
| `AxonStore.shared` | 全局共享 store，`AxonInit()` 时创建 |

`AxonStoreProperty` 有 `get()` / `set(value)` / `setFromPeer(value)` / `.value`。

## 类型

```ts
interface IAxonInitResult {
  connected: boolean;
  ready: boolean;
  reason?: "no-qt-transport" | "retry-exhausted";
  objects: string[];
  error?: string;
}

interface IAxonChannelStatus {
  connected: boolean;
  reason?: "no-qt-transport" | "retry-exhausted";
  objects: string[];
  error?: string;
}
```
