# Axon frontend (Vue 3 + Vite)

The web half of an Axon project. Call Python with `await Axon.<Controller>.<method>(...)`
see `src/components/JSCallPY.vue`, and the window is opened by `main.py` in the project root.

```bash
npm install
npm run build      # -> dist/, served by main.py
npm run dev        # http://127.0.0.1:5173/, use WEB_ENV=dev when starting main.py
```

`AxonInit()` returns a status object, so the same page also works as a plain static site when no
Python backend is present.

## 中文

Axon 项目的前端部分（Vue 3 + Vite）。调 Python 就用 `await Axon.<控制器>.<方法>(...)`，
示例见 `src/components/JSCallPY.vue`；窗口由项目根目录的 `main.py` 打开。

```bash
npm install
npm run build      # -> dist/，由 main.py 提供服务
npm run dev        # http://127.0.0.1:5173/，启动 main.py 时加 WEB_ENV=dev
```

没有 Python 后端时 `AxonInit()` 会返回状态对象，页面照常当静态站用。
