# Contributing

This project turns "backend in Python, interface on the web" into two APIs with the same
names, so verifying a change is not "it runs" — **both sides have to run over the real
channel**.

<p align="center"><a href="CONTRIBUTING.md">简体中文</a> · <b>English</b></p>

## Setup

```bash
git clone https://github.com/AxonGUI/Axon
cd Axon/core-py && uv sync            # Python 3.12 + PySide6
cd ../core-js && npm ci               # frontend runtime
cd ../docs/web && npm ci              # docs site (only when you touch the docs)
```

On Linux, a missing `libxkbfile1` makes `import axon` fail outright:

```bash
sudo apt-get install -y libxkbfile1
```

## Three verification commands (run all of them before committing)

```bash
core-py/.venv/bin/python core-py/tests/run_web_tests.py   # interface assertions on a real QWebEngine
docs/.venv/bin/python docs/verify_docs.py                  # 22 clickable examples on the docs site
docs/verify_offline.py                                     # docs-only mode (no Python backend)
```

If you changed `core-js/lib/**`, also run:

```bash
cd core-js && npm run build    # the build output is committed; dist/build-info.json follows it
```

`dist/build-info.json` is a source fingerprint (sha256 over `lib/**/*.ts`); CI only checks that
file — do not edit it by hand.

## What lives where

| Path | What is in it | Run after changing it |
| --- | --- | --- |
| `core-py/axon/` | Python runtime: window, channels, controllers, store, events | the interface suite |
| `core-js/lib/` | JS runtime: proxy calls, events, store | the interface suite + `npm run build` |
| `docs/web/` | the docs site (VitePress); one build, two modes | `npm run docs:build` + both verifiers |
| `template/` | the template used by `axon-gui init` | generate a project and `npm run build` |
| `docs/` | the docs site's Python controller + client packaging | run the exe once on a real desktop |

## Style

- No third-party dependencies on the Python side (beyond PySide6); `uv sync` should be enough.
- Renaming or changing the semantics of a public API means changing, in the same PR: the matching
  docs page, `CHANGELOG.md` / `CHANGELOG.en.md`, and the verification assertions.
- Error messages should say *who was not found* and *what was expected* — the last error a user
  sees is usually the only hint they get.

## Commits and pull requests

`main` is protected: **every change goes through a Pull Request**, maintainers included (admins are
enforced too) — `git push origin main` is rejected. The flow:

```bash
git switch -c fix/something
# ...edit, run the three verification commands above...
git push -u origin fix/something
```

Then open the PR, wait for CI, paste the commands and pass counts into the description, and merge.

For changes that span directories, paste the verification results into the PR description
(command + number of passing cases).

## Release

1. Bump the version in `core-py/pyproject.toml`, and both wheel URLs in
   `docs/web/guide/quickstart.md` (plus the English page).
2. Update `CHANGELOG.md` and `CHANGELOG.en.md` (move `Unreleased` under the new version).
3. `git tag -a v<version> -m "Axon <version>"` and push the tag → `.github/workflows/release.yml`
   produces the Python package / npm package / Windows + Linux clients.
4. **PyPI**: configure a Trusted Publisher for this repository once
   (Publisher: GitHub → `AxonGUI/Axon` → workflow `publish-pypi.yml` → environment `pypi`), then
   uncomment the `release:` trigger at the top of that workflow. Until then `pip install axon-gui`
   does not work and the docs fall back to the wheel attached to a Release.
5. After publishing, check the Release assets and whether "unzip and double-click
   `AxonDocs/AxonDocs.exe`" still holds.
