from __future__ import annotations

from typing import TYPE_CHECKING

from PySide6.QtCore import Property, QObject, Slot

if TYPE_CHECKING:
    from .AxonGUI import AxonGUI


class AxonEnv(QObject):
    """暴露给 JS 的环境对象（通道里叫 AxonEnv）。"""

    def __init__(self, web: AxonGUI) -> None:
        super().__init__()
        self._web = web
        self._web_name = web.web_name

    @Property(str, constant=True)
    def web_name(self) -> str:
        return self._web_name

    @Property(bool, constant=True)
    def supports_codec(self) -> bool:
        """告诉前端：这个后端会解压/会压缩大字符串。"""
        return True

    @Slot(bool)
    def codec(self, enabled: bool) -> None:
        """前端声明自己也会解压，之后才允许后端发压缩块。"""
        self._web._js_codec = bool(enabled)

    @Slot()
    def ready(self) -> None:
        """JS 侧 AxonInit() 完成后回调，标记「前端已经能收事件了」。

        页面加载完成（loadFinished）早于前端通道就绪是常态: 前端此时还没
        连上 onCallSignal, 直接派发 loadFinished 会丢。所以由前端主动报到,
        后端再把攒着的事件派发出去。
        """
        self._web.mark_js_channel_ready()
