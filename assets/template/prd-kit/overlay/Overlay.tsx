// 舞台标注层：两侧批注卡片 + 引线 + 元素编号点 + 悬停高亮。整层不拦截原型的点击，只有卡片可点。

import { useLayoutEffect, useRef, useState } from "react";
import type { PageModel, StagedAnnotation } from "../model/page-model.ts";
import type { Rect } from "../types.ts";
import { ChangeChip, changeClass, Markdown, NumberBadge, toneOf, TypeChip } from "../ui/shared.tsx";
import { layoutColumn } from "./layout.ts";

export const CARD_WIDTH = 232;
export const GUTTER = 28;
const HEAD_Y = 16; // 卡片上引线连接点距卡片顶部

export interface FrameBox {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
  /** iframe 逻辑宽度 */
  innerWidth: number;
}

interface Props {
  staged: StagedAnnotation[];
  nav: PageModel["nav"];
  frame: FrameBox;
  docFile: string;
  selectedKey: string | null;
  hoverKey: string | null;
  onHover: (key: string | null) => void;
  onSelect: (key: string) => void;
}

function toCanvas(r: Rect, f: FrameBox): Rect {
  const x1 = Math.max(f.left, f.left + r.x * f.scale);
  const y1 = Math.max(f.top, f.top + r.y * f.scale);
  const x2 = Math.min(f.left + f.width, f.left + (r.x + r.w) * f.scale);
  const y2 = Math.min(f.top + f.height, f.top + (r.y + r.h) * f.scale);
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

export function Overlay({ staged, nav, frame, docFile, selectedKey, hoverKey, onHover, onSelect }: Props) {
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [heights, setHeights] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    let changed = false;
    for (const s of staged) {
      const h = cardRefs.current.get(s.annotation.key)?.offsetHeight ?? 0;
      next[s.annotation.key] = h;
      if (heights[s.annotation.key] !== h) changed = true;
    }
    if (changed) setHeights(next);
  });

  const leftX = frame.left - GUTTER - CARD_WIDTH;
  const rightX = frame.left + frame.width + GUTTER;
  const roomy = leftX >= 8;

  const items = staged.map((s) => {
    const el = toCanvas(s.hit.rect, frame);
    const side: "left" | "right" = s.hit.rect.x + s.hit.rect.w / 2 < frame.innerWidth / 2 ? "left" : "right";
    return { ...s, el, side, key: s.annotation.key, tone: toneOf(s.annotation.type) };
  });

  const tops = new Map<string, number>();
  for (const side of ["left", "right"] as const) {
    const col = items
      .filter((i) => i.side === side)
      .map((i) => ({ key: i.key, targetY: i.el.y + Math.min(i.el.h, 24) / 2 - HEAD_Y, height: heights[i.key] || 96 }));
    layoutColumn(col, { top: frame.top, bottom: frame.top + frame.height, gap: 10 }).forEach((v, k) => tops.set(k, v));
  }

  const active = items.find((i) => i.key === hoverKey) ?? items.find((i) => i.key === selectedKey);

  return (
    <div className="pk-overlay">
      <svg className="pk-lines" width="100%" height="100%">
        {roomy &&
          items.map((i) => {
            const top = tops.get(i.key) ?? 0;
            const cx = i.side === "left" ? leftX + CARD_WIDTH : rightX;
            const cy = top + HEAD_Y;
            const ex = i.side === "left" ? i.el.x : i.el.x + i.el.w;
            const ey = i.el.y + Math.min(i.el.h, 24) / 2;
            const dx = (ex - cx) * 0.5;
            const emphasized = i.key === hoverKey || i.key === selectedKey;
            return (
              <path
                key={i.key}
                d={`M${cx},${cy} C${cx + dx},${cy} ${ex - dx},${ey} ${ex},${ey}`}
                className={`pk-line pk-stroke-${i.tone}${emphasized ? " is-active" : ""}`}
              />
            );
          })}
      </svg>

      {/* 本版有变化的元素常驻虚线框，提醒研发这里要动 */}
      {items
        .filter((i) => i.annotation.change)
        .map((i) => (
          <div
            key={i.key}
            className={`pk-change-outline ${changeClass(i.annotation.change)}`}
            style={{ left: i.el.x - 2, top: i.el.y - 2, width: i.el.w + 4, height: i.el.h + 4 }}
          />
        ))}

      {/* 侧栏入口：只在入口右侧贴小标签，点了跳到对应章节 */}
      {nav.map(({ annotation: a, hit }) => {
        const el = toCanvas(hit.rect, frame);
        return (
          // 缩放后一行不到 16px 时只放圆点，避免文字叠在一起
          <button
            key={a.key}
            className={`pk-nav-mark ${changeClass(a.change)}${el.h < 16 ? " is-dot" : ""}`}
            style={{ left: el.x + el.w - 4, top: el.y + el.h / 2 }}
            title={`${a.title}：${a.body}`}
            aria-label={`${a.title}，本章${a.change}`}
            onClick={() => onSelect(a.key)}
          >
            {el.h < 16 ? null : a.change}
          </button>
        );
      })}

      {active && (
        <div
          className={`pk-highlight pk-border-${active.tone}`}
          style={{ left: active.el.x - 3, top: active.el.y - 3, width: active.el.w + 6, height: active.el.h + 6 }}
        />
      )}

      {items.map((i) => (
        <span
          key={i.key}
          className={`pk-marker ${changeClass(i.annotation.change)}`}
          style={{
            left: (i.side === "left" ? i.el.x : i.el.x + i.el.w) - 9,
            top: i.el.y - 9,
          }}
        >
          <NumberBadge n={i.number} tone={i.tone} />
        </span>
      ))}

      {roomy &&
        items.map((i) => (
          <div
            key={i.key}
            ref={(node) => {
              if (node) cardRefs.current.set(i.key, node);
              else cardRefs.current.delete(i.key);
            }}
            className={`pk-card pk-card-${i.tone} ${changeClass(i.annotation.change)}${i.key === selectedKey ? " is-selected" : ""}`}
            style={{ left: i.side === "left" ? leftX : rightX, top: tops.get(i.key) ?? 0, width: CARD_WIDTH }}
            onMouseEnter={() => onHover(i.key)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(i.key)}
          >
            <div className="pk-card-head">
              <NumberBadge n={i.number} tone={i.tone} />
              <TypeChip type={i.annotation.type} />
              <ChangeChip change={i.annotation.change} />
              <span className={`pk-card-title pk-text-${i.tone}`}>{i.annotation.title}</span>
            </div>
            {i.annotation.body && (
              <div className="pk-card-body">
                <Markdown source={i.annotation.body} docFile={docFile} compact />
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
