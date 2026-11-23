from __future__ import annotations
from PySide6.QtCore import QObject, QUrl
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineCore import QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView


class AxonWebEngineView(QWebEngineView):
    def __init__(self, url: str):
        super().__init__()
        # webChannel 必须先于 load(): 页面里的 qwebchannel.js 一执行就会找
        # qt.webChannelTransport, 先 load 再 setWebChannel 属于竞态。
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
        # 通道与 settings 都就绪后再真正开始加载
        self.load(QUrl(url))

    def registerChannel(self, id: str, object: QObject):
        self.webChannel.registerObject(id, object)
        self.channelDict[id] = object
