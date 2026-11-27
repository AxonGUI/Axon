from __future__ import annotations

from typing import Optional, TypedDict

from PySide6 import QtGui
from PySide6.QtCore import QTimer
from PySide6.QtWebEngineCore import QWebEnginePage

from .AxonError import AxonNotConnectedError
from .AxonEngineView import AxonWebEngineView
from .AxonEvent import AxonEvent

# need import to register controller
from .AxonStore import AxonStoreBase, AxonStoreSyncManager  # noqa: F401  # pyright: ignore[reportUnusedImport]

WebName = str


class AxonGUIOptions(TypedDict, total=False):
    # 是否禁用 Qt 原生右鍵菜單 (設為 True 以支持前端自定義菜單)
    disable_native_context_menu: bool
    # 外链是否交给系统浏览器（默认 True：点 GitHub 链不会把窗口导航走）
    open_links_externally: bool
    # 额外视为「内部」的域名，例如自建后端
    external_allow_hosts: list[str]
    # 渲染进程崩溃后要不要自动重载: "reload"（默认）| "none"
    crash_recovery: str
    # 连续崩溃超过这么多次就不再重载（避免崩溃-重载死循环）
    crash_reload_limit: int


# 已经关掉、等 Qt 在主线程销毁的窗口。
# 见 AxonGUI._retire：这里只是「别让 Python 回收得太早」，Qt 销毁后立刻清空。
_retired_windows: list[AxonGUI] = []


# noinspection DuplicatedCode,PyShadowingBuiltins
class AxonGUI(AxonWebEngineView):
    instance_dict: dict[WebName, AxonGUI] = {}

    get_web = instance_dict.get

    @classmethod
    def windows(cls) -> list[WebName]:
        """还活着的所有窗口名（关掉的窗口会自动摘掉）。

        这是唯一的窗口枚举入口：``AxonGUI.windows()`` 与 ``AxonCross.windows()``
        内容一致。
        """
        return list(cls.instance_dict)

    def __init__(
        self, web_name: WebName, url: str, options: Optional[AxonGUIOptions] = None
    ) -> None:
        self.options = options or {}
        super().__init__(
            url,
            open_links_externally=self.options.get("open_links_externally", True),
            external_allow_hosts=self.options.get("external_allow_hosts", ()),
        )
        self.web_name = web_name
        # 实例字典
        self.instance_dict[web_name] = self
        # 内置channel注册
        from .AxonEnv import AxonEnv
        from .AxonJSCallHandler import AxonController, AxonJSCallHandler
        from .AxonPYCall import AxonPYCall

        self.registerChannel("AxonEnv", AxonEnv(self))
        self.registerChannel("AxonJSCallHandler", AxonJSCallHandler())
        self.registerChannel("AxonPYCall", AxonPYCall())
        # 窗口关掉之后要从实例表里摘掉, 否则跨窗口调用会打到已经不存在的页面
        self.destroyed.connect(self._on_destroyed)
        # 自动注册controller
        AxonController.auto_register(self)
        # loadFinished 只有一个: 页面加载完成 + 前端通道就绪, 两件事都齐了才算数
        self._js_codec = False
        self._page_loaded = False
        self._js_ready = False
        self._load_finished_dispatched = False
        # 崩溃-重载计数: 连续崩到 crash_reload_limit 就停手，交给应用处理
        self._crash_count = 0
        self._load_generation = 0
        self.loadStarted.connect(self._loadStarted)
        self.loadFinished.connect(self._loadFinished)

    def _on_destroyed(self, *_args: object) -> None:
        self._forget_window()

    def _forget_window(self) -> None:
        """把窗口从「现在有哪些窗口」里摘掉（再 show 会重新登记）。

        顺带把发给它的在飞调用了结掉：窗口关掉之后回包永远不会来，留着就是
        让调用方一直挂到超时（没写 timeout 就是永远）。等 ``destroyed`` 再做了结
        不够早——``deleteLater`` 排的销毁要等事件循环走到空闲，测试台用
        ``processEvents()`` 甚至根本不会处理 DeferredDelete。
        """
        if self.instance_dict.get(self.web_name) is self:
            self.instance_dict.pop(self.web_name, None)
        from .AxonPYCall import fail_pending_for

        fail_pending_for(
            self.web_name,
            f"web `{self.web_name}` 已经关闭",
            AxonNotConnectedError,
        )

    def closeEvent(self, event: QtGui.QCloseEvent, /) -> None:  # noqa: N802 - Qt 命名
        super().closeEvent(event)
        if event.isAccepted():
            self._forget_window()
            self._retire()

    def _retire(self) -> None:
        """把关掉的窗口交给 Qt，在主线程销毁。

        只靠 Python 的引用计数/GC 回收 ``QWebEngineView`` 是不可靠的：回收如果发生在
        工作线程（控制器线程池、asyncio 线程），``QWebEnginePage`` 的析构就在非 GUI
        线程上跑，Chromium 会直接 abort——

            Check failed: checker.CalledOnValidBrowserThread(thread_identifier).
            Must be called on Chrome_UIThread; actually called on Unknown Thread.

        这个崩溃在 Python 3.12/3.13 上偶发，3.14 上跑文档站的 68 项验证时稳定复现
        （3.14 改了循环 GC 的触发时机，同一段代码的回收时机跟着变）。

        做法：在 GUI 线程 ``deleteLater()``，同时把这个 Python 包装对象寄存到
        ``_retired_windows``——注册期间谁都不能回收它，等 Qt 真正销毁（``destroyed``
        信号在主线程发出）之后再放开引用。
        """
        if self in _retired_windows:
            return
        _retired_windows.append(self)
        self.destroyed.connect(self._release_retired)
        self.setParent(None)
        self.deleteLater()

    def _release_retired(self, *_args: object) -> None:
        try:
            _retired_windows.remove(self)
        except ValueError:
            pass

    def showEvent(self, event: QtGui.QShowEvent, /) -> None:  # noqa: N802 - Qt 命名
        # 关掉再 show 的窗口要重新登记, 否则跨窗口调用会说「web 不存在」
        self.instance_dict[self.web_name] = self
        AxonEvent.dispatch_js_event(self.web_name, "show")
        super().showEvent(event)

    def _loadStarted(self) -> None:
        # 重新加载/跳转: 前端通道需要重新握手, 事件重新攒
        self._load_generation += 1
        self._js_codec = False
        self._page_loaded = False
        self._js_ready = False
        self._load_finished_dispatched = False

    def _loadFinished(self) -> None:
        self._page_loaded = True
        self.render_crashed = False
        # 页面活过一段时间才算「稳住了」，这时才把崩溃计数清零；
        # 否则「崩-重载-崩」的循环每次重载都会把计数归零，永远停不下来。
        generation = self._load_generation
        QTimer.singleShot(5000, lambda: self._mark_stable(generation))
        self._dispatch_load_finished()

    def _mark_stable(self, generation: int) -> None:
        if generation != self._load_generation:
            return
        if self.render_crashed or not self._js_ready:
            return
        self._crash_count = 0

    def _on_render_process_terminated(
        self,
        status: QWebEnginePage.RenderProcessTerminationStatus,
        exit_code: int,
    ) -> None:
        """渲染进程退出：了结未完成的调用 → 派发事件 → 按策略重载。

        以前这里什么都不做：渲染进程崩掉之后窗口就是一张白纸，Python 侧发给
        它的调用永远等不到回包（没写 ``timeout`` 就是死锁），前端也不知道自己
        已经死了。现在三件事都做，并且把「崩了几次」记下来避免重载死循环。
        """
        super()._on_render_process_terminated(status, exit_code)
        last = self.last_crash or {}
        if last.get("normal"):
            return
        from .AxonPYCall import fail_pending_for

        status_name = str(last.get("status", ""));
        failed = fail_pending_for(
            self.web_name,
            f"渲染进程退出（{status_name}, exit={exit_code}），回包不会再来了",
        )
        # 通道要重新握手：标志位回到初始态，等页面重载后重新报到
        self._js_ready = False
        self._js_codec = False
        self._page_loaded = False
        self._load_finished_dispatched = False
        will_reload = self._should_reload_after_crash()
        AxonEvent.dispatch_event(
            "renderProcessCrashed",
            {
                "webName": self.web_name,
                "status": status_name,
                "exitCode": exit_code,
                "failedCalls": failed,
                "willReload": will_reload,
            },
        )
        if will_reload:
            QTimer.singleShot(0, self.reload)

    def _should_reload_after_crash(self) -> bool:
        if self.options.get("crash_recovery", "reload") != "reload":
            return False
        limit = int(self.options.get("crash_reload_limit", 3))
        self._crash_count += 1
        return self._crash_count <= limit

    def mark_js_channel_ready(self) -> None:
        self._js_ready = True
        self._dispatch_load_finished()

    def _dispatch_load_finished(self) -> None:
        if (
            self._page_loaded
            and self._js_ready
            and not self._load_finished_dispatched
        ):
            self._load_finished_dispatched = True
            # 延后一轮: 前端 await AxonInit() 之后还要注册监听器
            QTimer.singleShot(
                0,
                lambda: AxonEvent.dispatch_js_event(self.web_name, "loadFinished"),
            )

    def contextMenuEvent(self, arg__1: QtGui.QContextMenuEvent, /) -> None:
        AxonEvent.dispatch_js_event(
            self.web_name,
            "contextMenu",
            [
                {
                    "reason": arg__1.reason().value,
                    "globalPos": {
                        "x": arg__1.globalPos().x(),
                        "y": arg__1.globalPos().y(),
                    },
                    "pos": {
                        "x": arg__1.pos().x(),
                        "y": arg__1.pos().y(),
                    },
                }
            ],
        )
        if not self.options.get("disable_native_context_menu", False):
            super().contextMenuEvent(arg__1)

    def dragEnterEvent(self, e: QtGui.QDragEnterEvent, /) -> None:
        AxonEvent.dispatch_js_event(self.web_name, "dragEnter", [QDropEventToDict(e)])
        super().dragEnterEvent(e)

    def dragMoveEvent(self, e: QtGui.QDragMoveEvent, /) -> None:
        AxonEvent.dispatch_js_event(self.web_name, "dragMove", [QDropEventToDict(e)])
        super().dragMoveEvent(e)

    def dropEvent(self, e: QtGui.QDropEvent, /) -> None:
        AxonEvent.dispatch_js_event(self.web_name, "drop", [QDropEventToDict(e)])
        super().dropEvent(e)

    def dragLeaveEvent(self, e: QtGui.QDragLeaveEvent, /) -> None:
        AxonEvent.dispatch_js_event(self.web_name, "dragLeave")
        super().dragLeaveEvent(e)

    def hideEvent(self, arg__1: QtGui.QHideEvent, /) -> None:
        AxonEvent.dispatch_js_event(self.web_name, "hide")
        super().hideEvent(arg__1)

def QDropEventToDict(e: QtGui.QDropEvent) -> dict[str, object]:
    return {
        "mimeData": {
            "urls": [u.toLocalFile() for u in e.mimeData().urls()],
            "text": e.mimeData().text(),
            "html": e.mimeData().html(),
            "formats": e.mimeData().formats(),
        },
        "pos": {
            "x": e.pos().x(),
            "y": e.pos().y(),
        },
        "posF": {
            "x": e.posF().x(),
            "y": e.posF().y(),
        },
        "modifiers": e.keyboardModifiers().value,
        "keyboardModifiers": e.keyboardModifiers().value,
        "buttons": e.mouseButtons().value,
        "mouseButtons": e.mouseButtons().value,
        "dropAction": e.dropAction().value,
        "possibleActions": e.possibleActions().value,
        "proposedAction": e.proposedAction().value,
    }
