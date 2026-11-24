# 自己画标题栏（可选）

Axon 默认用系统的原生窗口：标题栏、最小化/最大化/关闭都是操作系统画的。想换成 VSCode 那种自绘外观，用可选包 **axon-shell**——它只是「窗口长什么样」，跟通道怎么走没有关系，所以单独一个仓库。

```bash
# 还没上 PyPI，先从仓库装（PyPI 上架后直接 pip install axon-shell）
pip install "git+https://github.com/AxonGUI/AxonShell.git"
```

它依赖 `axon-gui>=5.3.4`，装之前先确认 `python -c "import axon"` 能用。

装上之后，Python 侧把 `AxonGUI` 换成 `AxonShellWindow`：

```python
from PySide6.QtWidgets import QApplication
import sys

from axon import AxonMagicGUI
from axon_shell import AxonShellWindow

app = QApplication(sys.argv[:1])
AxonMagicGUI()

view = AxonShellWindow(
    "MainView",
    "http://127.0.0.1:5173/",
    title="My App",
)
view.show()
sys.exit(app.exec())
```

网页侧加载它自带的皮肤，然后 `mount()`：

```html
<link rel="stylesheet" href="/axon-shell/shell.css">
<script src="/vendor/axon.umd.cjs"></script>
<script src="/axon-shell/shell.js"></script>
<script>
  const { Axon, AxonInit } = window.axon;

  (async () => {
    await AxonInit();
    AxonShell.mount({
      title: "My App",
      menus: [
        {
          label: "文件",
          items: [
            { id: "new", label: "新建", shortcut: "Ctrl+N", run: () => console.log("new") },
            { kind: "separator" },
            { id: "quit", label: "退出", shortcut: "Alt+F4", run: () => Axon.Window.close() },
          ],
        },
        { label: "视图", items: [{ id: "theme", label: "切换主题", run: () => AxonShell.toggleTheme() }] },
      ],
    });
  })();
</script>
```

`mount()` 会往 `<body>` 里插一条 36px 的标题栏（品牌标记、菜单条、窗口按钮），并负责：

- 拖动窗口：把标题栏里非交互元素的矩形上报成拖拽区；
- Windows 上由系统处理拖动、双击最大化、贴边、四向缩放；其它平台用指针增量模拟；
- 窗口状态变化时派发 `window:state`，原生菜单选中时派发 `window:menu`。

菜单、右键菜单、主题、窗口控制这几个 API 的完整说明在
[AxonShell 仓库](https://github.com/AxonGUI/AxonShell) 的 README 里；示例程序 `examples/files` 是一个 200 行的文件浏览器。

::: tip 什么时候不该用它
只做个小工具、系统标题栏够用，就别装这个包——自绘标题栏意味着你要自己处理拖拽区、缩放边和高 DPI，这些琐事交给操作系统最省心。
:::
