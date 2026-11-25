# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions use
`MAJOR.MINOR.PATCH`. Python package `axon-gui` (module `axon`), npm package `axon-gui`.

<p align="center"><a href="CHANGELOG.md">简体中文</a> · <b>English</b></p>

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
