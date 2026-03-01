from __future__ import annotations

from typing import TYPE_CHECKING

from PySide6.QtCore import QObject

if TYPE_CHECKING:
    from .AxonGUI import AxonGUI


class AxonEnv(QObject):
    def __init__(self, web: AxonGUI):
        super().__init__()
        self.web_name = web.web_name
