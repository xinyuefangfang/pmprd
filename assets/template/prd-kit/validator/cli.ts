// 命令行校验：扫描源码中的 data-prd 与 PRD 批注锚点，输出差异。
// 跑：node --experimental-strip-types prd-kit/validator/cli.ts
// 失效批注、重复锚点、图片 / 文档缺失时退出码为 1；缺少说明只提示。

import fs from "node:fs";
import path from "node:path";
import config from "../../prd.config.ts";
import { parsePrd } from "../parser/parse-prd.ts";
import { loadContent } from "../server/load-content.ts";
import { validate } from "./checks.ts";

const root = path.resolve(import.meta.dirname, "../..");
// Also matches components that forward a `prd="…"` prop to data-prd.
const ANCHOR = /\b(?:data-)?prd\s*=\s*(?:\{\s*)?["'`]([A-Za-z0-9._:-]+)["'`]/g;

function scan(dir: string, out = new Map<string, string[]>()): Map<string, string[]> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") scan(file, out);
    } else if (/\.(tsx?|jsx?|html)$/.test(entry.name)) {
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(ANCHOR)) {
        const line = text.slice(0, m.index).split("\n").length;
        const list = out.get(m[1]) ?? [];
        list.push(`${path.relative(root, file)}:${line}`);
        out.set(m[1], list);
      }
    }
  }
  return out;
}

const content = loadContent(root, config);
const prdDoc = content.docs.find((d) => d.annotations);
const prd = parsePrd(prdDoc?.source ?? "");
const sourceAnchors = scan(path.resolve(root, config.srcDir));
const documented = new Set(prd.sections.flatMap((s) => s.annotations.map((a) => a.anchor)).filter(Boolean) as string[]);
const undocumented = [...sourceAnchors.keys()].filter((id) => !documented.has(id));
const result = validate({
  prd,
  content,
  knownAnchors: new Set(sourceAnchors.keys()),
  undocumented,
  anchorTotal: sourceAnchors.size,
});

const annotationCount = prd.sections.reduce((n, s) => n + s.annotations.length, 0);
console.log(`需求目录  ${config.requirement}`);
console.log(`章节 ${prd.sections.length}，绑定路由 ${prd.sections.filter((s) => s.routes.length).length}，批注 ${annotationCount}`);
console.log(`源码锚点 ${sourceAnchors.size}，覆盖率 ${result.coverage == null ? "—" : Math.round(result.coverage * 100) + "%"}`);

const section = (title: string, lines: string[]) => {
  if (!lines.length) return;
  console.log(`\n${title}（${lines.length}）`);
  for (const l of lines) console.log(`  ${l}`);
};
section(
  "失效批注：源码中找不到锚点",
  result.unseen.map((a) => `#${a.anchor}  ${a.title}  (${prdDoc?.file}:${a.line})`),
);
section(
  "缺少说明：源码有锚点但 PRD 无批注",
  undocumented.map((id) => `#${id}  ${sourceAnchors.get(id)![0]}`),
);
// 本版改动清单（提示，不算问题）：研发对照这里排期
section(
  "本版改动",
  prd.sections.flatMap((s) => [
    ...(s.change ? [`[${s.change}] ${s.title}  (${prdDoc?.file}:${s.line})`] : []),
    ...s.annotations
      .filter((a) => a.change)
      .map((a) => `  [${a.change}] ${a.title}${a.anchor ? `  #${a.anchor}` : ""}  (${prdDoc?.file}:${a.line})`),
  ]),
);
section("重复锚点", result.duplicates.map((id) => `#${id}`));
section("图片缺失", result.missingImages);
section("文档缺失", result.missingDocs);

const failed = result.unseen.length + result.duplicates.length + result.missingImages.length + result.missingDocs.length;
console.log(failed ? `\n发现 ${failed} 个问题` : "\n校验通过");
process.exit(failed ? 1 : 0);
