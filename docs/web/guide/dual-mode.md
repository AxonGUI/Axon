# 双模式：有 Python 后端 / 没有 Python 后端

同一个前端页面要服务两种场景：

| 场景 | 期望表现 |
| --- | --- |
| 被 `AxonGUI` 打开 | 显示可点的交互示例，点击后真的调 Python |
| 普通浏览器 / 静态站点 | 退化成说明书，按钮换成「需要后端」的提示 |

旧版的 `AxonInit()` 在后一种场景下会抛 `TypeError`（它去读不存在的 `AxonChannels.AxonPYCall`），
导致整个页面白屏。现在它返回状态对象：

```ts
const status = await AxonInit();
// { connected: boolean, ready: boolean, reason?, objects: string[], error? }
```

## 状态字段

| 字段 | 含义 |
| --- | --- |
| `connected` | `QWebChannel` 是否建立（有传输对象 + 握手成功） |
| `ready` | 全链路可用：三个内置对象齐备，且 `AxonPYCallHandler` / `AxonCall` / `AxonStore` 初始化完成 |
| `reason` | 没连上的原因：`"no-qt-transport"`（普通浏览器）或 `"retry-exhausted"`（有传输对象但握手 50 次都失败） |
| `objects` | 后端注册的对象名，正常是 `["AxonEnv", "AxonJSCallHandler", "AxonPYCall"]` |
| `error` | 握手失败时的错误信息 |

还有两个同步查询：`isAxonConnected()`、`isAxonReady()`。

## 页面怎么写

```ts
import { Axon, AxonInit, AxonEvent } from "axon-gui";

const status = await AxonInit();

if (status.ready) {
  // 交互模式：绑定按钮、监听后端事件
  document.querySelector("#run")!.addEventListener("click", async () => {
    console.log(await Axon.DemoController.add([1, 2]));
  });
  AxonEvent.addListener("demo:event", (payload) => console.log(payload));
} else {
  // 纯文档模式：把交互区换成提示
  document.querySelectorAll("[data-live]").forEach((el) => {
    el.classList.add("disabled");
  });
}
```

手册站点就是这么做的：`LiveDemo` 组件在 `connected` 为假时禁用按钮，并提示用
`python docs/main.py` 打开。

## 静态站安全提醒

文档站本身不含任何 Python 代码，纯静态部署没问题。但**不要**把示例服务直接暴露到公网：
`docs/main.py` 的 HTTP 服务默认只绑 `127.0.0.1`，远程调试端口默认关闭（需要时用
`--debugger-port` 显式打开）。
