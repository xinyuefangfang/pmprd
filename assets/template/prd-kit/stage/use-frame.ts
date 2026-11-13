// 观察舞台 iframe（与外壳同源）：当前路由 + 页面上所有 data-prd 元素的位置和可见性，
// 以及 data-prd-nav 容器里导航链接的位置（用于按 PRD 章节自动标注侧栏入口）。
// 原型不需要配合任何代码；路由用 pushState 切换也能被轮询捕获。

import { useEffect, useState } from "react";
import type { AnchorHit, FrameSnapshot, NavHit } from "../types.ts";

export const ANCHOR_ATTR = "data-prd";
export const NAV_ATTR = "data-prd-nav";

const EMPTY: FrameSnapshot = { ready: false, path: "", pathname: "", viewport: { w: 0, h: 0 }, anchors: [], navLinks: [] };

function frameWindow(iframe: HTMLIFrameElement | null): Window | null {
  try {
    const win = iframe?.contentWindow;
    if (!win || win.location.href === "about:blank" || !win.document.body) return null;
    return win;
  } catch {
    return null; // 跨域时不可读
  }
}

function isVisible(el: HTMLElement, r: DOMRect, vw: number, vh: number): boolean {
  if (r.width <= 0 || r.height <= 0) return false;
  if (r.bottom <= 0 || r.right <= 0 || r.top >= vh || r.left >= vw) return false;
  // 弹窗打开时 Radix 会给背景加 aria-hidden / inert，背景元素视为不可见
  if (el.closest('[aria-hidden="true"], [inert]')) return false;
  if (typeof el.checkVisibility === "function")
    return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  return true;
}

export function readFrame(iframe: HTMLIFrameElement | null): FrameSnapshot {
  const win = frameWindow(iframe);
  if (!win) return EMPTY;
  const vw = win.innerWidth;
  const vh = win.innerHeight;
  const hits = new Map<string, AnchorHit>();
  win.document.querySelectorAll<HTMLElement>(`[${ANCHOR_ATTR}]`).forEach((el) => {
    const id = el.getAttribute(ANCHOR_ATTR)?.trim();
    if (!id) return;
    const r = el.getBoundingClientRect();
    const visible = isVisible(el, r, vw, vh);
    const rect = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    const prev = hits.get(id);
    if (!prev) hits.set(id, { id, rect, visible, count: 1 });
    else {
      prev.count++;
      // 同一锚点多个实例时，贴在第一个可见实例上
      if (!prev.visible && visible) Object.assign(prev, { rect, visible });
    }
  });
  const navLinks: NavHit[] = [];
  win.document.querySelectorAll<HTMLAnchorElement>(`[${NAV_ATTR}] a[href]`).forEach((el) => {
    const url = new URL(el.getAttribute("href")!, win.location.href);
    if (url.origin !== win.location.origin) return;
    const r = el.getBoundingClientRect();
    navLinks.push({
      path: url.pathname,
      label: (el.textContent ?? "").trim() || el.getAttribute("aria-label") || url.pathname,
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      visible: isVisible(el, r, vw, vh),
    });
  });
  return {
    ready: true,
    path: win.location.pathname + win.location.search,
    pathname: win.location.pathname,
    viewport: { w: vw, h: vh },
    anchors: [...hits.values()],
    navLinks,
  };
}

export function useFrameSnapshot(iframe: HTMLIFrameElement | null): FrameSnapshot {
  const [snapshot, setSnapshot] = useState<FrameSnapshot>(EMPTY);
  useEffect(() => {
    if (!iframe) return;
    let raf = 0;
    let last = "";
    let detach = () => {};
    const measure = () => {
      raf = 0;
      const next = readFrame(iframe);
      const sig = JSON.stringify(next);
      if (sig !== last) {
        last = sig;
        setSnapshot(next);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    const attach = () => {
      detach();
      const win = frameWindow(iframe);
      if (win) {
        win.addEventListener("scroll", schedule, true);
        win.addEventListener("resize", schedule);
        win.addEventListener("popstate", schedule);
        detach = () => {
          win.removeEventListener("scroll", schedule, true);
          win.removeEventListener("resize", schedule);
          win.removeEventListener("popstate", schedule);
        };
      }
      schedule();
    };
    iframe.addEventListener("load", attach);
    attach();
    const timer = window.setInterval(schedule, 250);
    return () => {
      iframe.removeEventListener("load", attach);
      detach();
      window.clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, [iframe]);
  return snapshot;
}

/** 把锚点元素滚动到可见位置。返回 missing 表示当前页面没有这个元素 */
export function locateAnchor(iframe: HTMLIFrameElement | null, anchor: string): "visible" | "scrolled" | "missing" {
  const win = frameWindow(iframe);
  if (!win) return "missing";
  const els = [...win.document.querySelectorAll<HTMLElement>(`[${ANCHOR_ATTR}]`)].filter(
    (el) => el.getAttribute(ANCHOR_ATTR)?.trim() === anchor,
  );
  if (!els.length) return "missing";
  if (els.some((el) => isVisible(el, el.getBoundingClientRect(), win.innerWidth, win.innerHeight))) return "visible";
  els[0].scrollIntoView({ block: "center", behavior: "smooth" });
  return "scrolled";
}
