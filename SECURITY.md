# 安全策略

这是一个**本地桌面框架**：Python 进程自带一个只监听 `127.0.0.1` 的静态服务，
Web 前端通过 QWebChannel 调本机 Python。它不对外提供服务，但有几类风险值得报。

## 怎么报

**不要开公开 issue**，走 GitHub 的私密通道：

<https://github.com/AxonGUI/Axon/security/advisories/new>

我会在 7 天内回；能复现的会给出修复版本与致谢（如果你愿意署名）。

## 在范围内的

- 任意网页内容通过 `AxonGUI(web_name, url)` 加载后，能越权调到不该调的控制器
- `core-js` 的调用通道存在注入/原型污染，能绕过参数边界
- 本地静态服务的路径穿越（`docs/server.py`、模板里的 `start_server`）
- 打包客户端（`AxonDocs.exe`）的 DLL/资源加载被劫持
- 事件、Store 的跨窗口隔离失效（A 窗口能读 B 窗口的 store）

## 不在范围内

- 需要本机已经取得代码执行权限的攻击（同权限下的本地进程互操作）
- 用户自己把 `AxonGUI` 指向了不可信远端的风险，以及由此产生的数据外泄
- 依赖项的已知漏洞——请直接报到上游（PySide6 / VitePress / Vue）

## 加固建议（给使用者）

- 只加载自己的页面；不要 `AxonGUI(..., "https://...")` 打开第三方站点。
- `QTWEBENGINE_REMOTE_DEBUGGING` 只在需要时开，且只绑 `127.0.0.1`。
- 发布的客户端不要关掉 Chromium 沙箱以外的其他默认安全设置。
