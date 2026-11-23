## 改了什么

<!-- 一句话说清这个 PR 解决什么 -->

## 验证

- [ ] `core-py/.venv/bin/python core-py/tests/run_web_tests.py` 全绿
- [ ] `docs/.venv/bin/python docs/verify_docs.py` 全绿（改了文档站或库的行为时）
- [ ] `docs/verify_offline.py` 全绿（同上）
- [ ] 改了 `core-js/lib/**` 时，`cd core-js && npm run build` 且 `dist/build-info.json` 一并提交

## 注意

- 改了对外接口（函数签名、事件名、Store 语义）时，文档站与 `CHANGELOG.md` 一起改。
- 打包相关改动（`docs/build_client.py`、`docs/main.py`）要在真实桌面上跑一次，别只看 CI 的 offscreen smoke。
