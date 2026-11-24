# Draw your own title bar (optional)

By default Axon uses the native window: the title bar, minimize/maximize/close are all drawn by the operating system. If you want the VSCode-style chrome, use the optional **axon-shell** package — it is only "what the window looks like", unrelated to how the channel works, which is why it lives in its own repository.

```bash
# not on PyPI yet — install from the repository for now
pip install "git+https://github.com/AxonGUI/AxonShell.git"
```

It depends on `axon-gui>=5.3.4`, so make sure `python -c "import axon"` works first.

On the Python side, use `AxonShellWindow` instead of `AxonGUI`:

```python
import sys

from PySide6.QtWidgets import QApplication

from axon import AxonMagicGUI
from axon_shell import AxonShellWindow

app = QApplication(sys.argv[:1])
AxonMagicGUI()

view = AxonShellWindow("MainView", "http://127.0.0.1:5173/", title="My App")
view.show()
sys.exit(app.exec())
```

On the page, load the bundled skin and call `mount()`:

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
          label: "File",
          items: [
            { id: "new", label: "New", shortcut: "Ctrl+N", run: () => console.log("new") },
            { kind: "separator" },
            { id: "quit", label: "Quit", shortcut: "Alt+F4", run: () => Axon.Window.close() },
          ],
        },
        { label: "View", items: [{ id: "theme", label: "Toggle theme", run: () => AxonShell.toggleTheme() }] },
      ],
    });
  })();
</script>
```

`mount()` inserts a 36px title bar (brand mark, menu strip, window buttons) and handles:

- dragging: it reports the title-bar rectangles that are not interactive elements as drag regions;
- on Windows the system handles dragging, double-click maximize, snapping and edge resizing; other platforms simulate it with pointer deltas;
- dispatching `window:state` when the window state changes, and `window:menu` when a native menu item is picked.

Full API for menus, context menus, themes and window control is in the
[AxonShell repository](https://github.com/AxonGUI/AxonShell); its `examples/files` is a 200-line file browser.

::: tip When not to use it
If you are building a small tool and the system title bar is fine, skip this package — custom chrome means you own drag regions, resize edges and HiDPI quirks. Let the OS do it.
:::
