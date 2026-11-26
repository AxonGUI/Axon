import { AxonCall } from "./AxonJSCall";

/** 调用 Python 方法时可以用的两种写法。 */
export type AxonCallArgs = {
  /** 打包式: `fn([a, b], { kwarg: 1 }, 3000)` —— 需要 kwargs / timeout 时用这个 */
  (args?: any[], kwargs?: Record<string, any>, timeout?: number): Promise<any>;
  /** 摊开式: `fn(a, b, c)`；只有一个数组参数时它也只是一个参数 (`fn([1, 2])` 只传一个数组) */
  (...args: any[]): Promise<any>;
};

/**
 * 静态占位类型：**故意不是** `Axon` 的声明类型。
 *
 * 控制器名和方法名只有运行时才知道，用索引签名去描述只会让
 * `noPropertyAccessFromIndexSignature` / `noUncheckedIndexedAccess` 的用户报错。
 * 需要静态类型时自己写一个接口再断言：
 *
 * ```ts
 * interface CalcApi { add(a: number, b: number): Promise<number> }
 * const calc = Axon.Calc as CalcApi;
 * ```
 */
export type AxonProxy = {
  [controller: string]: AxonCallArgs & Promise<any>;
};

/**
 * 控制器签名表。**这是 `axon-gui types` 生成文件的增强入口**：
 *
 * ```ts
 * // src/axon.generated.ts（自动生成，勿手改）
 * export interface AxonRegistry {
 *   Calc: { add(a: number, b: number): Promise<number> }
 * }
 * declare module "axon-gui" {
 *   interface AxonControllers extends AxonRegistry {}
 * }
 * ```
 *
 * 没有生成物时它是空接口，`Axon` 退回 `any`（旧行为不变）。
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AxonControllers {}

/** 生成物给出的控制器名；没有生成物时是 `never`。 */
type GeneratedControllerNames = keyof AxonControllers;

/**
 * `Axon` 的静态类型：有生成物就按签名表来，没有就还是 `any`。
 */
export type AxonFacade = [GeneratedControllerNames] extends [never]
  ? any
  : {
      [K in GeneratedControllerNames]: AxonControllers[K];
    };

type PackedCall = {
  args?: any[];
  kwargs?: Record<string, any>;
  timeout?: number;
};

/**
 * 把「摊开式」和「打包式」两种调用统一成 AxonCall.call 的参数。
 *
 * - 第一个是数组、且后面还跟着 kwargs / timeout → 打包写法
 * - 其余情况 → 所有位置参数就是 Python 方法的位置参数
 *
 * 为什么要求「后面还跟着东西」: `Axon.Fs.setDragRegions(regions)` 这种
 * 「唯一的参数就是个数组」的调用非常常见, 不能把它拆成 N 个位置参数。
 */
export function packCallArgs(callArgs: any[]): PackedCall {
  if (callArgs.length === 0) return { args: [] };
  if (Array.isArray(callArgs[0]) && callArgs.length > 1) {
    return {
      args: callArgs[0],
      kwargs: callArgs[1] as Record<string, any> | undefined,
      timeout: callArgs[2] as number | undefined,
    };
  }
  return { args: callArgs };
}

/**
 * Axon 的 JS 侧语法糖。
 *
 * ```ts
 * await Axon.Users.add(1, 2)          // 调 Python 方法, 位置参数直接摊开
 * await Axon.Users.slow([1000], {}, 300)  // 需要 kwargs / 超时时用打包写法
 * await Axon.Users.count              // 读 Python 属性 (getVar)
 * Axon.Users.count = 3                // 写 Python 属性 (setVar, fire-and-forget)
 * ```
 *
 * 属性读是惰性的: 只有真正 `await` / `.then` / `.catch` / `.finally` 时才发请求。
 * 取到的 `dispatcher` 本身是函数, 同时挂了 `then/catch/finally`,
 * 让 `Axon.Users.count` 既能当 Promise 用, 又能当方法调用。
 */
export const Axon = new Proxy(
  {},
  {
    get(_, controller_id: string) {
      return new Proxy(
        {},
        {
          get(_, prop: string) {
            const dispatcher = (...callArgs: any[]) =>
              AxonCall.call({
                controller_id,
                func: prop,
                ...packCallArgs(callArgs),
              });

            // 必须用 function 而不是箭头函数: 箭头函数没有自己的 arguments,
            // 早先的写法把 undefined 当回调传给 Promise.then,
            // 导致 `await Axon.Controller.prop` 永远不 settle。
            let getVarPromise: Promise<any> | undefined;
            const ensureGetVar = () => {
              if (!getVarPromise) {
                getVarPromise = AxonCall.getVar({
                  controller_id,
                  var_name: prop,
                });
              }
              return getVarPromise;
            };

            dispatcher.then = function (
              onFulfilled?: any,
              onRejected?: any,
            ): Promise<any> {
              return ensureGetVar().then(onFulfilled, onRejected);
            };

            dispatcher.catch = function (onRejected?: any): Promise<any> {
              return ensureGetVar().catch(onRejected);
            };

            dispatcher.finally = function (onFinally?: any): Promise<any> {
              return ensureGetVar().finally(onFinally);
            };
            return dispatcher;
          },
          set(_, prop: string, value) {
            AxonCall.setVar({
              controller_id,
              var_name: prop,
              value,
            });
            return true;
          },
        },
      );
    },
  },
) as unknown as AxonFacade; // 有生成物时是强类型，没有时是 any
