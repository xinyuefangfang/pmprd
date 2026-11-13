// 把 prd.md 解析成 章节 / 路由 / 批注。纯函数，不依赖 DOM 和 Node，前端和命令行共用。
//
// 批注约定：
//   ## 3. Agents 页面 {route=/agent-studio}
//   ### 批注
//   - [规则] 卡片 Use {#agents.card.use}
//     正文（缩进续行，可含图片）
//   变化标记：章节 {route=/x change=新增}；批注 - [规则][改动] 标题 {#id}

import type { Annotation, Change, ParsedPrd, Section } from "../types.ts";

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ATTRS = /\s*\{([^{}]*)\}\s*$/;
const ITEM = /^[-*+]\s+(.*)$/;
const TYPE = /^\[([^\]]+)\]\s*/;
const ANCHOR = /\s*\{#([A-Za-z0-9._:-]+)\}/;
const IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

export const ANNOTATION_HEADING = "批注";

const CHANGES: Record<string, Change> = {
  新增: "新增",
  new: "新增",
  改动: "改动",
  修改: "改动",
  changed: "改动",
  删除: "删除",
  removed: "删除",
};
export function parseChange(value: string | undefined): Change | null {
  return value ? (CHANGES[value.trim().toLowerCase()] ?? null) : null;
}

/** 解析标题末尾的 {route=/a,/b change=新增} 属性，返回去掉属性后的标题 */
export function parseHeadingAttrs(text: string): { title: string; routes: string[]; specs: string[]; change: Change | null } {
  const m = text.match(ATTRS);
  if (!m || m[1].trim().startsWith("#")) return { title: text.trim(), routes: [], specs: [], change: null };
  const routes: string[] = [];
  const specs: string[] = [];
  let change: Change | null = null;
  for (const token of m[1].trim().split(/\s+/)) {
    const [key, value = ""] = token.split("=");
    if (key === "route") routes.push(...value.split(",").map((r) => r.trim()).filter(Boolean));
    if (key === "spec") specs.push(...value.split(",").map((r) => r.trim()).filter(Boolean));
    if (key === "change") change = parseChange(value);
  }
  return { title: text.slice(0, m.index).trim(), routes, specs, change };
}

export function extractImages(markdown: string): string[] {
  const out: string[] = [];
  for (const m of markdown.matchAll(IMAGE)) {
    const src = m[1];
    if (!/^(https?:|data:|\/)/.test(src)) out.push(src);
  }
  return out;
}

function dedent(lines: string[]): string {
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines
    .map((l) => l.slice(min))
    .join("\n")
    .trim();
}

export function parsePrd(source: string): ParsedPrd {
  const lines = source.split(/\r?\n/);
  const preamble: string[] = [];
  const sections: Section[] = [];

  let section: (Section & { proseLines: string[] }) | null = null;
  let inFence = false;
  let inAnnotations = false;
  let item: { first: string; line: number; rest: string[] } | null = null;

  const flushItem = () => {
    if (!item || !section) return;
    let text = item.first;
    let type: string | null = null;
    let change: Change | null = null;
    let anchor: string | null = null;
    // 最多两个方括号：类型和变化标记，顺序不限，如 [规则][新增]
    for (let i = 0; i < 2; i++) {
      const t = text.match(TYPE);
      if (!t) break;
      const asChange = parseChange(t[1]);
      if (asChange && !change) change = asChange;
      else if (!type) type = t[1].trim();
      else break;
      text = text.slice(t[0].length);
    }
    const a = text.match(ANCHOR);
    if (a) {
      anchor = a[1];
      text = text.replace(ANCHOR, "");
    }
    const body = dedent(item.rest);
    const index = section.annotations.length;
    const annotation: Annotation = {
      key: anchor ?? `${section.id}#${index + 1}`,
      anchor,
      type,
      change,
      title: text.trim(),
      body,
      images: extractImages(item.first + "\n" + body),
      sectionId: section.id,
      line: item.line,
    };
    section.annotations.push(annotation);
    item = null;
  };

  const pushProse = (line: string) => {
    if (section) section.proseLines.push(line);
    else preamble.push(line);
  };

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    if (FENCE.test(line)) {
      inFence = !inFence;
      if (item) item.rest.push(line);
      else pushProse(line);
      return;
    }
    const h = inFence ? null : line.match(HEADING);
    if (h) {
      const level = h[1].length;
      if (level <= 3) {
        flushItem();
        inAnnotations = false;
      }
      if (level === 2) {
        if (section) sections.push(section);
        const { title, routes, specs, change } = parseHeadingAttrs(h[2]);
        section = {
          id: `s${sections.length + 1}`,
          title,
          routes,
          specs,
          change,
          line: lineNo,
          prose: "",
          annotations: [],
          proseLines: [`## ${title}`],
        };
        return;
      }
      if (level === 3 && section && parseHeadingAttrs(h[2]).title === ANNOTATION_HEADING) {
        inAnnotations = true;
        return;
      }
      if (level <= 3) {
        const { title } = parseHeadingAttrs(h[2]);
        pushProse(`${h[1]} ${title}`);
        return;
      }
    }
    if (inAnnotations && !inFence) {
      const m = line.match(ITEM);
      if (m) {
        flushItem();
        item = { first: m[1], line: lineNo, rest: [] };
        return;
      }
      if (item && (line.trim() === "" || /^\s+/.test(line))) {
        item.rest.push(line);
        return;
      }
      flushItem();
      if (line.trim() === "") return;
    } else if (item) {
      item.rest.push(line);
      return;
    }
    pushProse(line);
  });
  flushItem();
  if (section) sections.push(section);

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const s of sections) {
    s.prose = (s as Section & { proseLines: string[] }).proseLines.join("\n").trim();
    delete (s as Partial<Section & { proseLines: string[] }>).proseLines;
    for (const a of s.annotations) {
      if (!a.anchor) continue;
      if (seen.has(a.anchor)) duplicates.add(a.anchor);
      seen.add(a.anchor);
    }
  }
  return { preamble: preamble.join("\n").trim(), sections, duplicates: [...duplicates] };
}

/** 展示普通文档时隐藏章节元数据，代码块与正文保持原样。 */
export function stripSectionAttrs(source: string): string {
  const lines = source.split(/\r?\n/);
  for (const section of parsePrd(source).sections) lines[section.line - 1] = `## ${section.title}`;
  return lines.join("\n");
}

/** 把 markdown 里的相对路径按文档所在目录解析成需求目录内的路径 */
export function resolveDocPath(docFile: string, ref: string): string {
  const parts = docFile.split("/").slice(0, -1);
  for (const seg of ref.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}
