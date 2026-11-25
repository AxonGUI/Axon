from __future__ import annotations
from typing import Iterable

from PySide6.QtCore import QBuffer, QByteArray, QIODevice, QObject, QUrl
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtGui import QDesktopServices
from PySide6.QtWebEngineCore import (
    QWebEnginePage,
    QWebEngineProfile,
    QWebEngineSettings,
    QWebEngineUrlRequestJob,
    QWebEngineUrlScheme,
    QWebEngineUrlSchemeHandler,
)
from PySide6.QtWebEngineWidgets import QWebEngineView

from . import AxonAsset


def _register_asset_scheme() -> None:
    """注册 axon:// 方案。必须在任何 QWebEngineProfile 创建之前调用一次。"""
    try:
        scheme = QWebEngineUrlScheme(b"axon")
        scheme.setFlags(
            QWebEngineUrlScheme.Flag.SecureScheme
            | QWebEngineUrlScheme.Flag.CorsEnabled
            | QWebEngineUrlScheme.Flag.LocalAccessAllowed
            | QWebEngineUrlScheme.Flag.FetchApiAllowed
        )
        # axon://asset/<token>/<name>：Host 形式（没有端口，否则 Qt 要求 defaultPort）
        scheme.setSyntax(QWebEngineUrlScheme.Syntax.Host)
        QWebEngineUrlScheme.registerScheme(scheme)
    except (ValueError, RuntimeError):
        # 已经注册过（同一进程里重复 import / 多次建视图）
        pass


_register_asset_scheme()


class AxonAssetSchemeHandler(QWebEngineUrlSchemeHandler):
    """把 `axon://asset/<token>/<name>` 变成字节流。

    `AxonAsset.register()` 返回的 URL 直接给 `<img src>`、`<video src>`、`fetch()`、
    `download` 都能用：数据不经过 QWebChannel，不占消息通道，也不做 base64。
    """

    def __init__(self, parent: QObject | None = None):
        super().__init__(parent)
        self.served = 0

    def requestStarted(self, job: QWebEngineUrlRequestJob):  # noqa: N802 - Qt 命名
        asset = AxonAsset.lookup(job.requestUrl().toString())
        if asset is None:
            job.fail(QWebEngineUrlRequestJob.Error.UrlNotFound)
            return
        self.served += 1
        try:
            job.setAdditionalResponseHeaders(
                {
                    b"Access-Control-Allow-Origin": b"*",
                    b"Cache-Control": b"no-store",
                }
            )
        except (AttributeError, TypeError):
            pass
        data = QByteArray(asset.data)
        buffer = QBuffer(job)
        buffer.setData(data)
        buffer.open(QIODevice.OpenModeFlag.ReadOnly)
        job.reply(asset.mime.encode("ascii", "replace"), buffer)


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
        # axon:// 资源通道：每个 profile 装一次，handler 挂在 profile 上保活
        profile = self.page().profile()
        if getattr(profile, "_axon_asset_handler", None) is None:
            handler = AxonAssetSchemeHandler(profile)
            profile.installUrlSchemeHandler(b"axon", handler)
            profile._axon_asset_handler = handler
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
