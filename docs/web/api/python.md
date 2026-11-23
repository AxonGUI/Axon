# Python 端 API

```python
from axon import (
    Axon, AxonController, AxonStore, AxonEvent, AxonMagicGUI, AxonGUI, AxonCall,
)
from axon.AxonGUI import AxonGUIOptions
```

## `Axon(web_name)` —— 调 JS

```python
ax = Axon("AxonDocs")
ax.DocsJS.mirror({"hello": "python"})   # → Future
ax.DocsJS.value.get(5)                  # 读 JS 属性（同步阻塞）
ax.DocsJS.value = 99                    # 写 JS 属性（不等返回）
```

成员是 `_JSProperty`，三种用法：

| 写法 | 返回 |
| --- | --- |
| `ax.Ctl.func(*args, kwargs=...)` | `AxonFuture`（可 `.result(t)` / `await`） |
| `await ax.Ctl.prop` | 属性值（`asyncio.wrap_future`） |
| `ax.Ctl.prop.get(timeout)` | 属性值（同步阻塞） |

### `Axon.broadcast`

`Axon.broadcast.<JsCtl>.<method>(...)` 向所有窗口发一次调用，返回 `list[Future]`。

## `AxonController`

```python
@AxonController(web_name="*", id=None, shared=False)
class MyController: ...
```

- `web_name`：字符串或列表；`"*"` 表示所有窗口（含之后新建的窗口）。
- `id`：控制器名，默认类名。
- `shared`：多个窗口共用同一个实例（默认每窗口一个实例）。

运行时接口：

```python
AxonController.register(obj, web_name="*", id=None)   # 注册现成实例
AxonController.unregister(controller_id, web_name="*")
AxonController.get(web_name, controller_id)           # → 实例（不存在抛 RuntimeError）
AxonController.get_prop(web_name, controller_id, prop)
AxonController.set_prop(web_name, controller_id, prop, value)
```

::: tip 类与时序
装饰器注册的类在**窗口创建时**实例化（`AxonGUI.__init__` 里调 `auto_register`）。
`register()` 的实例则立即生效；注册到 `"*"` 的实例也会被之后新建的窗口继承。
:::

## `AxonStore`

```python
store = AxonStore("id", "webA", "webB")     # 同 id 复用；auto_create=True
store.get("k")                               # 读缓存（等价于 store.prop("k").get()）
store.set("k", v)                            # 写 + 广播（等价于 store.prop("k").set(v)）
store.prop("k").value                        # 直接读字段
store.k = v                                  # 等价于上面
store.add_web("webC") / store.remove_web("webC")
store.release()
AxonStore.shared                             # id="__shared__"，跨窗口
```

## `AxonEvent`

```python
AxonEvent.add_listener(type, listener, options=None)   # on 是别名
AxonEvent.remove_listener(type, listener)              # off 是别名
AxonEvent.remove_all_listeners(type)
AxonEvent.dispatch_event(type, *args)                  # 本地派发
AxonEvent.dispatch_js_event(web_name, type, args=[])   # 推给某个窗口
AxonEvent.dispatch_js_event_batch(events)              # 批量推送
```

监听器可以是普通函数或 `async def`。

## `AxonMagicGUI`

```python
AxonMagicGUI()                                  # 在 QApplication 之后创建一次
AxonMagicGUI.run(func, *args, **kwargs) -> Future
```

把 `func` 投递到 Qt 主线程执行。未初始化时抛 `RuntimeError("init AxonMagicGUI first")`。

## `AxonGUI`

```python
view = AxonGUI(web_name, url, options=None)
view.resize(1100, 720)
view.show()
```

| 成员 | 说明 |
| --- | --- |
| `web_name` | 窗口名，`Axon(web_name)` / 消息里的 `web_name` 都用它 |
| `options` | `{"disable_native_context_menu": True}` 可关掉 Qt 原生右键菜单，交给前端自定义 |
| `AxonGUI.get_web(name)` / `get_web_names()` | 按名字取窗口 / 列出所有窗口 |
| `registerChannel(id, obj)` | 额外注册一个 QWebChannel 对象 |
| `get_channel(id)` | 取通道对象 |

## 低层 `AxonCall`

```python
from axon import AxonCall

AxonCall.call(web_name, controller_id, func, args=(), kwargs=None) -> Future
AxonCall.setVar(web_name, controller_id, var_name, value) -> Future
AxonCall.getVar(web_name, controller_id, var_name) -> Future
AxonCall.broadcast(controller_id, func, args=(), kwargs=None) -> list[Future]
```

`AxonCall` 与 `AxonPYCall.AxonCall` 是同一个对象（staticmethod 包装）。

## 窗口/拖拽事件

`AxonGUI` 自动把 `loadFinished`、`contextMenu`、`dragEnter`、`dragMove`、`drop`、`dragLeave`、
`hide`、`show` 转发给页面。详见[事件](/examples/event#qt-窗口事件)。
