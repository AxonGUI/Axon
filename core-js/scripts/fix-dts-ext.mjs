/**
 * 把 dist/*.d.ts 里相对导入的路径改写成带 `.js` 后缀。
 *
 * vite-plugin-dts 产出的声明文件要么保留源码里的 `./X.ts`，要么干脆没有后缀；
 * 而消费方用 `moduleResolution: node16 / nodenext` 时，相对导入**必须**写显式扩展名，
 * 否则报 TS2834。运行期文件是 `.js`，所以统一写成 `.js`（bundler 解析同样接受）。
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url);
let changed = 0;
for (const file of await readdir(dist)) {
  if (!file.endsWith(".d.ts")) continue;
  const path = join(dist.pathname, file);
  const source = await readFile(path, "utf8");
  const fixed = source.replace(
    /(from\s+["'])(\.[^"']*?)(["'])/g,
    (_match, head, spec, tail) => {
      if (spec.endsWith(".js") || spec.endsWith(".json")) return `${head}${spec}${tail}`;
      return `${head}${spec.replace(/\.ts$/, "")}.js${tail}`;
    },
  );
  if (fixed !== source) {
    await writeFile(path, fixed);
    changed += 1;
  }
}
console.log(`[fix-dts-ext] ${changed} 个声明文件补上 .js 后缀`);
