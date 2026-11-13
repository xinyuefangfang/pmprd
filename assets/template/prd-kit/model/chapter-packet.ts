import { parsePrd } from "../parser/parse-prd.ts";
import type { ParsedPrd, PrdContent } from "../types.ts";

export interface ChapterPacket {
  text: string;
  specCount: number;
  warning: string | null;
}

/** 从原文按真实章节边界截取，保留批注、变化标记、代码块及原始顺序。 */
function chapterSource(lines: string[], prd: ParsedPrd, index: number): string {
  const end = (prd.sections[index + 1]?.line ?? lines.length + 1) - 1;
  return lines.slice(prd.sections[index].line - 1, end).join("\n").trim();
}

export function buildChapterPackets(content: PrdContent, prd: ParsedPrd): Map<string, ChapterPacket> {
  const packets = new Map<string, ChapterPacket>();
  const prdDoc = content.docs.find((doc) => doc.annotations);
  if (!prdDoc?.source) return packets;
  const devDoc = content.docs.find((doc) => doc.id === "dev");
  const dev = parsePrd(devDoc?.source ?? "");
  const prdLines = prdDoc.source.split(/\r?\n/);
  const devLines = (devDoc?.source ?? "").split(/\r?\n/);
  for (const [index, section] of prd.sections.entries()) {
    const matching = dev.sections.flatMap((spec, i) =>
      spec.specs.some((key) => section.specs.includes(key)) ? [i] : [],
    );
    const missing = section.specs.filter((key) => !matching.some((i) => dev.sections[i].specs.includes(key)));
    const warning = !section.specs.length
      ? "本章尚未绑定 Dev Spec。"
      : !devDoc?.source
        ? "Dev Spec 文档缺失，未附带开发说明。"
        : missing.length ? `未找到对应开发说明：${missing.join("、")}。` : null;
    const text = [
      `# ${section.title} · AI 开发上下文`,
      `需求目录（相对原型工程）：${content.requirement}`,
      `原型路由：${section.routes.join("、") || "未绑定页面"}`,
      "---\n\n# PRD",
      `文档：${prdDoc.file}`,
      chapterSource(prdLines, prd, index),
      "---\n\n# Dev Spec",
      ...(warning ? [`注意：${warning}`] : []),
      ...matching.map((i) => `文档：${devDoc!.file}\n\n${chapterSource(devLines, dev, i)}`),
    ].join("\n\n");
    packets.set(section.id, { text, specCount: matching.length, warning });
  }
  return packets;
}
