// 从 TS/JS 源码里抽出「前端 JS 控制器」的形状，输出 JSON 给 Python 侧的 pygen 渲染。
//
// 用的是 TypeScript 编译器 API（类型检查器级别），所以这些写法都能认：
//   AxonController.register("DocsJS", { mirror(p: Payload) { … } })
//   AxonController.register("DocsJS", createDocsJsController())
//   AxonController.register("DocsJS", new DocsJsController())
// 找不到 typescript（用户项目没装）时退化为正则版本：只能拿到方法名和裸注解。
//
// 用法: node extract_js.mjs <文件或目录>  → stdout 输出 JSON

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const target = process.argv[2];
if (!target) {
  console.error("[types] 用法: node extract_js.mjs <文件或目录>");
  process.exit(2);
}

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".vitepress", "coverage"]);
const SOURCE_EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs"]);

function walk(p, out = []) {
  const stat = fs.statSync(p);
  if (stat.isFile()) {
    if (SOURCE_EXT.has(path.extname(p))) out.push(p);
    return out;
  }
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    walk(path.join(p, entry.name), out);
  }
  return out;
}

function loadTypeScript(from) {
  // 从目标文件所在目录一路往上找 typescript：vite 项目一般装在项目根
  const starts = [from, process.cwd()];
  for (const start of starts) {
    let dir = path.resolve(start);
    for (;;) {
      const pkg = path.join(dir, "package.json");
      if (fs.existsSync(pkg)) {
        try {
          const req = createRequire(pkg);
          return req("typescript");
        } catch {
          /* 这个目录的 node_modules 里没有，继续往上 */
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

const resolved = path.resolve(target);
const ts = loadTypeScript(fs.statSync(resolved).isFile() ? path.dirname(resolved) : resolved);
const files = walk(resolved);

if (!ts) {
  // 退化：正则版。只能拿到方法名与直接写在方法上的注解，够生成「有名字的 Any」。
  const found = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const re = /AxonController\s*\.\s*register\s*\(\s*["'`]([\w$]+)["'`]\s*,\s*\{/g;
    let match;
    while ((match = re.exec(src))) {
      const members = [];
      const bodyRe = /(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w<>[\]| ,.]+))?\s*\{/g;
      const slice = src.slice(match.index, match.index + 4000);
      let m;
      while ((m = bodyRe.exec(slice))) {
        members.push({
          kind: "method",
          name: m[1],
          params: m[2]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => {
              const [name, type] = s.split(":").map((x) => x && x.trim());
              return { name: name.replace(/^\.\.\./, ""), type: type || null, optional: false };
            }),
          ret: m[3] || null,
          async: false,
        });
      }
      found.push({ name: match[1], members, file });
    }
  }
  console.log(JSON.stringify({ mode: "regex", controllers: found }));
  process.exit(0);
}

const program = ts.createProgram(files, {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowJs: true,
  checkJs: false,
  noEmit: true,
  skipLibCheck: true,
  jsx: ts.JsxEmit.Preserve,
  esModuleInterop: true,
  strict: true,
});
const checker = program.getTypeChecker();
const controllers = [];

for (const file of files) {
  const sf = program.getSourceFile(file);
  if (!sf) continue;

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.getText() === "register" &&
      node.arguments.length >= 2
    ) {
      const [nameArg, factoryArg] = node.arguments;
      if (ts.isStringLiteralLike(nameArg)) {
        const type = checker.getTypeAtLocation(factoryArg);
        const members = [];
        for (const symbol of type.getProperties()) {
          const decl = symbol.valueDeclaration ?? symbol.declarations?.[0];
          const memberType = checker.getTypeOfSymbolAtLocation(symbol, decl ?? factoryArg);
          const calls = memberType.getCallSignatures();
          if (calls.length > 0) {
            const signature = calls[0];
            const params = signature.getParameters().map((param) => {
              const pType = checker.getTypeOfSymbolAtLocation(param, param.valueDeclaration ?? factoryArg);
              return {
                name: param.getName(),
                type: checker.typeToString(pType),
                optional: (param.flags & ts.SymbolFlags.Optional) !== 0,
              };
            });
            const ret = checker.typeToString(signature.getReturnType());
            members.push({
              kind: "method",
              name: symbol.getName(),
              params,
              ret,
              async: ret.startsWith("Promise<"),
            });
          } else {
            members.push({
              kind: "prop",
              name: symbol.getName(),
              type: checker.typeToString(memberType),
              optional: (symbol.flags & ts.SymbolFlags.Optional) !== 0,
            });
          }
        }
        controllers.push({ name: nameArg.text, members, file: path.relative(process.cwd(), file) });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
}

console.log(JSON.stringify({ mode: "typescript", controllers }));
