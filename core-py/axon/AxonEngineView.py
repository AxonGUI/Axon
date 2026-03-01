from __future__ import annotations
from PySide6.QtCore import QObject, QUrl
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineCore import QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView


class AxonWebEngineView(QWebEngineView):
    def __init__(self, url: str):
        super().__init__()
        # init
        self.load(QUrl(url))
        # webChannel
        self.webChannel = QWebChannel()
        self.page().setWebChannel(self.webChannel)
        self.channelDict: dict[str, QObject] = {}
        self.get_channel = self.channelDict.get
        # settings https://doc.qt.io/qtforpython-6/PySide6/QtWebEngineCore/QWebEngineSettings.html#qwebenginesettings
        self.page().settings().setAttribute(
            QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, True
        )
        self.page().settings().setAttribute(
            QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True
        )
        self.page().settings().setAttribute(
            QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True
        )
        self.page().settings().setAttribute(
            QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True
        )
        self.page().settings().setAttribute(
            QWebEngineSettings.WebAttribute.AllowRunningInsecureContent, True
        )
        self.page().settings().setAttribute(
            QWebEngineSettings.WebAttribute.JavascriptCanPaste, True
        )
        self.page().settings().setAttribute(
            QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled, True
        )

    def registerChannel(self, id: str, object: QObject):
        self.webChannel.registerObject(id, object)
        self.channelDict[id] = object
