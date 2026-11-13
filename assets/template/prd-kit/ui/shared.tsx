import { createContext, memo, useContext, useEffect, useMemo, type ReactNode } from "react";
import { Streamdown } from "streamdown";
import { fileUrl } from "../app/use-content.ts";
import type { Change, PrdContent } from "../types.ts";

export interface PrdKitContext {
  content: PrdContent;
  openImage: (src: string) => void;
  /** 文档内链接指向已配置的文档时切换 Tab，返回是否已处理 */
  openDoc: (file: string) => boolean;
}

export const KitContext = createContext<PrdKitContext | null>(null);

export function useKit(): PrdKitContext {
  const ctx = useContext(KitContext);
  if (!ctx) throw new Error("KitContext missing");
  return ctx;
}

export type Tone = "red" | "blue" | "amber" | "gray";

/** 规则、异常为红色；状态、数据为蓝色；待定为黄色 */
export function toneOf(type: string | null): Tone {
  if (!type) return "gray";
  if (/规则|异常|注意|校验/.test(type)) return "red";
  if (/状态|数据|交互/.test(type)) return "blue";
  if (/待定|问题|TODO/i.test(type)) return "amber";
  return "gray";
}

export function TypeChip({ type }: { type: string | null }) {
  if (!type) return null;
  return <span className={`pk-chip pk-tone-${toneOf(type)}`}>{type}</span>;
}

const CHANGE_CLASS: Record<Change, string> = { 新增: "new", 改动: "changed", 删除: "removed" };
export function changeClass(change: Change | null): string {
  return change ? `pk-change-${CHANGE_CLASS[change]}` : "";
}
/** 本版新增 / 改动 / 删除，提醒研发这里要动 */
export function ChangeChip({ change }: { change: Change | null }) {
  if (!change) return null;
  return (
    <span className={`pk-change ${changeClass(change)}`} title={`本版${change}，研发需要处理`}>
      {change}
    </span>
  );
}

export function NumberBadge({ n, tone }: { n: number; tone: Tone }) {
  return <span className={`pk-num pk-tone-${tone}`}>{n}</span>;
}

const RELATIVE_REF = /(!?\[[^\]]*\]\(\s*<?)([^)\s>]+)/g;

/** Streamdown 会拦截无法解析的相对链接，渲染前把相对路径改成需求目录文件的绝对地址 */
function absolutizeRefs(source: string, content: PrdContent, docFile: string): string {
  return source.replace(RELATIVE_REF, (all, head: string, ref: string) =>
    /^([a-z][a-z0-9+.-]*:|#|\/)/i.test(ref) ? all : head + new URL(fileUrl(content, docFile, ref), location.href).href,
  );
}

/** 绝对地址 → 需求目录内的相对路径；不是需求目录文件时返回 null */
function requirementPath(content: PrdContent, href: string): string | null {
  const base = new URL(content.filesBase, location.href).href;
  if (!href.startsWith(base)) return null;
  return decodeURIComponent(href.slice(base.length).split("#")[0]);
}

export const Markdown = memo(function Markdown({
  source,
  docFile,
  compact,
}: {
  source: string;
  docFile: string;
  compact?: boolean;
}) {
  const { content, openImage, openDoc } = useKit();
  const components = useMemo(
    () => ({
      img: ({ src, alt }: { src?: string | Blob; alt?: string }) => {
        const url = typeof src === "string" ? src : "";
        return (
          <img
            className="pk-md-img"
            src={url}
            alt={alt ?? ""}
            loading="lazy"
            onClick={(e) => {
              e.stopPropagation();
              openImage(url);
            }}
          />
        );
      },
      a: ({ href, children }: { href?: string; children?: ReactNode }) => {
        const local = href ? requirementPath(content, href) : null;
        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              // 指向已配置文档时切换侧栏 Tab，其他文件照常新窗口打开
              if (local && openDoc(local)) e.preventDefault();
            }}
          >
            {children}
          </a>
        );
      },
    }),
    [content, openImage, openDoc],
  );
  const prepared = useMemo(() => absolutizeRefs(source, content, docFile), [source, content, docFile]);
  return (
    <Streamdown
      mode="static"
      controls={false}
      linkSafety={{ enabled: false }}
      components={components}
      className={compact ? "pk-md pk-md-compact" : "pk-md"}
    >
      {prepared}
    </Streamdown>
  );
});

export function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, onClose]);
  if (!src) return null;
  return (
    <div className="pk-lightbox" onClick={onClose} role="dialog" aria-label="查看图片">
      <img src={src} alt="" />
    </div>
  );
}
