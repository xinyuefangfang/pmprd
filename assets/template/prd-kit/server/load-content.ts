// 读取需求目录下的文档，生成 PrdContent。vite 插件和命令行校验共用。

import fs from "node:fs";
import path from "node:path";
import { extractImages, resolveDocPath } from "../parser/parse-prd.ts";
import type { PrdConfig, PrdContent } from "../types.ts";

export const FILES_BASE = "__prd/files/";

export function requirementDir(root: string, config: PrdConfig): string {
  return path.resolve(root, config.requirement);
}

export function docPaths(root: string, config: PrdConfig): string[] {
  const dir = requirementDir(root, config);
  return config.docs.map((d) => path.join(dir, d.file));
}

/** 文档中引用的、位于需求目录内的图片（相对需求目录） */
export function referencedImages(content: PrdContent): string[] {
  const out = new Set<string>();
  for (const doc of content.docs) {
    if (!doc.source) continue;
    for (const ref of extractImages(doc.source)) out.add(resolveDocPath(doc.file, ref));
  }
  return [...out];
}

export function loadContent(root: string, config: PrdConfig): PrdContent {
  const dir = requirementDir(root, config);
  const docs = config.docs.map((d) => {
    const file = path.join(dir, d.file);
    return { ...d, source: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null };
  });
  const content: PrdContent = {
    requirement: config.requirement,
    appEntry: config.appEntry,
    docs,
    missingImages: [],
    filesBase: FILES_BASE,
  };
  content.missingImages = referencedImages(content).filter((p) => !fs.existsSync(path.join(dir, p)));
  return content;
}

/** 需求目录内的安全路径；越界返回 null */
export function safeRequirementFile(root: string, config: PrdConfig, rel: string): string | null {
  const dir = requirementDir(root, config);
  const file = path.resolve(dir, rel);
  return file.startsWith(dir + path.sep) ? file : null;
}
