# 主线程任务与广播

<span class="channel-tag">PY → GUI · 多窗口</span>

控制器方法不跑在 Qt 主线程上（同步方法在线程池，`async` 方法在事件循环里）。要碰 Qt 控件、弹窗、改窗口状态，就得把这段代码送回主线程 —— 这就是 `AxonMagicGUI`。

## 回到 Qt 主线程执行

```python
from PySide6.QtCore import QThread
from PySide6.QtWidgets import QApplication, QMessageBox

from axon import AxonController, AxonMagicGUI


@AxonController("MainView")
class DemoController:
    def ask(self) -> bool:
        def on_main() -> bool:
            # 这里才在 Qt 主线程：可以安全地用任何 Qt 控件
            app = QApplication.instance()
            on_main_thread = QThread.currentThread() is app.thread()
            QMessageBox.information(None, "来自 Python", "这个弹窗在主线程里弹出")
            return on_main_thread

        # run() 返回 Future，.result(5) 等 5 秒
        return AxonMagicGUI.run(on_main).result(5)
```

::: warning 先初始化
创建 `QApplication` 之后要调用一次 `AxonMagicGUI()`，否则 `run()` 会抛 `RuntimeError("init AxonMagicGUI first")`：

```python
app = QApplication(sys.argv)
AxonMagicGUI()                       # 只需要一次
view = AxonGUI("MainView", url)
```
:::

## 点一下试试

这段会检查自己到底在哪个线程里执行：

<LiveDemo id="magicgui" />

## 广播：一次调用打到所有窗口

一个进程里可以开多个窗口。`Axon.broadcast` 把一个调用发给**所有**窗口里同名对象的同名方法，返回一个 Future 列表：

```python
from axon import Axon

futures = Axon.broadcast.DocsJS.note("hi from python")
for future in futures:              # 每个窗口一个 Future
    future.result(5)                # 想等结果就取；不关心就跳过
```

<LiveDemo id="broadcast" />

## 要点

- **只有需要碰 Qt 对象时才用 `AxonMagicGUI`**：纯计算、读写文件、调 API 不需要。
- **`run()` 是异步排队的**：它把函数丢进主线程的事件队列，返回值通过 Future 拿。
- **主线程里别阻塞**：`on_main` 里不要 `time.sleep` 或等网络，界面会卡住。
- **广播不保证顺序**，也不区分窗口；只给「所有窗口都该知道」的通知用。
