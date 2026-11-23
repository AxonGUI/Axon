# 主线程任务与广播

## 为什么要回主线程

`def` 方法跑在线程池里，`async def` 跑在独立事件循环线程里 —— 都不是 Qt 主线程。
在线程池里直接 `widget.setText(...)` 是未定义行为（Qt 的 UI 对象非线程安全）。

`AxonMagicGUI.run(func, *args, **kwargs)` 把函数送回 Qt 主线程执行，返回 `Future`：

```python
from axon import AxonMagicGUI

result = AxonMagicGUI.run(lambda: view.windowTitle()).result(5)
```

`AxonMagicGUI()` 必须在 `QApplication` 之后、任何 `run()` 之前创建一次（模板和 `docs/main.py` 都这么做了）。

<LiveDemo id="magicgui" />

## 广播到所有窗口

`Axon.broadcast.<JsController>.<method>(...)` 返回每个活着窗口的 Future 列表：

```python
futures = Axon.broadcast.DocsJS.note("hi")
results = [f.result(5) for f in futures]
```

<LiveDemo id="broadcast" />

::: tip 单窗口也要判空
没有窗口时列表为空，`results == []`。别假设至少有一个窗口。
:::
