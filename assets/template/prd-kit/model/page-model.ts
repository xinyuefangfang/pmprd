// 由 PRD 解析结果 + 舞台快照 计算“当前页面”上要展示什么。纯函数。

import { matchRoute } from "../parser/route.ts";
import type { AnchorHit, Annotation, FrameSnapshot, ParsedPrd, Section } from "../types.ts";

export const NAV_KEY_PREFIX = "nav:";

export interface StagedAnnotation {
  annotation: Annotation;
  hit: AnchorHit;
  number: number;
}

export interface PageModel {
  routeSections: Section[];
  /** 侧栏应定位到的章节 */
  activeSectionId: string | null;
  /** 贴在舞台元素旁的批注（聚合：不论属于哪个章节） */
  staged: StagedAnnotation[];
  /** 页面级批注（路由章节中没有锚点的） */
  pageLevel: Annotation[];
  /** 本页其他批注：路由章节里元素当前不可见的，以及元素在页面中但不可见的 */
  others: Array<{ annotation: Annotation; inDom: boolean }>;
  /** 侧栏入口的轻量标记：只贴小标签，不占批注卡片和编号 */
  nav: Array<{ annotation: Annotation; hit: AnchorHit }>;
  /** 页面上有 data-prd 但没有批注 */
  undocumented: string[];
  numberOf: Map<string, number>;
}

export function indexAnnotations(prd: ParsedPrd): Map<string, Annotation> {
  const map = new Map<string, Annotation>();
  for (const s of prd.sections)
    for (const a of s.annotations) if (a.anchor && !map.has(a.anchor)) map.set(a.anchor, a);
  return map;
}

/**
 * 侧栏入口自动标注：导航链接指向的页面，如果对应章节标了新增 / 改动 / 删除，
 * 就在入口上生成一条同样标记的批注。不用在 PRD 里为每个入口手写。
 */
export function navAnnotations(prd: ParsedPrd, frame: FrameSnapshot): Array<{ annotation: Annotation; hit: AnchorHit }> {
  const out: Array<{ annotation: Annotation; hit: AnchorHit }> = [];
  const seen = new Set<string>();
  for (const link of frame.navLinks ?? []) {
    if (!link.visible || seen.has(link.path)) continue;
    const section = prd.sections.find((s) => s.change && s.routes.some((r) => matchRoute(r, link.path)));
    if (!section) continue;
    seen.add(link.path);
    const key = `${NAV_KEY_PREFIX}${link.path}`;
    out.push({
      annotation: {
        key,
        anchor: null,
        type: "导航",
        change: section.change,
        title: `侧栏入口 ${link.label}`,
        body: `进入「${section.title}」，本章整体${section.change}。入口由 PRD 章节路由自动标注。`,
        images: [],
        sectionId: section.id,
        line: section.line,
      },
      hit: { id: key, rect: link.rect, visible: true, count: 1 },
    });
  }
  return out;
}

export function buildPageModel(prd: ParsedPrd, frame: FrameSnapshot): PageModel {
  const byAnchor = indexAnnotations(prd);
  const hits = new Map(frame.anchors.map((h) => [h.id, h]));
  const routeSections = prd.sections.filter((s) => s.routes.some((r) => matchRoute(r, frame.pathname)));

  const staged = frame.anchors
    .filter((h) => h.visible && byAnchor.has(h.id))
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
    .map((hit, i) => ({ annotation: byAnchor.get(hit.id)!, hit, number: i + 1 }));
  const nav = navAnnotations(prd, frame);
  const stagedKeys = new Set(staged.map((s) => s.annotation.key));

  const pageLevel = routeSections.flatMap((s) => s.annotations.filter((a) => !a.anchor));

  const others: PageModel["others"] = [];
  const otherKeys = new Set<string>();
  const addOther = (a: Annotation) => {
    if (stagedKeys.has(a.key) || otherKeys.has(a.key)) return;
    otherKeys.add(a.key);
    others.push({ annotation: a, inDom: !!(a.anchor && hits.has(a.anchor)) });
  };
  for (const s of routeSections) for (const a of s.annotations) if (a.anchor) addOther(a);
  for (const h of frame.anchors) {
    const a = byAnchor.get(h.id);
    if (a && !h.visible) addOther(a);
  }

  const undocumented = frame.anchors.filter((h) => !byAnchor.has(h.id)).map((h) => h.id);
  const activeSectionId = routeSections[0]?.id ?? staged[0]?.annotation.sectionId ?? null;
  const numberOf = new Map(staged.map((s) => [s.annotation.key, s.number]));

  return { routeSections, activeSectionId, staged, nav, pageLevel, others, undocumented, numberOf };
}
