import { useEffect, useState } from "react";
import { resolveDocPath } from "../parser/parse-prd.ts";
import type { PrdContent } from "../types.ts";

export function usePrdContent(): { content: PrdContent | null; error: string | null } {
  const [state, setState] = useState<{ content: PrdContent | null; error: string | null }>({
    content: null,
    error: null,
  });
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("__prd/content.json", { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error(`读取 __prd/content.json 失败（HTTP ${r.status}），请用 prd-kit/vite.config.ts 启动`);
          return r.json() as Promise<PrdContent>;
        })
        .then((content) => alive && setState({ content, error: null }))
        .catch((e: Error) => alive && setState((s) => ({ ...s, error: e.message })));
    load();
    // 需求目录里的文档改动后实时刷新（其他人正在改 prd.md 时也能看到）
    import.meta.hot?.on("prd:content", load);
    return () => {
      alive = false;
      import.meta.hot?.off("prd:content", load);
    };
  }, []);
  return state;
}

/** markdown 中的相对路径 → 可访问的 URL；外链和绝对路径原样返回 */
export function fileUrl(content: PrdContent, docFile: string, ref: string): string {
  if (/^(https?:|data:|\/|#)/.test(ref)) return ref;
  return content.filesBase + resolveDocPath(docFile, ref).split("/").map(encodeURIComponent).join("/");
}
