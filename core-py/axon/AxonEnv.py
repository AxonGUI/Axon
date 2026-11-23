from __future__ import annotations

from typing import TYPE_CHECKING

from PySide6.QtCore import Property, QObject, Slot

if TYPE_CHECKING:
    from .AxonGUI import AxonGUI


class AxonEnv(QObject):
    """暴露给 JS 的环境对象（通道里叫 AxonEnv）。"""

    def __init__(self, web: AxonGUI):
        super().__init__()
        self._web = web
        self._web_name = web.web_name

    @Property(str, constant=True)
    def web_name(self):
        return self._web_name

    @Slot()
    def ready(self):
        """JS 侧 AxonInit() 完成后回调，标记「前端已经能收事件了」。

        页面加载完成（loadFinished）早于前端通道就绪是常态: 前端此时还没
        连上 onCallSignal, 直接派发 loadFinished 会丢。所以由前端主动报到,
        后端再把攒着的事件派发出去。
        """
        self._web.mark_js_channel_ready()
