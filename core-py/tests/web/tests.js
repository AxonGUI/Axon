/* Axon 接口验证套件 —— 在真实 QWebEngine + 真实 QWebChannel 里跑。
 * 结果写进 window.__results，window.__done 置 true 表示整轮跑完。 */
(function () {
  const { Axon, AxonInit, AxonStore, AxonEvent, AxonController } = AxonLib;
  const results = [];
  const out = document.getElementById("out");
  window.__results = results;
  window.__done = false;
  window.__errors = [];
  window.addEventListener("error", (e) => window.__errors.push("error: " + e.message));
  window.addEventListener("unhandledrejection", (e) =>
    window.__errors.push("rejection: " + String((e.reason && e.reason.message) || e.reason))
  );

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const initPromise = AxonInit();

  function record(name, ok, detail) {
    const item = { name, ok: !!ok, detail: detail === undefined ? "" : String(detail) };
    results.push(item);
    const cls = item.ok ? "ok" : "fail";
    out.innerHTML += `\n<span class="${cls}">${item.ok ? "PASS" : "FAIL"} ${name}</span>  ${item.detail}`;
  }

  function eq(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    record(name, ok, ok ? "" : `期望 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`);
    return ok;
  }

  async function expectReject(name, promiseFactory, snippet) {
    try {
      const value = await promiseFactory();
      record(name, false, `本应失败却成功: ${JSON.stringify(value)}`);
      return false;
    } catch (err) {
      const text = String(err && err.message !== undefined ? err.message : err);
      const ok = !snippet || text.includes(snippet);
      record(name, ok, ok ? "" : `错误信息里没有 "${snippet}": ${text.slice(0, 200)}`);
      return ok;
    }
  }

  /* ---------- 暴露给 Python 侧调用的 JS 控制器 ---------- */
  const bridge = {
    calls: [],
    value: 7,
    label: "bridge",
    echo(...args) {
      this.calls.push(args);
      return "js-echo:" + JSON.stringify(args);
    },
    async asyncEcho(...args) {
      return "js-async:" + JSON.stringify(args);
    },
    add(a, b) {
      return a + b;
    },
    boom() {
      throw new Error("js-boom");
    },
  };
  AxonController.register("JSBridge", bridge);
  window.__bridge = bridge;
  window.__AxonStore = AxonStore;

  /* ---------- 事件监听 ---------- */
  const events = { ping: [], loadFinished: 0 };
  window.__events = events;
  AxonEvent.addListener("ping", (msg) => events.ping.push(msg));
  AxonEvent.addListener("loadFinished", () => (events.loadFinished += 1));

  let store = null;

  window.__runTests = async function runTests() {
    /* 0. 初始化 —— 双模式状态 */
    const status = await AxonInit();
    record(
      "init/connected",
      status && status.connected && status.ready,
      JSON.stringify(status)
    );
    if (!status || !status.ready) {
      window.__done = true;
      return results;
    }

    /* 1. JS → PY 普通调用（打包写法） */
    eq("js2py/call", await Axon.TestController.add(1, 2), 3);
    /* 1b. 摊开写法: fn(a, b) 等价于 fn([a, b]) */
    eq("js2py/call_spread", await Axon.TestController.add(1, 2), 3);
    /* 1c. 摊开写法 + 超时: 末位数组仍是 args, kwargs/timeout 用打包写法 */
    eq(
      "js2py/call_spread_kwargs",
      await Axon.TestController.with_kwargs([1], { b: 2 }),
      3
    );
    /* 2. JS → PY 带 kwargs */
    eq("js2py/kwargs", await Axon.TestController.with_kwargs([1], { b: 2 }), 3);
    /* 3. JS → PY 调用 async 方法 */
    eq("js2py/async", await Axon.TestController.async_echo("hi"), "hi:async");
    /* 4. 超时（后台页面里的定时器会被 Chromium 节流, 所以给足 3x 余量） */
    await expectReject(
      "js2py/timeout",
      () => Axon.TestController.sleep([3000], {}, 200),
      "Timeout Error"
    );
    /* 5. Python 抛异常 → JS 收到 reject */
    await expectReject("js2py/error", () => Axon.TestController.boom(), "ValueError");

    /* 6. 读 Python 属性（走 thenable） */
    eq("js2py/getVar", await Axon.TestController.counter, 0);
    /* 7. 写 Python 属性 */
    Axon.TestController.counter = 42;
    await sleep(120);
    eq("js2py/setVar", await Axon.TestController.get_counter(), 42);

    /* 8. PY → JS 调用 */
    eq(
      "py2js/call",
      await Axon.TestController.call_js_echo("x"),
      'js-echo:["x"]'
    );
    /* 9. PY → JS async 调用（Python 侧 await 它） */
    eq(
      "py2js/async_call",
      await Axon.TestController.call_js_async("y"),
      'js-async:["y"]'
    );
    /* 10. PY → JS 读属性 */
    eq("py2js/getVar", await Axon.TestController.read_js_value(), 7);
    /* 11. PY → JS 写属性 */
    await Axon.TestController.write_js_value(99);
    await sleep(120);
    eq("py2js/setVar", bridge.value, 99);
    /* 12. PY → JS 异常回传 */
    await expectReject(
      "py2js/error",
      () => Axon.TestController.call_js_boom(),
      "js-boom"
    );
    /* 13. PY → JS kwargs 约定（非空 kwargs 作为最后一个对象参数） */
    eq(
      "py2js/kwargs",
      await Axon.TestController.call_js_kwargs(1, 2),
      'js-echo:[1,{"b":2}]'
    );

    /* 14. Store: JS 写 → PY 读 */
    store = AxonStore.AxonStoreMap.get("teststore") || new AxonStore("teststore");
    store.prop("k", "").set("from-js");
    await sleep(120);
    eq("store/js2py", await Axon.TestController.store_read("k"), "from-js");
    /* 15. Store: PY 写 → JS 读 */
    await Axon.TestController.store_write("k2", "from-py");
    await sleep(120);
    eq("store/py2js", store.prop("k2").get(), "from-py");
    /* 15b. Store 便捷方法: set/get 等价于 prop().set()/get() */
    store.set("k4", "via-set");
    await sleep(120);
    eq("store/js2py_shortcut", await Axon.TestController.store_read("k4"), "via-set");
    eq("store/js2py_get", store.get("k").get(), "from-js");

    /* 16. 事件: PY → JS */
    await Axon.TestController.dispatch_ping("hello");
    await sleep(120);
    eq("event/py2js", events.ping, ["hello"]);
    /* 17. 事件: JS → PY */
    try {
      await AxonEvent.dispatchPYEvent({ type: "pong", args: [1, 2] });
    } catch (err) {
      record("event/js2py_dispatch_error", false, String((err && err.message) || err));
    }
    await sleep(150);
    eq("event/js2py", await Axon.TestController.get_pong_log(), [[1, 2]]);
    /* 18. 已经发过 loadFinished */
    record("event/loadFinished", events.loadFinished >= 1, `count=${events.loadFinished}`);
    for (const message of window.__errors) record("js/error", false, message);

    window.__done = true;
    return results;
  };

  window.addEventListener("load", () => {
    window.__runTests().catch((err) => {
      record("fatal", false, String(err && err.stack ? err.stack : err));
      window.__done = true;
    });
  });
})();
