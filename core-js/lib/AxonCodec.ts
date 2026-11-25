/**
 * 跨端大字符串的透明压缩（两端都声明支持时才启用）。
 *
 * 规则与 Python 侧 `axon/AxonCodec.py` 一致：
 * - 只压 `string`，且长度 >= GZ_THRESHOLD、压完（含 base64）比原来小 10% 以上；
 * - 压过的值换成 `{ "__axon_gz": "<base64>" }`；
 * - 用户数据里本来就有 `__axon_gz` 键时包一层 `{ "__axon_esc": ... }`。
 */

export const GZ_THRESHOLD = 256 * 1024;
export const MIN_RATIO = 0.9;

const GZ_KEY = "__axon_gz";
const ESC_KEY = "__axon_esc";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function gzipToBase64(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  // @ts-ignore - CompressionStream 在新版 Chromium/Node 里都有
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  return toBase64(buf);
}

async function gunzipFromBase64(packed: string): Promise<string> {
  const bytes = fromBase64(packed);
  // @ts-ignore - 同上
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

async function encodeString(value: string): Promise<any> {
  if (value.length < GZ_THRESHOLD) return value;
  const packed = await gzipToBase64(value);
  if (packed.length < value.length * MIN_RATIO) return { [GZ_KEY]: packed };
  return value;
}

export async function encode(value: any): Promise<any> {
  if (typeof value === "string") return encodeString(value);
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await encode(item));
    return out;
  }
  if (value && typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, GZ_KEY)) {
      return { [ESC_KEY]: value };
    }
    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) out[key] = await encode(value[key]);
    return out;
  }
  return value;
}

export async function decode(value: any): Promise<any> {
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await decode(item));
    return out;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === GZ_KEY && typeof value[GZ_KEY] === "string") {
      return await gunzipFromBase64(value[GZ_KEY]);
    }
    if (keys.length === 1 && keys[0] === ESC_KEY) {
      return value[ESC_KEY];
    }
    const out: Record<string, any> = {};
    for (const key of keys) out[key] = await decode(value[key]);
    return out;
  }
  return value;
}
