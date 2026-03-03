from __future__ import annotations

from typing import Iterable, Optional, TypedDict

from PySide6 import QtGui

from .AxonEngineView import AxonWebEngineView
from .AxonEvent import AxonEvent
from .AxonPYCall import broadcast, call

WebName = str


class VastGUIOptions(TypedDict, total=False):
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
        self, web_name: WebName, url: str, options: Optional[VastGUIOptions] = None
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
        self.registerChannel("AxonCallHandler", AxonJSCallHandler())
        self.registerChannel("AxonPYCall", AxonPYCall())
        # 自动注册controller
        AxonController.auto_register(self)
        self.loadFinished.connect(self._loadFinished)

    def _loadFinished(self):
        AxonEvent.dispatch_js_event(self.web_name, "loadFinished")

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

    call = staticmethod(call)
    broadcast = staticmethod(broadcast)


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
