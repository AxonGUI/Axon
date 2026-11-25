/* 跨窗口测试页：两个窗口都加载这一页，window.__web 由 Python 侧注入。 */
(() => {
  const {
    Axon,
    AxonInit,
    AxonCross,
    AxonController,
    AxonEvent,
    AxonStore,
    AxonChannels,
  } = window.AxonLib;

  window.__out = {};
  window.__events = [];
  window.__web =
    new URLSearchParams(window.location.search).get("web") ||
    window.__web ||
    "anon";

  /** Python 侧用这个发起一次「异步表达式」，结果写进 window.__out[id]。 */
  window.__assert = (id, thunk) => {
    Promise.resolve()
      .then(thunk)
      .then(
        (value) => {
          window.__out[id] = { ok: true, value };
        },
        (err) => {
          window.__out[id] = { ok: false, error: String((err && err.message) || err) };
        },
      );
  };

  const log = (text) => {
    const el = document.getElementById("log");
    if (el) el.textContent = text;
  };

  AxonController.register("Node", {
    /** 这两个窗口加载的是同一页，窗口名由 Python 注入 */
    who() {
      return window.__web;
    },
    echo(...args) {
      return JSON.stringify(args);
    },
    boom() {
      throw new Error("node-boom");
    },
    async slow(ms) {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    },
    /** 再调回另一个窗口：A → B → A，用来验证不会互相卡死 */
    chain(web) {
      return AxonCross.web(web).Node.who();
    },
    /** 广播一次，看每个窗口各自返回什么 */
    fanout() {
      return AxonCross.broadcast({ controller: "Node", func: "who" });
    },
    note(x) {
      window.__events.push(x);
      return x;
    },
  });

  AxonEvent.addListener("cross:ping", (payload) => {
    window.__events.push(payload);
    log(`收到 cross:ping: ${JSON.stringify(payload)}`);
  });
  AxonEvent.addListener("cross:from-py", (payload) => {
    window.__events.push(`py:${payload}`);
  });

  AxonInit().then(
    (status) => {
      window.__multi = {
        connected: status.connected,
        ready: status.ready,
        web: (AxonChannels.AxonEnv && AxonChannels.AxonEnv.web_name) || window.__web,
      };
      window.__ready = true;
      log(`connected=${status.connected} web=${window.__multi.web}`);
    },
    (err) => {
      window.__multi = { connected: false, ready: false, error: String(err) };
      window.__ready = true;
      log(`init failed: ${err}`);
    },
  );

  // 供测试里直接用（页面里 AxonCross 是闭包变量，测试代码要通过 window 拿）
  window.__AxonStore = AxonStore;
  window.AxonCross = AxonCross;
  window.AxonEvent = AxonEvent;
  window.Axon = Axon;
})();
