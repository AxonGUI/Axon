/**
 * Axon 的错误基类：两端抛出来的错误都从这里派生，`instanceof` 才可用。
 *
 * 之前有几处直接 `reject("字符串")`，`catch (e) { e.message }` 会得到 undefined。
 */
export class AxonError extends Error {
  /** 稳定的机器可读错误码，便于在 catch 里分流而不是匹配文案。 */
  readonly code: string;

  constructor(message: string, options: { code?: string; name?: string; cause?: unknown } = {}) {
    super(message);
    // 打包后类名会被压缩，所以名字显式传进来，不靠 new.target.name
    this.name = options.name ?? "AxonError";
    this.code = options.code ?? "AXON";
    if (options.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

/** 等不到 Python 回包（`timeout` 到期）。 */
export class AxonTimeoutError extends AxonError {
  constructor(message = "Python 没有在给定时间内返回") {
    super(message, { code: "TIMEOUT", name: "AxonTimeoutError" });
  }
}

/** 通道还没连上就发起了调用。 */
export class AxonNotConnectedError extends AxonError {
  constructor(message = "Axon 通道还没有连上，先 await AxonInit()") {
    super(message, { code: "NOT_CONNECTED", name: "AxonNotConnectedError" });
  }
}

/** Python 侧抛出的异常，被转成 JS 错误。 */
export class AxonRemoteError extends AxonError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: "REMOTE", name: "AxonRemoteError", cause });
  }
}
