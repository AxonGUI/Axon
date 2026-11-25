# 性能优化：外部方案调研（2026-11-25）

先看别人怎么做，再决定自己写多少。结论在最后。

## 1. Qt WebChannel 官方给的两个批量开关

- `QWebChannel.propertyUpdateInterval`（毫秒）：**属性变化**的合并间隔。正数=按间隔合并
  （默认 50ms），`0`=按事件循环合并，负数=每条立刻发。
- `QWebChannel.setBlockUpdates(bool)`：暂时挡住所有出站更新，之后再开，期间攒下的
  一起冲出去。官方文档给的说法是「保证原子性并尽量少发消息」。
- 来源：[QWebChannel.propertyUpdateInterval 说明](https://runebook.dev/en/docs/qt/qwebchannel/propertyUpdateInterval-prop)、
  [blockUpdates](https://runebook.dev/en/docs/qt/qml-qtwebchannel-webchannel/blockUpdates)

我们实测（`/tmp/block_updates_test.py`）：PySide6 6.11 里这两个 API 都在
（`setBlockUpdates` / `propertyUpdateInterval` 可调用）。但 `blockUpdates` 是
**整条通道**级别的，把任意时刻的 worker 回包都挡住，一旦中途抛异常没恢复，整个窗口
就哑了；`propertyUpdateInterval` 只管属性，不管我们的调用/回包。

→ 可以借鉴「攒一批再发」的思想，但不直接用这两个开关做控制流。

## 2. VS Code / Electron 的做法

- VS Code 有专门的 PR 把 IPC 从「JSON 字符串」改成「buffer 协议」
  （[microsoft/vscode#56820](https://github.com/microsoft/vscode/pull/56820/commits/e512c12761803ffc86d4ea6c0e8a1e267d6072e7)），
  并且一直在做 remote IPC 层的合并/批处理（[issue #170645](https://github.com/microsoft/vscode/issues/170645)）。
  这两点分别对应我们的「二期大 payload」与「一期批量」。
- Electron 侧的一般教训：`ipcRenderer.sendSync` 会阻塞渲染进程
  （[一篇中文分析](https://www.volcengine.com/article/636725)），所以同步式通信一律
  改成「发消息 + 等回包」。我们本来就是异步的，这条只是佐证方向没错。
- 实际项目里的批量 IPC：有项目专门发过「batch IPC calls to prevent memory overload
  freeze」的补丁（[daintree 的 4174 号经验](https://github.com/daintreehq/daintree/blob/8c3390839eda6be4789fd93ef542302e3d213cdd/.lessons/4174.md)），
  说明「一个 tick 内的多次 IPC 合并成一次」是通用解法。

## 3. 有没有可以直接用的库

| 候选 | 能不能直接用 | 判断 |
| --- | --- | --- |
| [`microbatcher`](https://www.npmjs.com/package/microbatcher) | 通用「攒一批再执行」工具（微任务/定时批量） | 逻辑三十行就能写完，引入依赖不值 |
| `micro-scheduler`/`p-queue` 等 | 调度器，不含「消息合包」 | 同上 |
| msgpack / cbor（`@msgpack/msgpack`、`cbor-x`） | 能替掉 JSON | 属于二期；而且 QWebChannel 只接受 JSON 可序列化值，二进制还得 base64，收益要先量 |
| 专门的「QWebChannel RPC 加速库」 | 搜不到（PySide/PyQt 生态里没有） | 没有现成可拿的 |

结论：**没有可以直接拿来的库**；能借的是「微任务合并 + 一次 flush」这个模式，
自己实现约 60–80 行，比引依赖可控（尤其是要保住每个 Promise 独立的 resolve/reject 语义）。

## 4. 决定

一期（本轮）自己做两件事，接口零变化：

1. **A：请求合并** —— 同一轮事件循环里的调用进队列，`queueMicrotask` 时合成一条
   `{batch:[...]}`；Python 侧逐条执行，每条独立回包。
2. **B：回包合并** —— worker 线程的结果先进主线程队列，下一轮事件循环一次 emit 一个
   数组（`returnReceiverBatchSignal`）；JS 侧循环 resolve。

二期（看一期数字再定）：超过阈值的大字符串走 gzip+base64 标记，JS 侧自动解。

不做：让用户声明处理器走主线程（接口变化）、getVar 缓存（语义变化）、引入 msgpack
（QWebChannel 不认二进制）。
