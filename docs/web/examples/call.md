# 调用 Python 方法

JS 侧的统一入口是 `Axon.<ControllerId>.<method>`：

```ts
Axon.Ctl.method(a, b, ...)                   // 摊开写法：位置参数直接给 Python 形参
Axon.Ctl.method([a, b], kwargs?, timeout?)   // 打包写法：首参是数组
```

- 第一个参数**不是数组**时，所有位置参数就是 `args`；
- 第一个参数**是数组**时按打包写法解释：数组 = `args`，第二个可选对象 = `kwargs`，第三个可选数字 = `timeout`（毫秒）。

下面每个卡片都是真实调用：点「运行示例」，页面会调 Python 进程里的 `DemoController`，
并把两端传递的报文、耗时、结果逐条列出来。

<LiveDemo id="call" />

## kwargs 怎么传

Python 端 `def with_kwargs(self, a, b=0, label="none")`，JS 端把 `b`、`label` 放进第二个参数：

<LiveDemo id="kwargs" />

::: warning 旧版的坑
早先的 JS 侧 `onCall` 只把 `args` 展开给 Python，完全忽略 `kwargs`；Python 侧也没读 `data["kwargs"]`。
现在两端都会合并：`args` 展开 + 非空 `kwargs` 作为最后的关键字参数。
:::

## async 方法

`async def` 方法跑在独立事件循环线程里，JS 侧看不出区别：

<LiveDemo id="async" />

## 超时

<LiveDemo id="timeout" />

超时只是**JS 侧不再等**，Python 那次调用不会被取消（线程池里的 `time.sleep` 仍会跑完）。
需要真正取消，得自己在 Python 侧检查协作式标志。

## 异常

<LiveDemo id="error" />

Python 抛出的异常会被转成字符串回传，JS 侧 Promise 以 `Error` 拒绝。异常类型信息在当前实现里
**不保留**（`JSRuntimeError` 只带消息文本），这是有意简化：跨进程传 traceback 对象没有意义。
