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

// 对象字面量的成员：brace/paren 感知地按顶层逗号切开。
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let start = 0;
  let quote = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) { parts.push(body.slice(start, i)); start = i + 1; }
  }
  parts.push(body.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

function paramsOf(text) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [left, ...rest] = s.split(":");
      const name = left.trim().replace(/^\.\.\./, "");
      const optional = left.trim().endsWith("?");
      const type = rest.length ? rest.join(":").trim() : null;
      return { name: name.replace(/\?$/, ""), type, optional };
    });
}

function regexFallback() {
  const found = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const re = /AxonController\s*\.\s*register\s*\(\s*["'`]([\w$]+)["'`]\s*,\s*\{/g;
    let match;
    while ((match = re.exec(src))) {
      // 从对象字面量的 '{' 开始，找配对的 '}'（跳过字符串里的括号）。
      const open = match.index + match[0].length - 1;
      let depth = 0;
      let quote = null;
      let end = open;
      for (let i = open; i < src.length; i++) {
        const ch = src[i];
        if (quote) {
          if (ch === "\\") i++;
          else if (ch === quote) quote = null;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      const members = [];
      for (const entry of splitTopLevel(src.slice(open + 1, end))) {
        const method = entry.match(/^(?:async\s+)?([\w$]+)\s*\(([\s\S]*?)\)\s*(?::\s*([^{=]+))?(?:\{|$)/);
        if (method) {
          members.push({
            kind: "method",
            name: method[1],
            params: paramsOf(method[2]),
            ret: method[3] ? method[3].trim() : null,
            async: entry.startsWith("async"),
          });
          continue;
        }
        const arrow = entry.match(/^([\w$]+)\s*:\s*(?:async\s*)?\(([\s\S]*?)\)\s*=>/);
        if (arrow) {
          members.push({
            kind: "method",
            name: arrow[1],
            params: paramsOf(arrow[2]),
            ret: null,
            async: /:\s*async\b/.test(entry),
          });
          continue;
        }
        const prop = entry.match(/^([\w$]+)\s*:\s*([\s\S]+)$/);
        if (prop) {
          const value = prop[2].trim();
          const isFunctionValue = /^(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>)/.test(value);
          members.push({
            kind: isFunctionValue ? "method" : "prop",
            name: prop[1],
            params: [],
            type: isFunctionValue ? null : value,
            ret: null,
            async: false,
          });
        }
      }
      found.push({ name: match[1], members, file });
    }
  }
  return found;
}

if (!ts) {
  console.error("[types] 没找到 typescript，退化为正则解析：只认对象字面量，复杂参数类型会退化成 Any。");
  console.log(JSON.stringify({ mode: "regex", controllers: regexFallback() }));
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
