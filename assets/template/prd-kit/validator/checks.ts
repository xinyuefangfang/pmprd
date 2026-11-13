// 校验规则，页面内面板与命令行共用。

import type { Annotation, ParsedPrd, PrdContent } from "../types.ts";

export interface ValidationInput {
  prd: ParsedPrd;
  content: PrdContent;
  /** 已出现过的锚点（页面内：本次浏览；命令行：源码扫描） */
  knownAnchors: Set<string>;
  /** 当前页面上没有批注的锚点（命令行为源码中所有缺说明的锚点） */
  undocumented: string[];
  /** 当前页面锚点总数（覆盖率用；命令行可传全部锚点数） */
  anchorTotal: number;
}

export interface ValidationResult {
  /** 批注有锚点，但元素未出现 */
  unseen: Annotation[];
  undocumented: string[];
  duplicates: string[];
  missingImages: string[];
  missingDocs: string[];
  /** 0-1，没有锚点时为 null */
  coverage: number | null;
  issueCount: number;
}

export function validate(input: ValidationInput): ValidationResult {
  const { prd, content, knownAnchors, undocumented, anchorTotal } = input;
  // 标为删除的批注说明的是要去掉的元素，原型里没有它是对的
  const unseen = prd.sections.flatMap((s) =>
    s.annotations.filter((a) => a.anchor && a.change !== "删除" && !knownAnchors.has(a.anchor)),
  );
  const missingDocs = content.docs.filter((d) => d.source == null).map((d) => d.file);
  const coverage = anchorTotal ? (anchorTotal - undocumented.length) / anchorTotal : null;
  return {
    unseen,
    undocumented,
    duplicates: prd.duplicates,
    missingImages: content.missingImages,
    missingDocs,
    coverage,
    issueCount: undocumented.length + prd.duplicates.length + content.missingImages.length + missingDocs.length,
  };
}
