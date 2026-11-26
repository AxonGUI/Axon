/**
 * 类型回归测试：只做类型检查、不运行。
 *
 * 这一份故意开满严格选项（`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、
 * `noPropertyAccessFromIndexSignature`…），因为消费方经常开；我们自己的 lib 里
 * 开不开是另一回事。跑法见 package.json 的 `test:types`。
 */
import {
  Axon,
  AxonCall,
  AxonCross,
  AxonEvent,
  AxonInit,
  AxonStore,
  AxonController,
  isAxonReady,
} from "../../dist/index.js";

export async function checkTypes(): Promise<void> {
  const status = await AxonInit();
  const ready: boolean = status.ready;
  const reason: string | undefined = status.reason;
  const objects: string[] = status.objects;
  if (!isAxonReady() || ready || reason || objects) return;

  // 动态命名空间：直接点得动（类型是 any，见 AxonProxy 注释）
  const sum: number = await Axon.Calc.add(1, 2);
  const packed: number = await Axon.Calc.add([1, 2], { round: true }, 3000);
  Axon.Calc.title = "x";

  // 想要静态类型就自己断言
  interface CalcApi {
    add(a: number, b: number): Promise<number>;
  }
  const calc = Axon.Calc as CalcApi;
  const typed: number = await calc.add(1, 2);

  // 跨窗口
  const webs: string[] = await AxonCross.windows();
  const alive: boolean = await AxonCross.has("charts");
  const pong: { web: string; echo: string } = await AxonCross.web("charts").Peer.ping("hi");
  const single: { web: string; value?: unknown } = await AxonCross.call({
    web: "charts",
    controller: "Peer",
    func: "ping",
    args: ["hi"],
  });

  // Store：await 直接拿值，也可以 .get()
  const store = new AxonStore("s1");
  const direct: number = await store.get<number>("k");
  const viaProperty: number = store.get<number>("k").get();
  store.set("k", 1);
  store.prop<number>("k").set(2);

  // 事件：addListener 返回退订函数
  const off: () => void = AxonEvent.addListener("custom:evt", (a: number, b: string) => {
    void a;
    void b;
  });
  off();
  AxonEvent.addListener("loadFinished", () => {});
  AxonEvent.dispatchEvent("custom:evt", 1, "x");
  await AxonEvent.dispatchPYEvent({ type: "custom:evt", args: [1, "x"] });

  // 低层：可以指定返回类型
  const raw: number = await AxonCall.call<number>({
    controller_id: "Calc",
    func: "add",
    args: [1, 2],
  });
  const prop: string = await AxonCall.getVar<string>({
    controller_id: "Calc",
    var_name: "title",
  });
  await AxonCall.setVar({ controller_id: "Calc", var_name: "title", value: "x" });

  // JS 控制器注册
  AxonController.register("JsCtl", {
    value: 7,
    async ping(text: string) {
      return text.toUpperCase();
    },
  });

  console.log(sum, packed, typed, webs, alive, pong, single, direct, viaProperty, raw, prop);
}
