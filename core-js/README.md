# axon-gui (frontend runtime)

The frontend half of [Axon](https://github.com/AxonGUI/Axon): a Proxy-based API that makes Python
objects in the same window look like local objects — `await Axon.Calc.add(2, 3)` really is a
QWebChannel round trip — plus events and a key-value store shared across windows.

```ts
import { Axon, AxonInit } from "axon-gui";

const status = await AxonInit();          // handshake; returns { connected, ready, reason, ... }
if (!status.ready) console.warn("no Python backend:", status.reason);

await Axon.Calc.add(2, 3);                // a method of @AxonController(...) on the Python side
await Axon.Calc.count;                    // a Python property
await Axon.Calc.add([2, 3]);              // packed form, when you need kwargs or a timeout
```

- Both a normal `import` and a plain `<script src=".../dist/axon.umd.cjs">` build (global `window.axon`)
- Peer dependencies: `qwebchannel`, `promise-retry`, `uuid`
- Same page, two modes: in a normal browser `AxonInit()` just reports "no backend" and your page
  stays a static document

Docs and live examples: <https://axongui.github.io/Axon/en/> · 中文文档：<https://axongui.github.io/Axon/>

---

## 中文

Axon 的前端运行时：用 Proxy 把同一窗口里的 Python 对象伪装成本地对象
（`await Axon.Calc.add(2, 3)` 真的是一次 QWebChannel 往返），另有事件与跨窗口共享的
key-value Store。

```ts
import { Axon, AxonInit } from "axon-gui";

const status = await AxonInit();          // 握手；返回 { connected, ready, reason, ... }
if (!status.ready) console.warn("没有 Python 后端:", status.reason);

await Axon.Calc.add(2, 3);                // Python 侧 @AxonController(...) 的方法
await Axon.Calc.count;                    // Python 属性
await Axon.Calc.add([2, 3]);              // 打包写法，需要 kwargs 或超时时用
```

- 既支持 `import`，也支持 `<script src=".../dist/axon.umd.cjs">`（全局 `window.axon`）
- peer 依赖：`qwebchannel`、`promise-retry`、`uuid`
- 同一份页面两种形态：普通浏览器里 `AxonInit()` 只会报告「没有后端」，页面仍是静态文档

完整文档与可交互示例见 <https://axongui.github.io/Axon/>。
