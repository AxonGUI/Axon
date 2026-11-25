/**
 * 跨端大字符串的透明压缩（两端都声明支持时才启用）。
 *
 * 规则与 Python 侧 `axon/AxonCodec.py` 一致：
 * - 只压 `string`，且长度 >= GZ_THRESHOLD、压完（含 base64）比原来小 10% 以上；
 * - 压过的值换成 `{ "__axon_gz": "<base64>" }`；
 * - 用户数据里本来就有 `__axon_gz` 键时包一层 `{ "__axon_esc": ... }`。
 */
export declare const GZ_THRESHOLD: number;
export declare const MIN_RATIO = 0.9;
export declare function encode(value: any): Promise<any>;
export declare function decode(value: any): Promise<any>;
