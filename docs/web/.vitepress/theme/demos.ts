import { pushLog } from "./axon";

/** 一个可交互示例：一段要展示的源码 + 点击后实际执行的流程。 */
export interface Demo {
  title: string;
  summary: string;
  code: string;
  run: (lib: any) => Promise<string | void>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 把一次调用记进消息流：发出时记入参，回来时记结果/异常与耗时。
 * 这就是页面上「信息传递过程」的数据来源 —— 全部来自真实调用，不是文案模拟。
 */
async function trace<T>(
  title: string,
  payload: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  const started = performance.now();
  pushLog({ kind: "js2py", title, payload });
  try {
    const result = await fn();
    pushLog({
      kind: "js2py",
      title: "结果回到 JS",
      result,
      ms: Math.round(performance.now() - started),
    });
    return result;
  } catch (err: any) {
    pushLog({
      kind: "error",
      title: "调用失败：异常从 Python 传回 JS",
      detail: String(err?.message ?? err),
      ms: Math.round(performance.now() - started),
    });
    return undefined;
  }
}

export const demos: Record<string, Demo> = {
  call: {
    title: "调用 Python 方法",
    summary:
      "JS 里 Axon.DemoController.add(2, 3) 会生成唯一 call_id，经 QWebChannel 发给 Python，Python 在同步线程池里执行，再把结果按 call_id 回传。",
    code: `const result = await Axon.DemoController.add(2, 3);   // 摊开传参
// result === 5`,
    run: async (lib) => {
      const result = await trace(
        "Axon.DemoController.add(2, 3)",
        { controller_id: "DemoController", func: "add", args: [2, 3], kwargs: {}, type: "call" },
        () => lib.Axon.DemoController.add(2, 3),
      );
      return result === undefined ? "" : `Python 返回 ${JSON.stringify(result)}`;
    },
  },

  kwargs: {
    title: "带 kwargs 的调用",
    summary:
      "第三个参数是 kwargs 对象，Python 端作为关键字参数展开；第二个参数位留空时不会丢掉 kwargs。",
    code: `await Axon.DemoController.with_kwargs([1], { b: 2, label: "hi" });
// Python: with_kwargs(self, a, b=0, label="none")`,
    run: async (lib) => {
      const payload = { b: 2, label: "hi" };
      const result = await trace(
        "Axon.DemoController.with_kwargs([1], { b: 2, label: 'hi' })",
        { controller_id: "DemoController", func: "with_kwargs", args: [1], kwargs: payload },
        () => lib.Axon.DemoController.with_kwargs([1], payload),
      );
      return result === undefined ? "" : `Python 收到 kwargs 并返回 ${JSON.stringify(result)}`;
    },
  },

  async: {
    title: "调用 async 方法",
    summary:
      "Python 端用 async def 定义的方法会跑在独立的事件循环线程里（controller_loop），JS 侧不用关心区别，拿到的仍是同一个 Promise。",
    code: `await Axon.DemoController.delayed(["hi", 300]);
// Python: async def delayed(self, msg, ms=200)`,
    run: async (lib) => {
      const result = await trace(
        "Axon.DemoController.delayed(['hi', 300])",
        { controller_id: "DemoController", func: "delayed", args: ["hi", 300], kwargs: {} },
        () => lib.Axon.DemoController.delayed(["hi", 300]),
      );
      return result === undefined ? "" : `async 方法返回 ${JSON.stringify(result)}`;
    },
  },

  timeout: {
    title: "超时",
    summary:
      "第三个参数是超时毫秒。Python 超时未返回时，JS 侧 Promise 以 Timeout Error 拒绝，而不是永远悬着。（窗口被遮挡时浏览器会节流定时器，实际触发时间会晚一些。）",
    code: `await Axon.DemoController.slow([1500], {}, 300);
// Python: def slow(self, ms): time.sleep(ms / 1000)`,
    run: async (lib) => {
      await trace(
        "Axon.DemoController.slow([1500], {}, 300)   ← 只等 300ms",
        {
          controller_id: "DemoController",
          func: "slow",
          args: [1500],
          kwargs: {},
          timeout: 300,
        },
        () => lib.Axon.DemoController.slow([1500], {}, 300),
      );
      return "注意：Python 那个 1500ms 的调用还在跑，只是 JS 侧不再等它。";
    },
  },

  error: {
    title: "Python 抛异常",
    summary:
      "Python 方法抛出的异常会被序列化成消息回传，JS 侧 Promise 以该错误拒绝；栈在前端可读但不含 Python 内部对象。",
    code: `await Axon.DemoController.fail(["manual"]);
// Python: raise ValueError("...")`,
    run: async (lib) => {
      await trace(
        "Axon.DemoController.fail(['manual'])",
        { controller_id: "DemoController", func: "fail", args: ["manual"], kwargs: {} },
        () => lib.Axon.DemoController.fail(["manual"]),
      );
      return "";
    },
  },

  property: {
    title: "读写 Python 属性",
    summary:
      "读属性是惰性的：Axon.DemoController.counter 本身不发请求，await / .then 时才发 getVar。写属性是 setVar，立即返回（fire-and-forget），下一次读才看得到新值。",
    code: `const before = await Axon.DemoController.counter;
Axon.DemoController.counter = 42;          // setVar
await new Promise((r) => setTimeout(r, 150));
const after = await Axon.DemoController.get_counter([]);`,
    run: async (lib) => {
      const before = await trace(
        "await Axon.DemoController.counter   ← getVar",
        { controller_id: "DemoController", prop: "counter", type: "get" },
        () => lib.Axon.DemoController.counter,
      );
      pushLog({
        kind: "info",
        title: "Axon.DemoController.counter = 42   ← setVar（不等待返回）",
        payload: { value: 42, type: "set" },
      });
      lib.Axon.DemoController.counter = 42;
      await sleep(200);
      const after = await trace(
        "await Axon.DemoController.get_counter([])",
        { controller_id: "DemoController", func: "get_counter", args: [], kwargs: {} },
        () => lib.Axon.DemoController.get_counter([]),
      );
      return `读到的值：${JSON.stringify(before)} → 写入 42 后：${JSON.stringify(after)}`;
    },
  },

  pyToJs: {
    title: "Python 调用 JS 方法",
    summary:
      "反向通道：Python 里 Axon(\"AxonDocs\").DocsJS.mirror(payload) 返回 Future，JS 执行完后按 call_id 回填。页面上能同时看到两个方向。",
    code: `# Python
def call_js_mirror(self, payload):
    return Axon("AxonDocs").DocsJS.mirror(payload).result(5)`,
    run: async (lib) => {
      const result = await trace(
        "Axon.DemoController.call_js_mirror([{ hello: 'from python' }])",
        { controller_id: "DemoController", func: "call_js_mirror", args: [{ hello: "from python" }] },
        () => lib.Axon.DemoController.call_js_mirror([{ hello: "from python" }]),
      );
      return result === undefined ? "" : `往返一圈后 JS 收到 ${JSON.stringify(result)}`;
    },
  },

  pyToJsProperty: {
    title: "Python 读写 JS 属性",
    summary:
      "Python 侧 Axon(web).DocsJS.value.get(5) 同步取值；Axon(web).DocsJS.value = 99 写值（不等返回）。",
    code: `# Python
def read_js_value(self):
    return Axon("AxonDocs").DocsJS.value.get(5)

def write_js_value(self, value):
    Axon("AxonDocs").DocsJS.value = value`,
    run: async (lib) => {
      const read = await trace(
        "Axon.DemoController.read_js_value([])",
        { controller_id: "DemoController", func: "read_js_value", args: [] },
        () => lib.Axon.DemoController.read_js_value([]),
      );
      await trace(
        "Axon.DemoController.write_js_value([99])",
        { controller_id: "DemoController", func: "write_js_value", args: [99] },
        () => lib.Axon.DemoController.write_js_value([99]),
      );
      await sleep(150);
      const again = await trace(
        "再读一次 read_js_value([])",
        { controller_id: "DemoController", func: "read_js_value", args: [] },
        () => lib.Axon.DemoController.read_js_value([]),
      );
      return `DocsJS.value：${JSON.stringify(read)} → 写入 99 → ${JSON.stringify(again)}`;
    },
  },

  eventPyToJs: {
    title: "Python 派发事件 → JS",
    summary:
      "AxonEvent.dispatch_js_event(web, type, args) 把事件推送进 JS 的 AxonEvent；JS 侧用 addListener 注册，和 DOM EventTarget 同款手感。",
    code: `# Python
AxonEvent.dispatch_js_event("AxonDocs", "demo:event", ["hello from python"])

// JS
AxonEvent.addListener("demo:event", (text) => console.log(text));`,
    run: async (lib) => {
      const received: unknown[] = [];
      const listener = (text: unknown) => {
        received.push(text);
        pushLog({ kind: "event", title: 'JS 收到事件 "demo:event"', payload: text });
      };
      lib.AxonEvent.addListener("demo:event", listener);
      await trace(
        "Axon.DemoController.push_event(['hello from python'])",
        { controller_id: "DemoController", func: "push_event", args: ["hello from python"] },
        () => lib.Axon.DemoController.push_event(["hello from python"]),
      );
      await sleep(300);
      lib.AxonEvent.removeListener("demo:event", listener);
      return received.length ? `JS 侧收到 ${JSON.stringify(received)}` : "没有收到事件（检查后端是否连接）";
    },
  },

  eventJsToPy: {
    title: "JS 派发事件 → Python",
    summary:
      "AxonEvent.dispatchPYEvent({type, args}) 交给 Python 的 AxonEvent 分发；控制器在 __init__ 里 add_listener 注册监听即可。",
    code: `// JS
AxonEvent.dispatchPYEvent({ type: "demo:pong", args: [1, 2, 3] });

# Python（控制器里）
AxonEvent.add_listener("demo:pong", self._on_pong)`,
    run: async (lib) => {
      await trace(
        "AxonEvent.dispatchPYEvent({ type: 'demo:pong', args: [1, 2, 3] })",
        { type: "demo:pong", args: [1, 2, 3] },
        () => lib.AxonEvent.dispatchPYEvent({ type: "demo:pong", args: [1, 2, 3] }),
      );
      await sleep(200);
      const result = await trace(
        "回查 Python 端 get_pong([])",
        { controller_id: "DemoController", func: "get_pong", args: [] },
        () => lib.Axon.DemoController.get_pong([]),
      );
      return `Python 记录到的事件参数：${JSON.stringify(result)}`;
    },
  },

  stream: {
    title: "长任务进度推送",
    summary:
      "Python 在同步方法里边算边 dispatch_js_event，JS 用事件监听进度 —— 不需要轮询接口。",
    code: `# Python
def stream(self, count=4):
    for i in range(count):
        AxonEvent.dispatch_js_event("AxonDocs", "demo:progress", [{"step": i + 1, "total": count}])
        time.sleep(0.15)`,
    run: async (lib) => {
      const steps: unknown[] = [];
      const listener = (data: unknown) => {
        steps.push(data);
        pushLog({ kind: "event", title: 'JS 收到进度事件 "demo:progress"', payload: data });
      };
      lib.AxonEvent.addListener("demo:progress", listener);
      const result = await trace(
        "Axon.DemoController.stream([4])",
        { controller_id: "DemoController", func: "stream", args: [4] },
        () => lib.Axon.DemoController.stream([4]),
      );
      await sleep(300);
      lib.AxonEvent.removeListener("demo:progress", listener);
      return `收到 ${steps.length} 条进度事件；最终返回 ${JSON.stringify(result)}`;
    },
  },

  store: {
    title: "跨端 Store",
    summary:
      "AxonStore 是两端镜像的 key-value：JS 写 → Python 侧立刻可见（setFromPeer）；Python 写 → 所有活着的窗口收到 setFromPeer。",
    code: `const store = new AxonStore("docs-store");
store.set("docs:key", "from-js");              // → Python 收到 setFromPeer
await Axon.DemoController.store_read(["docs:key"]);

await Axon.DemoController.store_write(["docs:key2", "from-py"]);  // → JS 收到 setFromPeer
await new Promise((r) => setTimeout(r, 150));
store.get("docs:key2").get();`,
    run: async (lib) => {
      const store = new lib.AxonStore("docs-store");
      const written = "from-js-" + Math.random().toString(36).slice(2, 7);
      pushLog({ kind: "js2py", title: "store.set('docs:key', ...)  ← setFromPeer", payload: { value: written } });
      store.set("docs:key", written);
      await sleep(200);
      const seenByPy = await trace(
        "Axon.DemoController.store_read(['docs:key'])",
        { controller_id: "DemoController", func: "store_read", args: ["docs:key"] },
        () => lib.Axon.DemoController.store_read(["docs:key"]),
      );
      await trace(
        "Axon.DemoController.store_write(['docs:key2', 'from-py'])",
        { controller_id: "DemoController", func: "store_write", args: ["docs:key2", "from-py"] },
        () => lib.Axon.DemoController.store_write(["docs:key2", "from-py"]),
      );
      await sleep(250);
      const back = store.get("docs:key2").get();
      pushLog({
        kind: "py2js",
        title: "Python 写入后 JS 侧缓存值 ← setFromPeer",
        payload: { "docs:key2": back },
      });
      return `JS 写入 ${JSON.stringify(written)}，Python 读到 ${JSON.stringify(seenByPy)}；Python 写 docs:key2，JS 读到 ${JSON.stringify(back)}`;
    },
  },

  magicgui: {
    title: "回到 Qt 主线程执行",
    summary:
      "AxonMagicGUI.run(func) 把函数送回 Qt 主线程执行并返回 Future —— 适合碰 Qt 控件的操作（WebEngine 的调用线程不能直接动 UI）。",
    code: `# Python
AxonMagicGUI.run(lambda: QThread.currentThread() is QApplication.instance().thread()).result(5)`,
    run: async (lib) => {
      const result = await trace(
        "Axon.DemoController.magic_gui([])",
        { controller_id: "DemoController", func: "magic_gui", args: [] },
        () => lib.Axon.DemoController.magic_gui([]),
      );
      return `是否在 Qt 主线程执行：${JSON.stringify(result)}`;
    },
  },

  broadcast: {
    title: "广播到所有窗口",
    summary:
      "Axon.broadcast.DocsJS.note(text) 会向所有打开的窗口各发一次，返回每个窗口的 Future 列表。",
    code: `# Python
futures = Axon.broadcast.DocsJS.note("hi")
return [f.result(5) for f in futures]`,
    run: async (lib) => {
      const result = await trace(
        "Axon.DemoController.broadcast(['hi from js'])",
        { controller_id: "DemoController", func: "broadcast", args: ["hi from js"] },
        () => lib.Axon.DemoController.broadcast(["hi from js"]),
      );
      return `收到回执的窗口：${JSON.stringify(result)}`;
    },
  },
};
