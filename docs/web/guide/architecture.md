# 架构与消息流

Axon 不是在 Python 里拼 HTML，也不是往页面里注入一堆魔法字符串。它做三件事：

1. 用 `QWebEngineView` 装一个 Chromium 窗口，加载你写的 Web 应用（dev server 或构建产物）。
2. 在窗口上注册一个 `QWebChannel`，里面挂三个对象：`AxonEnv`、`AxonJSCallHandler`、`AxonPYCall`。
3. 前后端各加一层语法糖，把「带 call_id 的一次调用」包装成 `Axon.Ctl.method()` / `Axon(web).JS.prop` 这种写法。

## 两条反向通道

```
        JS 进程（Chromium）                      Python 进程（Qt 主线程）
  ┌──────────────────────────┐            ┌──────────────────────────────┐
  │ Axon.Ctl.method(args)    │  ①call      │ AxonJSCallHandler.onCall     │
  │   └─ AxonCall.__call__   │ ─────────▶  │   ├─ 同步方法 → 线程池        │
  │        call_id = uuid4   │             │   └─ async 方法 → 事件循环    │
  │                          │  ②return    │                              │
  │ returnReceiverSignal ◀───┼─────────────┤ returnReceiver([id,state,val])│
  └──────────────────────────┘             └──────────────────────────────┘
  ┌──────────────────────────┐             ┌──────────────────────────────┐
  │ AxonPYCall.onCallSignal  │  ③call      │ Axon(web).JS.method(args)    │
  │   └─ AxonPYCallHandler   │ ◀─────────  │   └─ _call → Future          │
  │ returnReceiver(...)      │  ④return    │ Future 由 callFutures[id] 收  │
  └──────────────────────────┘ ──────────▶ └──────────────────────────────┘
```

- **JS → Python**：`AxonCall.__call__` 生成 `call_id`，把 `{call_id, web_name, controller_id, prop, args, kwargs, type}` 交给 `AxonJSCallHandler.onCall`。Python 侧按 `type` 分派：`call` 执行方法、`get` 读属性、`set` 写属性，结果通过 `returnReceiverSignal` 按 `call_id` 回填。
- **Python → JS**：`_call()` 建一个 `AxonFuture` 存进 `callFutures[call_id]`，再把数据 emit 给页面里 `AxonPYCall` 的 `onCallSignal`；JS 侧 `AxonPYCallHandler` 执行后调 `returnReceiver([call_id, "resolve"|"reject", value])`。

`web_name` 是这套机制的关键：一个进程里可以有多个窗口，每个窗口有独立的名字和控制器表，消息不会串窗。

## 线程模型

| 位置 | 跑在哪个线程 | 说明 |
| --- | --- | --- |
| `onCall` 分派入口 | Qt 主线程 | 只做分派，不执行用户代码 |
| `def` 方法 | `controller_sync_executor` 线程池（`cpu+4`） | 可以阻塞，但**不能碰 Qt 控件** |
| `async def` 方法 | 独立事件循环线程 `controller_loop` | 可以 `await`；`await Axon(web).JS.f()` 也在这里 |
| `AxonMagicGUI.run(fn)` | Qt 主线程 | 需要动 Qt 对象时用 |
| Store 写入广播 | 调用方线程 → 各窗口通道 | 每个窗口各自收到 `setFromPeer` |

因为同步方法跑在线程池里，`time.sleep()` 不会卡住界面；但如果你在线程池里直接改 `QWidget`，
Qt 会警告甚至崩溃 —— 那是 `AxonMagicGUI` 存在的理由。

## 属性访问为什么是惰性的

`Axon.Ctl.counter` 本身**不发请求**。它是一个函数对象，同时挂了 `then/catch/finally`，
所以只有当你 `await` 它、或在它上面调 `.then()` 时，才真正发 `getVar`。

这样做的好处：可以直接写 `await Axon.Ctl.counter`（读属性）而不和 `Axon.Ctl.counter()`（调方法）打架。
代价是属性读取不能被 JSON 序列化，也不能当普通值传递 —— 需要值时用 `await` 或 `.get()`。

## 事件

两端各有一个 `AxonEvent`，都是 EventTarget 风格（`addListener/removeListener/dispatchEvent`）。
Python 的 `dispatch_js_event(web, type, args)` 会把事件推进页面的 `AxonEvent`；反过来
`AxonEvent.dispatchPYEvent({type, args})` 会调 Python 的 `dispatch_event`。

Qt 的窗口事件也走这条路：`loadFinished`、`contextMenu`、`dragEnter`、`dragMove`、`drop`、`dragLeave`、
`hide`、`show`。其中 `loadFinished` 做了特殊处理：

> 页面加载完成时前端通道往往还没握手完，直接派发会丢事件。所以后端把它攒着，
> 等前端在 `AxonInit()` 里调 `AxonEnv.ready()` 报到之后再派发（延后一轮事件循环，
> 留出前端注册监听器的时间）。

## Store

`AxonStore` 是两端镜像的 key-value：

- JS 侧 `store.set("k", v)`（= `store.prop("k").set(v)`）→ `AxonCall.call(controller_id="__AxonStore_<id>__", func="setFromPeer")` → Python 侧更新值。
- Python 侧 `store.set("k", v)`（= `store.prop("k").set(v)`）→ 向该 store 挂着的每个窗口发 `setFromPeer` → JS 侧更新缓存。
- `shared` store（`__shared__`）跨窗口共享，`web_names` 是当前所有窗口。

id 只保留一份：JS 构造 `new AxonStore("x")` 时若同 id 已存在会直接复用；Python 侧 `AxonStore("x", *web_names)`
同理（`AxonStoreDict` 去重）。两端都通过 `createStore` / `deleteStore` 报备窗口归属。
