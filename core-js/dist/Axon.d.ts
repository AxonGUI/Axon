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
export declare function packCallArgs(callArgs: any[]): PackedCall;
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
export declare const Axon: any;
export {};
