# 变更记录

<p align="center"><b>简体中文</b> · <a href="CHANGELOG.en.md">English</a></p>

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；版本号语义为
`MAJOR.MINOR.PATCH`。Python 包名 `axon-gui`（模块名 `axon`），npm 包名 `axon-gui`。

## [Unreleased]

### 变更

- **axon-shell 0.2.0 只保留「原生那层」**：去掉标题栏、菜单条、窗口按钮样式、主题等纯前端实现，
  也不再随包发 `shell.css`；只提供无边框窗口、拖拽区命中、窗口控制、窗口状态事件与原生菜单桥。
  文档站「自己画标题栏」两页（`/guide/window-chrome`、`/en/guide/window-chrome`）按新口径重写。
- 窗口外观层拆到独立仓库 [AxonGUI/AxonShell](https://github.com/AxonGUI/AxonShell)：`AxonWindow` 与 `examples/shell` 从核心仓移出，核心仓不再包含窗口 chrome。
- JS 调用修正：只有当第一个参数是数组**且**后面还跟着 kwargs/timeout 时，才按 `fn([args], kwargs, timeout)` 打包解释；`fn([{...}])` 现在表示「传一个数组参数」。

### 新增

- **中英双语文档**：文档站改成 VitePress `locales`（根路径简体中文、`/en/` 英文），
  右上角可切换；两套页面共用同一批组件与同一份构建产物，示例 id 一一对应。
  主题新增 `theme/i18n.ts`，按钮、状态条、消息流标题走 zh/en 两套文案。

### 变更

- `docs/verify_docs.py` 把两个英文示例页纳入点击验证（22 个示例），
  `docs/verify_offline.py` 默认中英各查一页（12 项断言）。

## [5.3.5] - 2026-11-25

### 新增

- `axon-gui init <name> --shell`：直接生成「无边框窗口 + 自绘标题栏」的变体——装 `axon-shell`、
  把 `main.py` 换成 `AxonShellWindow`，并在模板里放一条 `data-axon-drag` 顶栏与
  `min`/`max`/`close` 三个窗口按钮。默认模板不变，仍是系统原生标题栏。
- 模板的静态服务会顺带把已安装 `axon-shell` 包里的 `/axon-shell/shell.js` 暴露出来，
  所以无论用不用 `--shell`，页面都能直接 `<script src="/axon-shell/shell.js">`。

## [5.3.4] - 2026-11-23

### 修复

- **打包成 windowed 客户端后页面一片空白**：`sys.stderr` 为 `None` 时静态服务的
  `log_message()` 抛 `AttributeError`，每个请求都断连（`ERR_EMPTY_RESPONSE`）。
  现在日志写入做了空值保护，异常请求返回 500 而不是断开。CI 的 offscreen smoke
  掩盖了这类问题——以后打包改动要在真实桌面跑。
- **客户端窗口大得离谱/出屏**：按 `availableGeometry()` 收进 94% 并居中，取代写死的
  `1280×840`。
- **首次启动慢**：客户端默认改 `--onedir`，不再每次启动解压 200+ MB。

### 变更

- 客户端产物变为目录（`AxonDocs/AxonDocs.exe`），Release 压缩整个目录。
- `axon-gui init` 取**与本包同版本 tag** 的模板，拿不到才退 `main`，避免 CLI 与模板错版本。

## [5.3.3] - 2026-11-23

### 新增

- 统一项目图标：母版 `assets/axon-mark.svg`（A + 中间那条通道），`tools/make_icons.py`
  一次生成 16–256 PNG、`axon.ico`、512 头像，并同步文档站 favicon、模板 logo、窗口图标。

## [5.3.2] - 2026-11-23

### 修复

- **`pip install` 之后 `axon-gui init` 生成的项目 `npm install` 必挂**（`TS2307`）：
  旧实现只有「在仓库里运行」才把 `core-js` 与 `core-py/axon` vendor 进新项目。现在两条
  路径统一，dist 缺了就退回 npm 取同版本预构建产物。
- 生成项目的 `[tool.uv.sources]` 键名仍写 `axon`，改成 `axon-gui`。

### 变更

- `core-js/dist` 进仓库；新增 `dist/build-info.json` 源码指纹，CI 只校验它（不同环境的
  `index.d.ts` 成员顺序不保证一致，不能按字节比对）。

## [5.3.1] - 2026-11-23

### 新增

- 文档站双形态：无 Python 后端时是纯说明书，在 `AxonGUI` 里打开时可点示例并看到
  每条消息的两端载荷。
- GitHub Pages 文档站、Release 多平台客户端（Windows / Linux）、Python 包与 npm 包。
- `axon-gui init` 脚手架、`tools/make_icons.py`。
