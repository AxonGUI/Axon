<p align="center">
  <img src="assets/axon-mark.svg" alt="Axon" width="88" height="88" />
</p>

<p align="center"><a href="README.md">简体中文</a> · <b>English</b></p>

# Axon (package name `axon-gui`)

[![PyPI](https://img.shields.io/badge/PyPI-axon--gui%205.3.4-3451b2)](https://pypi.org/project/axon-gui/)
[![npm](https://img.shields.io/badge/npm-axon--gui%201.0.0-cb3837)](https://www.npmjs.com/package/axon-gui)
[![docs](https://img.shields.io/badge/docs-GitHub%20Pages-3451b2)](https://axongui.github.io/Axon/en/)
[![release](https://img.shields.io/badge/download-Windows%20%7C%20Linux-2ea44f)](https://github.com/AxonGUI/Axon/releases)

A hybrid desktop framework: write the backend in Python, the interface in HTML/CSS/JS.
Your frontend runs inside a `QWebEngineView`, Python objects are exposed both ways over
QWebChannel as syntactic sugar, and each side can call the other as if it were local.

```python
# Python: call the frontend
Axon("main").UserCard.render({"name": "Ada"})     # JS: UserCard.render(...)
await Axon("main").UserCard.theme                 # read a JS property

# Frontend: call Python
await Axon.Users.add("Ada", 36)                   # a method of @AxonController("main")
await Axon.Users.count                            # read a Python property
await Axon.Users.add(["Ada", 36])                 # packed form, for kwargs / timeout
```

- Runtime: PySide6 6.x (QtWebEngine) + any frontend framework (the template uses Vue 3 + Vite)
- Python: >= 3.12
- License: MIT

## Documentation (Chinese / English)

Hosted on GitHub Pages: Chinese **<https://axongui.github.io/Axon/>** · English **<https://axongui.github.io/Axon/en/>**
(use the globe icon in the top-right corner to switch; both languages share one component set and one build)

The same site has two modes — you do not need two sites:

- **open it in a normal browser** -> a plain manual, code only;
- **open it in AxonGUI** (`python docs/main.py`) -> the buttons really call Python and the
  message flow between the two sides is listed step by step.

## Download

Every [release](https://github.com/AxonGUI/Axon/releases) ships three kinds of artifacts:

| Artifact | What it is |
| --- | --- |
| `AxonDocs-windows-x64.zip` / `AxonDocs-linux-x64.tar.gz` | the docs desktop client: Python + PySide6 + the built site inside, unzip and run (Linux needs `libxkbfile1`) |
| `axon_gui-*.whl` / `axon_gui-*.tar.gz` | the Python package: `pip install axon_gui-*.whl` |
| `axon-gui-*.tgz` | the frontend package: `npm i ./axon-gui-*.tgz` |

Client self-check: `AxonDocs --smoke` (exit code 0 = channel connected and an example ran).

There is no macOS client in CI (this repository cannot get a macOS runner — jobs get cancelled
before they start). Build one on a Mac if you need it:

```bash
python3 -m venv .venv
.venv/bin/pip install -e core-py pyside6 pyinstaller
( cd docs/web && npm ci && npm run docs:build )
.venv/bin/python docs/build_client.py --name AxonDocs      # -> build/client/dist/AxonDocs/AxonDocs
```

## Related projects

| Repository | What it is |
| --- | --- |
| [AxonGUI/Axon](https://github.com/AxonGUI/Axon) | The framework itself: channels, controllers, events, store, docs site, client builds |
| [AxonGUI/AxonShell](https://github.com/AxonGUI/AxonShell) | Optional window chrome (`pip install axon-shell`): frameless window, drag/resize hit-testing, window controls, native menus |

The chrome lives in its own package because "what the window looks like" is not "how the channel works". Install `axon-shell` if you want the drawn title bar; skip it if you only want the bridge.

## Repository layout

| Path | Contents |
| --- | --- |
| `core-py/axon/` | Python runtime: `AxonGUI` (window), `Axon` (the call-JS sugar), `AxonController` (register Python controllers), `AxonStore`, `AxonEvent`, `AxonMagicGUI` |
| `core-js/lib/` | Frontend runtime: `AxonInit`, `Axon` (the Proxy that calls Python), `AxonController`, `AxonStore`, `AxonEvent` |
| `docs/` | the documentation site (VitePress, published to GitHub Pages) + live examples + client build + verification scripts |
| `template/` | the project template used by `axon-gui init` (Python entry + Vue 3 frontend) |
| `assets/` | icons: master `axon-mark.svg` (the A plus the channel in the middle), glyph-only `axon-mark-glyph.svg`, the traced legacy icon `axon-mark-legacy.svg`; `tools/make_icons.py` generates the PNGs / `axon.ico` / the org avatar from the master, so the site favicon, the exe icon, the window icon and the template logo all come from one file |
| `tools/make_icons.py` | change the icon by editing the master, then run this once |

## Quickstart

Two routes for users; both are spelled out in [Quickstart](https://axongui.github.io/Axon/en/guide/quickstart):

```bash
# Route 1: generate a project from the official template (recommended)
#   install the command first, globally available: uv tool / pipx / pip install --user
uv tool install axon-gui
axon-gui init myapp && cd myapp
uv sync && ( cd web/web-vue && npm install && npm run build && cd ../../.. )
python main.py

# Route 2: install the packages (one pip, one npm)
pip install axon-gui
npm install axon-gui
```

To hack on this repository itself, or rebuild the docs site:

```bash
sudo apt-get install -y libxkbfile1      # QtWebEngine needs it on Linux
cd core-py && uv sync && cd ..           # Python 3.12 + PySide6
cd core-js && npm ci && npm run build && cd ..   # frontend runtime -> dist/

cd docs/web && npm ci && npm run docs:build && cd ../.. && core-py/.venv/bin/python docs/main.py
cd docs/web && npm run docs:dev           # open it in a browser -> the docs-only mode of the same site
```

## Verification

This is not "written and never run": two layers of automation use the real dependencies, a real
window and the real channel.

```bash
core-py/.venv/bin/python core-py/tests/run_web_tests.py   # 37 interface assertions (real WebEngine)
core-py/.venv/bin/python docs/verify_docs.py              # 22 clickable examples on the docs site
core-py/.venv/bin/python docs/verify_offline.py           # the docs-only mode, with and without a backend
python docs/build_client.py && ./build/client/dist/AxonDocs/AxonDocs --smoke   # packaged client + self-check
```

Latest run: `37/37` interface assertions, `22/22` clickable examples (15 Chinese pages + 7 English
pages), `12/12` assertions in docs-only mode. The itemised list is in
[notes/verified](docs/web/en/notes/verified.md); the pitfalls found along the way are in
[notes/pitfalls](docs/web/en/notes/pitfalls.md).

## Status

A personal project, the API still moves: the core channels (calls / properties / events / store /
main thread) work end to end, Linux and Windows have regression scripts plus a packaging self-check,
`pip install axon-gui` resolves from PyPI (5.3.4) and `axon-gui@1.0.0` is on npm. Good as an architecture
reference or as source you read and adapt; not something to put into production as a dependency yet.

---

Contributing and security: [Contributing](CONTRIBUTING.en.md) · [Security](SECURITY.en.md) · [Changelog](CHANGELOG.en.md)
（中文：[参与开发](CONTRIBUTING.md) · [安全策略](SECURITY.md) · [变更记录](CHANGELOG.md)）
