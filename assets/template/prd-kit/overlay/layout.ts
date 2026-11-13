// 批注卡片在一栏内的纵向排布：尽量对齐目标元素，按顺序避让，不越过栏底时整体上推。

export interface ColumnItem {
  key: string;
  /** 希望卡片顶部对齐的 y */
  targetY: number;
  height: number;
}

export function layoutColumn(
  items: ColumnItem[],
  opts: { top: number; bottom: number; gap: number },
): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.targetY - b.targetY);
  const tops: number[] = [];
  let cursor = opts.top;
  for (const item of sorted) {
    const top = Math.max(item.targetY, cursor);
    tops.push(top);
    cursor = top + item.height + opts.gap;
  }
  // 超出栏底时从下往上推，但不越过栏顶（放不下时允许向下溢出）
  let limit = opts.bottom;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const maxTop = limit - sorted[i].height;
    if (tops[i] > maxTop) tops[i] = Math.max(maxTop, opts.top);
    limit = tops[i] - opts.gap;
  }
  for (let i = 1; i < sorted.length; i++) {
    const min = tops[i - 1] + sorted[i - 1].height + opts.gap;
    if (tops[i] < min) tops[i] = min;
  }
  return new Map(sorted.map((item, i) => [item.key, tops[i]]));
}
