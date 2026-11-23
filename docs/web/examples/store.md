# 跨端 Store

`AxonStore` 是两端镜像的 key-value 容器，适合放「前端多个组件和后端都要读」的状态（主题、当前项目、
最近一次选择……）。

## JS 侧

```ts
import { AxonStore } from "axon-gui";

const store = new AxonStore("docs-store");     // 同 id 会复用已有实例
store.set("theme", "dark");                    // → Python 侧收到 setFromPeer
store.get("theme").get();                      // 读本地缓存（同步）
```

## Python 侧

```python
from axon import AxonStore

store = AxonStore("docs-store", "AxonDocs")    # 同 id 复用；挂在这个窗口上
store.get("theme")                             # 读
store.set("theme", "dark")                     # → 该 store 挂着的每个窗口收到 setFromPeer
store.count = 3                                # 等价于 store.prop("count").set(3)
```

<LiveDemo id="store" />

## 语义

- **JS 写 → Python**：`AxonCall.call(controller_id="__AxonStore_<id>__", func="setFromPeer", args=[name, value])`。
- **Python 写 → JS**：向该 store 的 `web_names` 逐个发 `setFromPeer`，JS 侧只更新缓存，不会回环。
- **窗口归属**：JS 构造时调 `PYAxonStoreSyncManager.createStore(id, web_name)` 报备；
  `release()` 时 `deleteStore(id, web_name)` 解除。
- **shared**：`AxonStore.shared`（id `__shared__`）的 `web_names` 是当前所有窗口，跨窗口共享同一份值。

::: warning 值必须可序列化
通道用 JSON 传值，`datetime`、`set`、自定义对象都不能直接放进去。需要时在两端各自转换。
:::
