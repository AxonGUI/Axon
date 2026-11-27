from __future__ import annotations
from typing import Iterable

from PySide6.QtCore import QBuffer, QByteArray, QFile, QIODevice, QObject, QUrl
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtGui import QDesktopServices
from PySide6.QtWebEngineCore import (
    QWebEnginePage,
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

    `AxonAsset.from_bytes()` / `from_file()` 返回的 URL 直接给 `<img src>`、
    `<video src>`、`fetch()`、`download` 都能用：数据不经过 QWebChannel，
    不占消息通道，也不做 base64；文件类资产在请求到达时才打开，不进内存。
    """

    def __init__(self, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self.served = 0

    def requestStarted(self, job: QWebEngineUrlRequestJob) -> None:  # noqa: N802 - Qt 命名
        asset = AxonAsset.lookup(job.requestUrl().toString())
        if asset is None:
            job.fail(QWebEngineUrlRequestJob.Error.UrlNotFound)
            return
        self.served += 1
        try:
            job.setAdditionalResponseHeaders(
                {
                    QByteArray(b"Access-Control-Allow-Origin"): QByteArray(b"*"),
                    QByteArray(b"Cache-Control"): QByteArray(b"no-store"),
                }
            )
        except (AttributeError, TypeError):
            pass
        mime = asset.mime.encode("ascii", "replace")
        if asset.path is not None:
            file = QFile(str(asset.path))
            if not file.open(QIODevice.OpenModeFlag.ReadOnly):
                job.fail(QWebEngineUrlRequestJob.Error.UrlNotFound)
                return
            file.setParent(job)  # 让 job 负责生命周期
            job.reply(mime, file)
            return
        buffer = QBuffer(job)
        buffer.setData(QByteArray(asset.data or b""))
        buffer.open(QIODevice.OpenModeFlag.ReadOnly)
        job.reply(mime, buffer)


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
        self,
        url: QUrl | str,
        navigation_type: QWebEnginePage.NavigationType,
        is_main_frame: bool,
    ) -> bool:
        target = QUrl(url) if isinstance(url, str) else url
        if self._is_popup:
            self._open_in_system_browser(target)
            self.deleteLater()
            return False
        if self._open_externally and target.scheme() in ("mailto", "tel"):
            self._open_in_system_browser(target)
            return False
        if self._open_externally and is_external_url(target, self._allow_hosts):
            self._open_in_system_browser(target)
            return False
        return super().acceptNavigationRequest(target, navigation_type, is_main_frame)

    def createWindow(  # type: ignore[override]  # noqa: N802 - Qt 命名
        self, _type: QWebEnginePage.WebWindowType
    ) -> QWebEnginePage | None:
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
            # 用 setattr: QWebEngineProfile 是 C++ 对象, 动态属性不是它的声明成员
            setattr(profile, "_axon_asset_handler", handler)
        # 渲染进程退出（崩溃 / 被杀 / 正常关闭）: 基类只记录，恢复策略由 AxonGUI 定
        self.render_crashed = False
        self.last_crash: dict[str, object] | None = None
        self.page().renderProcessTerminated.connect(self._on_render_process_terminated)
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

    def registerChannel(self, id: str, object: QObject) -> None:
        self.webChannel.registerObject(id, object)
        self.channelDict[id] = object

    def _on_render_process_terminated(
        self,
        status: QWebEnginePage.RenderProcessTerminationStatus,
        exit_code: int,
    ) -> None:
        """渲染进程退出：这里只把事实记下来（基类不做恢复）。

        恢复（重载、把未完成的调用判为失败、派发事件）在 ``AxonGUI``。
        """
        normal = (
            status
            == QWebEnginePage.RenderProcessTerminationStatus.NormalTerminationStatus
        )
        self.render_crashed = not normal
        self.last_crash = {
            "status": status.name,
            "exitCode": exit_code,
            "normal": normal,
        }
