from __future__ import annotations

from typing import Iterable, Optional, TypedDict

from PySide6 import QtGui
from PySide6.QtCore import QTimer

from .AxonEngineView import AxonWebEngineView
from .AxonEvent import AxonEvent

# need import to register controller
from .AxonStore import AxonStoreBase, AxonStoreSyncManager  # noqa: F401

WebName = str


class AxonGUIOptions(TypedDict, total=False):
    # 是否禁用 Qt 原生右鍵菜單 (設為 True 以支持前端自定義菜單)
    disable_native_context_menu: bool


# noinspection DuplicatedCode,PyShadowingBuiltins
class AxonGUI(AxonWebEngineView):
    instance_dict: dict[WebName, AxonGUI] = {}

    get_web = instance_dict.get

    @classmethod
    def get_web_names(cls) -> Iterable[WebName]:
        return cls.instance_dict.keys()

    def __init__(
        self, web_name: WebName, url: str, options: Optional[AxonGUIOptions] = None
    ):
        super().__init__(url)
        self.web_name = web_name
        self.options = options or {}
        # 实例字典
        self.instance_dict[web_name] = self
        # 内置channel注册
        from .AxonEnv import AxonEnv
        from .AxonJSCallHandler import AxonController, AxonJSCallHandler
        from .AxonPYCall import AxonPYCall

        self.registerChannel("AxonEnv", AxonEnv(self))
        self.registerChannel("AxonJSCallHandler", AxonJSCallHandler())
        self.registerChannel("AxonPYCall", AxonPYCall())
        # 自动注册controller
        AxonController.auto_register(self)
        # loadFinished 只有一个: 页面加载完成 + 前端通道就绪, 两件事都齐了才算数
        self._page_loaded = False
        self._js_ready = False
        self._load_finished_dispatched = False
        self.loadStarted.connect(self._loadStarted)
        self.loadFinished.connect(self._loadFinished)

    def _loadStarted(self):
        # 重新加载/跳转: 前端通道需要重新握手, 事件重新攒
        self._page_loaded = False
        self._js_ready = False
        self._load_finished_dispatched = False

    def _loadFinished(self):
        self._page_loaded = True
        self._dispatch_load_finished()

    def mark_js_channel_ready(self):
        self._js_ready = True
        self._dispatch_load_finished()

    def _dispatch_load_finished(self):
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

    def showEvent(self, arg__1: QtGui.QShowEvent, /) -> None:
        AxonEvent.dispatch_js_event(self.web_name, "show")
        super().showEvent(arg__1)


def QDropEventToDict(e: QtGui.QDropEvent):
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
