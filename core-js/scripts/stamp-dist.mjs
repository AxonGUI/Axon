// 给 dist/ 盖一个"来自哪一版源码"的章：
//   dist/build-info.json = { version, libHash, files }
// libHash 只由 lib/**/*.ts 的内容决定（按路径排序后整体 sha256），与构建环境无关，
// 所以 CI 里可以 `npm run build && git diff --exit-code -- dist/build-info.json` 来判断
// "改了 lib 却忘了重新构建并提交 dist"。d.ts 的成员顺序在不同环境会变，不做字节比对。
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const libDir = join(root, "lib");

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const files = walk(libDir).sort();
const hash = createHash("sha256");
for (const file of files) {
  hash.update(relative(root, file).replaceAll("\\", "/"));
  hash.update("\0");
  hash.update(readFileSync(file));
  hash.update("\0");
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const info = {
  name: pkg.name,
  version: pkg.version,
  libHash: hash.digest("hex"),
  files: files.map((f) => relative(root, f).replaceAll("\\", "/")),
};
writeFileSync(join(root, "dist", "build-info.json"), JSON.stringify(info, null, 2) + "\n");
console.log(`[stamp] ${info.name}@${info.version} libHash=${info.libHash.slice(0, 12)} (${files.length} files)`);
