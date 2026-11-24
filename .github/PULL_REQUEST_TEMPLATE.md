## 改了什么 / What changed

<!-- 一句话说清这个 PR 解决什么 / One sentence on what this PR solves -->

## 验证 / Verification

- [ ] `core-py/.venv/bin/python core-py/tests/run_web_tests.py` 全绿 / all green
- [ ] `docs/.venv/bin/python docs/verify_docs.py` 全绿（改了文档站或库的行为时 / when docs or runtime behaviour changed）
- [ ] `docs/verify_offline.py` 全绿（同上 / same as above）
- [ ] 改了 `core-js/lib/**` 时，`cd core-js && npm run build` 且 `dist/build-info.json` 一并提交 /
      when `core-js/lib/**` changed, ran `npm run build` and committed `dist/build-info.json`

## 注意 / Notes

- 改了对外接口（函数签名、事件名、Store 语义）时，文档站与 `CHANGELOG.md` / `CHANGELOG.en.md` 一起改。/
  Renaming or changing public API semantics means updating the matching docs page and both changelogs.
- 打包相关改动（`docs/build_client.py`、`docs/main.py`）要在真实桌面上跑一次，别只看 CI 的 offscreen smoke。/
  Packaging changes (`docs/build_client.py`, `docs/main.py`) must be run once on a real desktop —
  do not rely on CI's offscreen smoke alone.
