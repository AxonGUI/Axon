# Security policy

This is a **local desktop framework**: the Python process ships a static file server that only
listens on `127.0.0.1`, and the web frontend calls the local Python objects over QWebChannel. It
does not serve the outside world, but a few classes of risk are worth reporting.

<p align="center"><a href="SECURITY.md">简体中文</a> · <b>English</b></p>

## How to report

**Do not open a public issue.** Use GitHub's private channel:

<https://github.com/AxonGUI/Axon/security/advisories/new>

I reply within 7 days; reproducible reports get a fixed version and credit (if you want to be
named).

## In scope

- Arbitrary web content loaded through `AxonGUI(web_name, url)` reaching controllers it should not
  be able to reach
- Injection or prototype pollution in the `core-js` call channel that bypasses argument boundaries
- Path traversal in the local static server (`docs/server.py`, `start_server` in the template)
- Hijacked DLL / resource loading in the packaged client (`AxonDocs.exe`)
- Broken cross-window isolation of events or the store (window A reading window B's store)

## Out of scope

- Attacks that already require code execution on the machine (same-privilege local processes
  interacting with each other)
- The risk of pointing `AxonGUI` at an untrusted remote site, and any data leak that follows
- Known vulnerabilities in dependencies — please report those upstream (PySide6 / VitePress / Vue)

## Hardening advice for users

- Only load pages you control; do not open third-party sites with `AxonGUI(..., "https://...")`.
- Enable `QTWEBENGINE_REMOTE_DEBUGGING` only when needed, and bind it to `127.0.0.1`.
- Do not relax the default security settings of the released client (the Chromium sandbox and the
  rest).
