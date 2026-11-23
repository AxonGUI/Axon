# 变更记录

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；版本号语义为
`MAJOR.MINOR.PATCH`。Python 包名 `axon-gui`（模块名 `axon`），npm 包名 `axon-gui`。

## [Unreleased]

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
