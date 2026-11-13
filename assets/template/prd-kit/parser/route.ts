// 章节路由匹配：/agent-studio/:agentId 匹配任意非空段，末尾 * 匹配剩余路径。

function segments(path: string): string[] {
  return path.split(/[?#]/)[0].split("/").filter(Boolean);
}

export function matchRoute(pattern: string, pathname: string): boolean {
  const p = segments(pattern);
  const s = segments(pathname).map((seg) => {
    try {
      return decodeURIComponent(seg);
    } catch {
      return seg;
    }
  });
  for (let i = 0; i < p.length; i++) {
    if (p[i] === "*") return true;
    if (i >= s.length) return false;
    if (p[i].startsWith(":")) continue;
    if (p[i] !== s[i]) return false;
  }
  return p.length === s.length;
}
