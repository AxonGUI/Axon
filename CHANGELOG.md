# 变更记录

<p align="center"><b>简体中文</b> · <a href="CHANGELOG.en.md">English</a></p>

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；版本号语义为
`MAJOR.MINOR.PATCH`。Python 包名 `axon-gui`（模块名 `axon`），npm 包名 `axon-gui`。

## [5.7.0] - 2026-11-26

### 变更（破坏性，统一两端 API）

- **异常统一成 Error 子类**：JS 侧新增 `AxonError` / `AxonTimeoutError` / `AxonNotConnectedError` /
  `AxonRemoteError`（带稳定的 `code`），`catch (e)` 拿到的永远是 `Error`（以前有几处直接 reject 字符串，
  `e.message` 是 undefined）。Python 侧新增 `AxonError` / `AxonTimeoutError` / `AxonNotConnectedError`，
  `JSRuntimeError` 改为继承 `AxonError`；`AxonTimeoutError` 同时继承内置 `TimeoutError`，老的
  `except TimeoutError` 照样能用。
- **`store.get(name)` 两端同义**：JS 原来返回属性对象、Python 返回值，现在两边都返回**值**；要属性对象（写回用）
  用 `store.prop(name)`。`await store.get(name)` 仍然可用。
- **窗口枚举只留一个入口**：删掉 `AxonGUI.get_web_names()`，用 `AxonGUI.windows()`（`AxonCross.windows()` 同源）。
- **`AxonAsset` 只留类方法**：删掉模块级别的 `asset_url()` / `asset_url_from_file()`，用
  `AxonAsset.from_bytes()` / `AxonAsset.from_file()`。

## [5.6.2] - 2026-11-26

### 变更

- 用正向选择器 **`--only ts|py|both`**（默认 `both`）替代 `--skip-ts` / `--skip-py`。负向开关不扩展：产物
  再多一个就得继续加 `--skip-*`，而 `--only` 是线性的、读起来也直接（「我只要 TS」而不是「我不要 Python」）。
- `--skip-ts` / `--skip-py` 已移除（5.6.x 刚发布、无已知使用者）。等价写法：`--skip-py` → `--only ts`，
  `--skip-ts` → `--only py`。

## [5.6.1] - 2026-11-26

### 修复

- `axon-gui types --skip-ts/--skip-py` 等参数被顶层 argparse 拒掉（`unrecognized arguments`）：`types` 的参数
  现在直接交给生成器自己的 parser，不再两处各维护一份（旧的重复声明也删了）。
- wheel 里没有 `axon/typecodegen/extract_js.mjs`：装出来的包跑 `--js` 会 `Cannot find module`。`package-data`
  补上 `typecodegen/*.mjs`。

## [5.6.0] - 2026-11-26

### 变更

- `axon-gui types` **默认两个方向都生成**：`web/src/axon.generated.ts`（Python 控制器 → TS）与
  `controller/js_controllers.py`（前端控制器 → Python）。之前要 `--js` 才出第二份，容易以为「只有一个方向」。
- 新增 `--skip-ts` / `--skip-py` 只生成一边；`--out` / `--py-out` 仍然用于指定位置。
- 从 `web/` 这类前端目录里运行时，会自动把项目根（上一级有 `controller/` 的那层）当作基准目录，
  所以模板里不需要再传 `--controllers ../controller --out src/...`。
- 前端源码位置也自动探测（`web/src` → `src` → `web` → `app`），找不到时 Python 侧生成一个空存根并在
  stderr 说明，不会静默失败。

### 修复

- 生成 Python 存根时会先把项目根放进 `sys.path`，否则在 `web/` 里跑 `controller` 这个包导入不到。

## [5.5.2] - 2026-11-26

### 修复

- `--controllers` 也接受**文件路径**（`./controller/app.py`）；路径不存在时报明确错误，而不是
  `TypeError: the 'package' argument is required`。
- 没有安装 `typescript` 时的正则退化会**把 `AxonController.register(` 本身当成一个方法**，成员表里多出
  一个 `register("DocsJS", {...}, mirror, payload)` 的假方法。改成 brace/paren 感知的对象字面量扫描，
  现在只出真实成员（含属性与 `async` 方法）。
- Python 存根默认输出从 `controller/js_controllers.pyi` 改成 **`controller/js_controllers.py`**：产物里有
  可执行的 `connect()`，`.pyi` 不会被导入，`from controller.js_controllers import connect` 会 ImportError。

## [5.5.1] - 2026-11-26

### 修复

- `axon-gui types --controllers` 支持**路径**写法（`--controllers ../controller`）。此前只能写模块名，且必须在
  能 import 到它的工作目录里跑；模板与 Vite 插件都在 `web/` 子目录里执行，于是 `types:check` 会失败。
- 生成物不再包含「来源」行（它记录的是相对路径，换个工作目录就变），这样同一个文件可以在仓库根、`web/`、
  CI 里任一处 `--check` 通过。

## [5.5.0] - 2026-11-26

### 新增

- **两端类型自动生成**（`axon-gui types`）：
  - **Python 控制器 → TypeScript**：反射 `@AxonController` 注册的类（类型注解经 `typing.get_type_hints` 求值，支持
    基本类型 / 容器 / `Optional` / `Literal` / `TypedDict` / `dataclass` / pydantic 模型 / `Enum`），
    生成 `AxonRegistry` 与 `declare module "axon-gui" { interface AxonControllers … }`，VS Code 里写前端时
    `Axon.Greeter.greet(` 会直接出参数名与类型。
  - **前端控制器 → Python**：用 TypeScript 编译器 API 读 `AxonController.register("DocsJS", { … })`
    （对象字面量、工厂函数、类实例都支持），生成 `Protocol` + `connect(web_name)` 入口，
    写 Python 时 `api.DocsJS.mirror(` 有补全；项目里没装 `typescript` 时退化为正则（只给方法名）。
  - `axon-gui/vite-plugin`：Vite 插件在 `vite dev` 启动与保存时自动重生成（约 150 ms）；
    `vite build` 不跑（构建不该依赖 Python 环境）。
  - `--check` 只比对不写文件，供 CI 防止生成物漂移。
- `AxonControllers` 作为公开的类型增强点：没有生成物时 `Axon` 仍是 `any`，行为与旧版一致。

### 说明

- 生成器与框架**同仓**发布（不与 `axon-gui` 拆包）：它依赖两端的类型契约（TS 的模块增强点、Python 的注册表语义），
  拆开会出现「生成器/框架/前端包」三方版本矩阵，失败形态是「补全错乱」，比没有更难受。
- 三套官方模板（Vue / React / Angular）都带上了 `npm run types` / `types:check`，
  Vue 与 React 模板还接好了 Vite 插件的自动生成。

## [5.4.7] - 2026-11-26

### 改进

- **类型质量**：整个包在 `mypy --strict` 下**零错误**（此前 164 条），并随包发布 `py.typed`（PEP 561）——
  你在自己项目里 `from axon import …` 时，mypy / pyright 会真的检查我们这边的注解。
- 补全公开 API 的返回类型：`AxonFuture[T]`、`AxonCall.*`、`AxonCross.*`、`AxonStore.*`、`AxonEvent.*`；
  `AxonPYCall.cancel()` 改成 `AxonFuture.cancel()` 的正常实现（不再给 `Future` 实例挂临时属性）。
- 拆出 `AxonController.get_attr()`：读属性（可能不是函数）与取可调用方法分开，
  `get_prop()` 现在会在「不是函数」时给出明确报错。

### 修复

- **`AxonGUI.showEvent` 被定义了两次**（先注册窗口、后派发 `show` 事件），后一个覆盖前一个 ——
  结果是「关掉再 `show()`」的窗口不会再登记回 `AxonGUI.instance_dict`，跨窗口调用会说 web 不存在。
  现在两个动作在同一次重写里完成。
- `WM_NCHITTEST` 之外的两处细节：`QWebEnginePage.acceptNavigationRequest` 接受 `QUrl | str`；
  `createWindow` 的返回类型与父类对齐（Qt 6 允许 `None`）。

## [5.4.5] - 2026-11-25

### 变更（不兼容）

- `AxonAsset.register()` → **`AxonAsset.from_bytes()`**，`AxonAsset.register_file()` → **`AxonAsset.from_file()`**；
  模块级别名改为 `asset_url()` / `asset_url_from_file()`。旧名不再提供（此前只有 5.4.4 一版用过）。
  理由：`register` 与「把对象注册到窗口」（`AxonController.register`）撞语义，而且它描述的是机制不是目的。

### 改进

- **资产自动回收**：`from_bytes()` 的字节默认不占用户手；空闲 10 分钟自动清、字节总量超 256 MB 按最久未用淘汰
  （`AxonAsset.configure(ttl=..., budget=...)` 可调，环境变量 `AXON_ASSET_TTL` / `AXON_ASSET_BUDGET_MB` 同效）；
  `release()` 保留给「现在就要腾出来」的场合。`from_file()` 的资产不计入字节预算。
- `from_file()` 不再把文件读进内存：协议处理器在请求到达时才用 `QFile` 打开并流式交给 Chromium，
  几百 MB 的视频/安装包也不会撑爆内存（文件被移动或删除后该 URL 返回 404）。

## [5.4.4] - 2026-11-25

### 新增

- **二进制/大文件走 `axon://` URL**：Python 侧 `AxonAsset.register(bytes, name=...)` /
  `AxonAsset.register_file(path)` 把字节登记成 `axon://asset/<token>/<文件名>`，前端直接把它给
  `<img src>`、`<video src>`、`fetch()`、`<a download>` —— 数据不经过 QWebChannel，不做 base64。
  实测 1MB 0.003s、2MB 0.083s（走通道 base64 是数百毫秒级）。
  - 自定义协议注册为 `SecureScheme | CorsEnabled | LocalAccessAllowed | FetchApiAllowed`，
    响应带 `Access-Control-Allow-Origin: *`，所以本机页面上 `fetch()` 也能读。
  - `AxonAsset.release(url)` / `clear()` / `count()` 管理生命周期；不释放会留到进程结束。
  - 限制：`QWebEngineUrlRequestJob` 拿不到请求头，**不支持 Range**（视频拖动、断点续传不可用）。

## [5.4.3] - 2026-11-25

### 新增

- **大字符串自动压缩**：跨端传递 ≥256KB 的字符串时，两端自动 gzip + base64（压完更小才用），
  超过阈值的数据在 16MB 档实测从 1.25–1.68s 降到 ~0.42–0.46s。接口不变，超时/异常语义不变。
  两端都声明支持才启用（老版本自动退回原文）。二进制/大文件仍建议走 URL（后续提供）。

## [5.4.2] - 2026-11-25

### 性能

- 请求合并：同一轮事件循环里发出的 JS→PY 调用合成一条消息发过去（9000 个调用从 9000 条消息降到个位数）。
- 回包合并：worker 线程的结果攒到下一轮事件循环一次性回传。
- 接口零变化：每个调用各自 settle，超时与异常语义不变。基准对比见 `core-py/benchmarks/README.md`。

## [5.4.1] - 2026-11-25

### 新增

- **外链交给系统浏览器**：`AxonGUI` 默认拦截 http(s) 外链（`target="_blank"` 也一样），用
  `QDesktopServices.openUrl` 打开，不再把窗口导航走。本机地址（`127.0.0.1` / `localhost` / `::1`）不受影响。
  - 关掉：`AxonGUI(..., options={"open_links_externally": False})`
  - 额外允许某些域名在窗口内打开：`options={"external_allow_hosts": ["my.backend"]}`
  - 顺带支持 `mailto:` / `tel:`。

## [5.4.0] - 2026-11-25

### 变更（破坏性）

- **仓库拆分**：说明书站和项目模板从本仓搬走，框架仓只剩「通道 + 语法糖 + CLI」。
  - 说明书 → [AxonGUI/axongui.github.io](https://github.com/AxonGUI/axongui.github.io)（<https://axongui.github.io/>），
    消费 npm 上的 `axon-gui`，不再吃本仓源码。
  - 模板 → [AxonGUI/templates](https://github.com/AxonGUI/templates)，一套框架一个目录。
  - 本仓的 `docs/`、`template/` 已删除；`https://axongui.github.io/Axon/*` 老地址自动跳到新站。

### 新增

- **`axon-gui init --template`**：Vue 3 / React 19 / Angular 20 三套模板，`--list` 列出全部；
  `--shell` 改成 overlay（覆盖 `main.py` 与 `web/index.html`），不再是字符串替换，加模板不用改核心。
- CLI 从 templates 仓下载模板（可用 `AXON_TEMPLATES_DIR` 指向本地副本），
  仍然把 `vendor/axon-py` + `vendor/axon-core` 一起 vendor 进项目，生成的项目不依赖本仓。

### 修复

- **npm 包的类型文件**：`vite-plugin-dts` 的 `rollupTypes` 会把未从入口导出的内部类型塞进
  `declare module "./AxonChannel"`，导致发布出去的 `dist/index.d.ts` 里 `IAxonChannels` /
  `AxonJSCallHandler` / `AxonPYCall` 无法解析（消费方 `skipLibCheck: false` 直接报错）。
  改成按源码结构出多份 `.d.ts`（npm `1.1.1`）。
- **自定义事件名的类型**：`AxonEvent.addListener("my:event", fn)` 以前会报 `not assignable to keyof AxonEventMap`，
  现在内置事件仍按 map 推导，自定义事件走 `(...args) => any`（npm `1.1.2`）。

## [5.3.6] - 2026-11-25

### 新增

- **跨窗口交互（`AxonCross`）**：一个应用开多个窗口时，窗口之间可以互相调用、广播、发事件。
  - JS：`AxonCross.windows()` / `has(web)` / `web(name)`（`AxonCross.web("charts").Charts.reload()`）/
    `call({web, controller, func, args, kwargs, timeout})` / `broadcast({...})` / `emit(type, ...args)` / `emitTo(web, type, ...args)`。
  - Python：`AxonCross.windows()` / `has()` / `call()` / `broadcast()` / `results()` / `emit()` / `emit_to()`。
  - 所有跨窗口调用经 Python 中转（只有 Python 知道哪些窗口活着）；广播按窗口隔离错误，
    返回 `{web, ok, value?/error?}`；`A → B → A` 这种回头调不会互相卡死。
- `AxonPYCall.call/broadcast` 支持 `timeout`（毫秒），到期抛 `TimeoutError` 而不是一直挂着。

### 修复

- 窗口关闭后会从 `AxonGUI.instance_dict` 摘掉（之前只增不减，跨窗口调用会打到已经不存在的页面；
  现在对关闭的窗口调用会立刻报 `web 'x' not found`），重新 `show()` 会重新登记。
- 跨窗口写共享 Store 现在能真正同步到其它窗口：JS 侧 `store.set()` 改走 Python 的 `set`（由它推给所有窗口），
  原来只更新本窗口缓存，别的窗口读不到。

### 文档

- 新增「跨窗口交互」页（`/examples/multi-window`、`/en/examples/multi-window`），并补 `AxonCross` 两端 API。

## [Unreleased]

## [5.4.6] - 2026-11-25

### 修复

- `axon-gui init --shell` 在入口 HTML 不在 `web/index.html` 的模板上失效（Angular 是 `web/src/index.html`）：
  入口位置改由 `template.json` 的 `web.index` 声明，CLI 按它写入。三套模板的 `--shell` 都已验证。


### 文档

- 侧边栏重排：新增「示例工程」一组放在最后，收录[本说明书](/projects/docs-site)与「双模式」两页；
  「双模式」从「开始」移出（它只是一个用 `AxonInit()` 状态写的 `if`，不是框架能力）。
- 「跨窗口交互」移入「可交互示例」，并把示例里的控制器名（`Series`）与窗口名（`charts`）刻意区分开。
- 「事件」页按方向拆开：**JS 发 → Python 收** 与 **Python 发 → JS 收** 各自成节，不再混写。
- 表格首列给最小宽度，避免被长代码列挤成一字一行。

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
