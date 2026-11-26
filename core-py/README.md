# axon-gui (Python side)

The Python runtime of [Axon](https://github.com/AxonGUI/Axon): `AxonGUI` opens a
`QWebEngineView` with a QWebChannel attached, `AxonController` exposes Python objects to the
frontend, and `Axon` calls objects the frontend exposed.

```python
import controller  # your @AxonController definitions
from axon import AxonGUI, AxonMagicGUI
from PySide6.QtWidgets import QApplication

app = QApplication([])
AxonMagicGUI()                      # only needed when you want to run code on the Qt main thread
view = AxonGUI("main", "http://127.0.0.1:5173/")   # web_name must match the frontend
view.show()
app.exec()
```

Docs and live examples: <https://axongui.github.io/en/> · 中文文档：<https://axongui.github.io/>

---

## 中文

Axon 的 Python 运行时：`AxonGUI` 开一个挂了 QWebChannel 的 `QWebEngineView`，
`AxonController` 把 Python 对象暴露给前端，`Axon` 反过来调前端暴露的对象。

```python
import controller  # 你的 @AxonController 定义
from axon import AxonGUI, AxonMagicGUI
from PySide6.QtWidgets import QApplication

app = QApplication([])
AxonMagicGUI()                      # 需要 Qt 主线程执行能力时
view = AxonGUI("main", "http://127.0.0.1:5173/")   # web_name 要和前端一致
view.show()
app.exec()
```

完整文档与可交互示例见 <https://axongui.github.io/>；文档站本身也是一个可交互示例工程（<https://github.com/AxonGUI/axongui.github.io>）。
