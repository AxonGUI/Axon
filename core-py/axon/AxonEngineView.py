from __future__ import annotations
from typing import Iterable

from PySide6.QtCore import QObject, QUrl
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtGui import QDesktopServices
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView


# 本机地址：这些不该被当成「外链」丢给系统浏览器
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


def is_external_url(url: QUrl, allow_hosts: Iterable[str] = ()) -> bool:
    """http(s) 且不是本机地址 -> 认为是外链。"""
    if url.scheme() not in ("http", "https"):
        return False
    host = url.host()
    if not host:
        return False
    return host not in LOCAL_HOSTS and host not in set(allow_hosts)


class AxonWebEnginePage(QWebEnginePage):
    """把外链交给系统浏览器，而不是在窗口里把应用导航走。

    `target="_blank"` 的链接会走 `createWindow()`：这里返回一个一次性页面，
    它的第一次导航同样被拦截并交给系统浏览器。
    """

    def __init__(
        self,
        view: "AxonWebEngineView",
        open_links_externally: bool = True,
        allow_hosts: Iterable[str] = (),
    ):
        super().__init__(view)
        self._view = view
        self._open_externally = open_links_externally
        self._allow_hosts = tuple(allow_hosts)
        self._is_popup = False
        # 记录被接管的外链，方便测试/排查
        self.opened_externally: list[str] = []

    def _open_in_system_browser(self, url: QUrl) -> bool:
        self.opened_externally.append(url.toString())
        return QDesktopServices.openUrl(url)

    def acceptNavigationRequest(  # noqa: N802 - Qt 命名
        self, url: QUrl, navigation_type: QWebEnginePage.NavigationType, is_main_frame: bool
    ) -> bool:
        if self._is_popup:
            self._open_in_system_browser(url)
            self.deleteLater()
            return False
        if self._open_externally and url.scheme() in ("mailto", "tel"):
            self._open_in_system_browser(url)
            return False
        if self._open_externally and is_external_url(url, self._allow_hosts):
            self._open_in_system_browser(url)
            return False
        return super().acceptNavigationRequest(url, navigation_type, is_main_frame)

    def createWindow(self, _type):  # noqa: N802 - Qt 命名
        if not self._open_externally:
            return super().createWindow(_type)
        popup = AxonWebEnginePage(self._view, True, self._allow_hosts)
        popup._is_popup = True
        return popup


class AxonWebEngineView(QWebEngineView):
    def __init__(
        self,
        url: str,
        open_links_externally: bool = True,
        external_allow_hosts: Iterable[str] = (),
    ):
        super().__init__()
        self.page_ = AxonWebEnginePage(self, open_links_externally, external_allow_hosts)
        self.setPage(self.page_)
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
