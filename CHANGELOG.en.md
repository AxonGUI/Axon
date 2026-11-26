# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions use
`MAJOR.MINOR.PATCH`. Python package `axon-gui` (module `axon`), npm package `axon-gui`.

<p align="center"><a href="CHANGELOG.md">简体中文</a> · <b>English</b></p>

## [5.7.1] - 2026-11-26

### Added

- **`AxonInit()` now returns `mode: "app" | "web"`**: the dual-mode check collapses from
  `status.ready ? "backend available" : "plain web page"` to a single `if (status.mode === "web")`.
  It is sugar for `ready ? "app" : "web"` — look at `connected` / `reason` when you need the in-between
  state ("channel up, objects not all there").
- **`axon-gui types --ts-out`**: the proper name for the TypeScript output flag, symmetric with
  `--py-out`; `--out` / `-o` remain aliases (all three produce identical files).

## [5.7.0] - 2026-11-26

### Changed (breaking — aligns both sides)

- **Errors are Error subclasses**: JS gains `AxonError` / `AxonTimeoutError` / `AxonNotConnectedError` /
  `AxonRemoteError` (each with a stable `code`), and `catch (e)` always receives an `Error` (a few paths used to
  `reject("string")`, where `e.message` was undefined). Python gains `AxonError` / `AxonTimeoutError` /
  `AxonNotConnectedError`; `JSRuntimeError` now extends `AxonError`, and `AxonTimeoutError` also extends the builtin
  `TimeoutError` so existing `except TimeoutError` keeps working.
- **`store.get(name)` means the same on both sides**: JS returned the property object while Python returned the value;
  now both return the **value**. Use `store.prop(name)` when you need the property object (e.g. to write back).
  `await store.get(name)` still works.
- **One way to list windows**: `AxonGUI.get_web_names()` removed in favour of `AxonGUI.windows()`
  (`AxonCross.windows()` returns the same).
- **`AxonAsset` keeps only class methods**: the module-level `asset_url()` / `asset_url_from_file()` are gone; use
  `AxonAsset.from_bytes()` / `AxonAsset.from_file()`.

## [5.6.2] - 2026-11-26

### Changed

- Replaced `--skip-ts` / `--skip-py` with a positive selector **`--only ts|py|both`** (default `both`). Negative flags
  do not scale: every new artifact needs another `--skip-*`, while `--only` stays linear and reads as intent
  ("I only want TS" instead of "I do not want Python").
- `--skip-ts` / `--skip-py` are gone (5.6.x shipped minutes ago, no known users). Equivalents: `--skip-py` →
  `--only ts`, `--skip-ts` → `--only py`.

## [5.6.1] - 2026-11-26

### Fixed

- `axon-gui types --skip-ts/--skip-py` were rejected by the top-level argparse (`unrecognized arguments`). The
  `types` arguments now go straight to the generator's own parser instead of being declared twice (the stale duplicate
  declaration is gone).
- The wheel did not contain `axon/typecodegen/extract_js.mjs`, so `--js` failed with `Cannot find module` for installed
  packages. `package-data` now includes `typecodegen/*.mjs`.

## [5.6.0] - 2026-11-26

### Changed

- `axon-gui types` now generates **both directions by default**: `web/src/axon.generated.ts`
  (Python controllers → TS) and `controller/js_controllers.py` (frontend controllers → Python). Previously the second
  file only appeared with `--js`, which made it look like one-way generation.
- New `--skip-ts` / `--skip-py` to generate a single side; `--out` / `--py-out` still set the paths.
- When run from a frontend directory such as `web/`, the project root (the parent that has `controller/`) is used as
  the base, so templates no longer pass `--controllers ../controller --out src/...`.
- The frontend source location is auto-detected (`web/src` → `src` → `web` → `app`); when nothing is found the Python
  stub is emitted empty with a note on stderr instead of failing silently.

### Fixed

- The project root is added to `sys.path` before generating the Python stub, otherwise `controller` cannot be
  imported when running from `web/`.

## [5.5.2] - 2026-11-26

### Fixed

- `--controllers` also accepts a **file path** (`./controller/app.py`); a missing path now raises a clear error
  instead of `TypeError: the 'package' argument is required`.
- Without `typescript` installed, the regex fallback treated `AxonController.register(` itself as a member, so the
  generated stub gained a bogus `register("DocsJS", {...}, mirror, payload)` method. It now scans the object literal
  with brace/paren awareness and only reports real members (including properties and `async` methods).
- Default Python stub output moved from `controller/js_controllers.pyi` to
  **`controller/js_controllers.py`**: the file contains a runnable `connect()`, and a `.pyi` is never imported, so
  `from controller.js_controllers import connect` used to raise ImportError.

## [5.5.1] - 2026-11-26

### Fixed

- `axon-gui types --controllers` now accepts a **path** (`--controllers ../controller`). Before it took a module name
  and had to run from a directory that could import it; templates and the Vite plugin both run inside `web/`, so
  `types:check` failed.
- Generated files no longer embed a "source" line (it recorded a relative path, which changed with the working
  directory), so the same file passes `--check` from the repo root, from `web/` and in CI.

## [5.5.0] - 2026-11-26

### Added

- **Generated types on both sides** (`axon-gui types`):
  - **Python controllers → TypeScript**: reflects classes registered with `@AxonController` (annotations resolved via
    `typing.get_type_hints`; supports primitives, containers, `Optional`, `Literal`, `TypedDict`, dataclasses,
    pydantic models and `Enum`) and emits `AxonRegistry` plus
    `declare module "axon-gui" { interface AxonControllers … }`. In VS Code, `Axon.Greeter.greet(` completes names
    and types while you write the frontend.
  - **Frontend controllers → Python**: uses the TypeScript compiler API to read
    `AxonController.register("DocsJS", { … })` (object literals, factory functions and class instances) and emits
    `Protocol`s plus a `connect(web_name)` entry point, so `api.DocsJS.mirror(` completes in Python. Without
    `typescript` installed it degrades to a regex pass (names only).
  - `axon-gui/vite-plugin`: regenerates on `vite dev` start and on save (~150 ms); `vite build` skips it so the build
    never depends on a Python environment.
  - `--check` compares instead of writing, for drift checks in CI.
- `AxonControllers` is a public typing seam: with no generated file, `Axon` stays `any` — same behaviour as before.

### Notes

- The generator ships **in the same repo** as the framework: it depends on both sides' type contracts (the TS module
  augmentation point and the Python registry semantics). Splitting it out would create a generator/framework/client
  version matrix whose failure mode is "autocomplete looks wrong", which is worse than having none.
- All three official templates (Vue / React / Angular) ship `npm run types` and `types:check`; the Vue and React
  templates also wire the Vite plugin for automatic regeneration.

## [5.4.7] - 2026-11-26

### Improved

- **Type quality**: the whole package is now `mypy --strict` clean (was 164 errors), and ships
  `py.typed` (PEP 561) — your own mypy/pyright run actually checks our annotations.
- Return types filled in across the public API: `AxonFuture[T]`, `AxonCall.*`, `AxonCross.*`,
  `AxonStore.*`, `AxonEvent.*`; `AxonPYCall.cancel()` is now a real `AxonFuture.cancel()`
  (no more monkey-patched method on a `Future` instance).
- Split `AxonController.get_attr()` out: reading an attribute (which may not be callable) is separate
  from getting a callable; `get_prop()` now raises a clear error when the attribute is not a function.

### Fixed

- **`AxonGUI.showEvent` was defined twice** (first registering the window, then dispatching the `show`
  event), so the second definition silently replaced the first — a window that was closed and shown again
  never got re-registered in `AxonGUI.instance_dict`, and cross-window calls reported "web not found".
  Both actions now happen in one override.
- `acceptNavigationRequest` accepts `QUrl | str`; `createWindow`'s return type matches the Qt 6 signature.

## [5.4.5] - 2026-11-25

### Changed (breaking)

- `AxonAsset.register()` → **`AxonAsset.from_bytes()`**, `AxonAsset.register_file()` → **`AxonAsset.from_file()`**;
  the module-level aliases are now `asset_url()` / `asset_url_from_file()`. The old names are gone
  (only 5.4.4 ever used them) — `register` collided with "register an object on a window"
  (`AxonController.register`) and described the mechanism rather than the purpose.

### Improved

- **Automatic asset lifetime**: bytes from `from_bytes()` need no manual housekeeping — assets idle for
  10 minutes are dropped, and past 256 MB of bytes the least-recently-used are evicted
  (`AxonAsset.configure(ttl=..., budget=...)` or `AXON_ASSET_TTL` / `AXON_ASSET_BUDGET_MB`);
  `release()` stays for "free it right now". File-backed assets don't count toward the budget.
- `from_file()` no longer reads the file into memory: the scheme handler opens it with `QFile` per
  request and streams it to Chromium, so multi-hundred-MB videos or installers are fine
  (the URL returns 404 once the file is moved or deleted).

## [5.4.4] - 2026-11-25

### Added

- **Binary / large files over an `axon://` URL**: `AxonAsset.register(bytes, name=...)` and
  `AxonAsset.register_file(path)` turn bytes into `axon://asset/<token>/<filename>`, which you can
  hand straight to `<img src>`, `<video src>`, `fetch()` or `<a download>` — the payload never goes
  through QWebChannel and is never base64-encoded. Measured: 1 MB in 3 ms, 2 MB in 83 ms.
  - The scheme is registered as `SecureScheme | CorsEnabled | LocalAccessAllowed | FetchApiAllowed`
    and replies with `Access-Control-Allow-Origin: *`, so `fetch()` works from a local page.
  - Lifetime: `AxonAsset.release(url)` / `clear()` / `count()`; unreleased assets live until exit.
  - Limitation: `QWebEngineUrlRequestJob` exposes no request headers, so **no Range support**
    (video seeking and resumable downloads are unavailable).

## [5.4.3] - 2026-11-25

### Added

- **Automatic compression for large strings**: strings ≥256KB are gzip+base64 encoded on the wire
  (only when it actually shrinks). At 16MB this takes a transfer from 1.25–1.68s down to ~0.42–0.46s.
  No API change; enabled only when both sides advertise support (old peers keep the plain string).

## [5.4.2] - 2026-11-25

### Performance

- Request coalescing: calls made in the same JS tick go out as one message.
- Reply batching: worker results are flushed once per event-loop turn.
- No API change: every call still settles on its own; timeouts and errors behave the same. Numbers in `core-py/benchmarks/README.md`.

## [5.4.1] - 2026-11-25

### Added

- **External links go to the system browser**: `AxonGUI` now intercepts http(s) links (including
  `target="_blank"`) and opens them with `QDesktopServices.openUrl` instead of navigating the app away.
  Loopback hosts (`127.0.0.1` / `localhost` / `::1`) are unaffected.
  - Disable: `AxonGUI(..., options={"open_links_externally": False})`
  - Keep extra hosts in-app: `options={"external_allow_hosts": ["my.backend"]}`
  - `mailto:` / `tel:` are handled too.

## [5.4.0] - 2026-11-25

### Changed (breaking)

- **Repo split**: the docs site and the project templates moved out. This repo is now just the runtime + CLI.
  - Docs → [AxonGUI/axongui.github.io](https://github.com/AxonGUI/axongui.github.io) (<https://axongui.github.io/>), consuming `axon-gui` from npm.
  - Templates → [AxonGUI/templates](https://github.com/AxonGUI/templates), one directory per framework.
  - `docs/` and `template/` are gone; old `https://axongui.github.io/Axon/*` links redirect.

### Added

- **`axon-gui init --template`** with Vue 3 / React 19 / Angular 20, plus `--list`. `--shell` is now an overlay
  (copies `main.py` and `web/index.html`) instead of string surgery, so adding templates needs no core changes.

### Fixed

- **npm typings**: `vite-plugin-dts` `rollupTypes` put internal types into `declare module "./AxonChannel"`,
  so `IAxonChannels` / `AxonJSCallHandler` / `AxonPYCall` were unresolvable for consumers with
  `skipLibCheck: false`. Now emits one `.d.ts` per source file (npm `1.1.1`).
- **Custom event names**: `AxonEvent.addListener("my:event", fn)` used to fail with
  `not assignable to keyof AxonEventMap`; built-ins keep their mapped types, custom names fall back to `(...args) => any` (npm `1.1.2`).

## [5.3.6] - 2026-11-25

### Added

- **Cross-window interaction (`AxonCross`)**: with several windows open, they can call each
  other, broadcast, and emit events.
  - JS: `AxonCross.windows()` / `has(web)` / `web(name)` /
    `call({web, controller, func, args, kwargs, timeout})` / `broadcast({...})` /
    `emit(type, ...args)` / `emitTo(web, type, ...args)`.
  - Python: `AxonCross.windows()` / `has()` / `call()` / `broadcast()` / `results()` /
    `emit()` / `emit_to()`.
  - Every cross-window call is routed through Python (the only side that knows which windows
    are alive); broadcast isolates errors per window and returns `{web, ok, value?/error?}`;
    `A → B → A` round-trips do not deadlock.
- `AxonPYCall.call/broadcast` accept `timeout` (milliseconds) and raise `TimeoutError`
  instead of hanging.

### Fixed

- Closed windows are removed from `AxonGUI.instance_dict` (previously the dict only grew, so
  cross-window calls could hit a dead page); calling a closed window now fails fast with
  `web 'x' not found`, and `show()` re-registers it.
- Writing to a shared Store from JS now reaches the other windows: `store.set()` goes through
  Python's `set` (which fans out), instead of only updating the local cache.

### Docs

- New "Cross-window interaction" page (`/examples/multi-window`, `/en/examples/multi-window`) plus
  `AxonCross` on both API pages.

## [Unreleased]

## [5.4.6] - 2026-11-25

### Fixed

- `axon-gui init --shell` did not work for templates whose entry HTML is not `web/index.html` (Angular uses
  `web/src/index.html`). The entry path is now declared by `web.index` in `template.json`. All three templates verified.


### Docs

- Sidebar reshuffle: a new "Example projects" group at the end holds [this docs site](/en/projects/docs-site)
  and "Dual mode"; dual mode moved out of "Getting started" (it is an `if` you write on `AxonInit()`'s
  status, not a framework capability).
- "Cross-window interaction" moved into "Live examples"; the example now deliberately uses different
  names for the controller (`Series`) and the window (`charts`).
- "Events" is split by direction: **JS fires → Python listens** and **Python fires → JS listens**,
  never mixed in one block.
- Table first columns get a minimum width so long code columns cannot squeeze them one character per line.

### Changed

- **axon-shell 0.2.0 keeps only the native layer**: the title bar, menu bar, window-button styling and themes are gone, and the package no longer ships `shell.css`. It provides a frameless window, drag-region hit testing, window control, window-state events and a native menu bridge. The two "draw your own title bar" docs pages were rewritten to match.
- Window chrome moved to its own repository, [AxonGUI/AxonShell](https://github.com/AxonGUI/AxonShell): `AxonWindow` and `examples/shell` are no longer part of the core repo.
- JS call sites: `fn([args], kwargs, timeout)` is only treated as the packed form when the first argument is an array **and** more arguments follow; `fn([{...}])` now means "pass one array argument".

### Added

- **Bilingual documentation**: the docs site now uses VitePress `locales` (Simplified Chinese at
  the root, English under `/en/`) with a switcher in the top-right corner. Both languages share one
  component set and one build; example ids match one to one. A new `theme/i18n.ts` provides the
  zh/en strings for buttons, the status bar and message-flow titles.

### Changed

- `docs/verify_docs.py` now drives two English example pages as well (22 examples), and
  `docs/verify_offline.py` checks one page per language by default (12 assertions).

## [5.3.5] - 2026-11-25

### Added

- `axon-gui init <name> --shell`: generate the frameless variant directly — installs `axon-shell`,
  swaps `main.py` to `AxonShellWindow`, and ships a `data-axon-drag` title bar with `min`/`max`/`close`
  buttons. The default template is unchanged (native OS title bar).
- The template's static server also exposes `/axon-shell/shell.js` from an installed `axon-shell`
  package, so a page can always `<script src="/axon-shell/shell.js">`.

## [5.3.4] - 2026-11-23

### Fixed

- **A packaged windowed client showed a blank page**: with `sys.stderr` set to `None`, the static
  server's `log_message()` raised `AttributeError` on every request, so every connection was
  dropped (`ERR_EMPTY_RESPONSE`). Logging now guards for the missing stream and a failing request
  returns 500 instead of dropping the connection. CI's offscreen smoke test had hidden this class
  of bug — packaging changes must be run on a real desktop from now on.
- **The client window was enormous / off-screen**: it is now clamped to 94% of
  `availableGeometry()` and centred, instead of a hard-coded `1280×840`.
- **Slow first start**: the client now defaults to `--onedir` and no longer unpacks 200+ MB on
  every launch.

### Changed

- The client artifact is now a directory (`AxonDocs/AxonDocs.exe`); the Release zips the whole
  directory.
- `axon-gui init` fetches the template from the tag **matching the installed package version** and
  only falls back to `main` when that tag is missing, so the CLI and the template cannot drift
  apart.

## [5.3.3] - 2026-11-23

### Added

- One project icon: master `assets/axon-mark.svg` (the A plus the channel in the middle).
  `tools/make_icons.py` generates the 16–256 PNGs, `axon.ico` and the 512 avatar in one run, and
  keeps the docs favicon, template logo and window icon in sync.

## [5.3.2] - 2026-11-23

### Fixed

- **A project generated by `axon-gui init` after `pip install` always failed `npm install`**
  (`TS2307`): the old implementation only vendored `core-js` and `core-py/axon` when running
  *inside* the repository. Both paths now behave the same, and a missing `dist/` falls back to the
  prebuilt artifact of the same version from npm.
- The generated project's `[tool.uv.sources]` key was still `axon`; it is now `axon-gui`.

### Changed

- `core-js/dist` is committed; a `dist/build-info.json` source fingerprint is committed next to it
  and CI only verifies that file (the member order of `index.d.ts` is not stable across
  environments, so a byte comparison would always fail).

## [5.3.1] - 2026-11-23

### Added

- Two modes for the docs site: a plain manual when no Python backend is present, and clickable
  examples with both sides' payloads when it is opened inside `AxonGUI`.
- The GitHub Pages docs site, multi-platform Release clients (Windows / Linux), the Python package
  and the npm package.
- The `axon-gui init` scaffold and `tools/make_icons.py`.
