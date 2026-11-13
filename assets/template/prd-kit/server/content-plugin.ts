// 开发时：/__prd/content.json 实时读取需求目录，/__prd/files/* 提供图片，文档变化推送 prd:content。
// 构建时：把 content.json 和被引用的图片一起输出到 dist/__prd/。
// 用 fetch 而不是虚拟模块，避免原型自己的 dev server 在依赖预扫描 prd.html 时解析失败。

import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import type { PrdConfig } from "../types.ts";
import {
  FILES_BASE,
  docPaths,
  loadContent,
  referencedImages,
  requirementDir,
  safeRequirementFile,
} from "./load-content.ts";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

export function prdContentPlugin(opts: { root: string; config: PrdConfig }): Plugin {
  const { root, config } = opts;
  return {
    name: "prd-kit:content",
    configureServer(server) {
      const docs = docPaths(root, config);
      const dir = requirementDir(root, config);
      server.watcher.add([...docs, dir]);
      const notify = (file: string) => {
        if (file.startsWith(dir)) server.ws.send({ type: "custom", event: "prd:content" });
      };
      server.watcher.on("change", notify);
      server.watcher.on("add", notify);
      server.watcher.on("unlink", notify);

      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? "").split("?")[0]);
        if (url === "/__prd/content.json") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(loadContent(root, config)));
          return;
        }
        if (url.startsWith("/" + FILES_BASE)) {
          const file = safeRequirementFile(root, config, url.slice(FILES_BASE.length + 1));
          if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.statusCode = 404;
            res.end();
            return;
          }
          res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream");
          res.setHeader("Cache-Control", "no-cache");
          fs.createReadStream(file).pipe(res);
          return;
        }
        next();
      });
    },
    generateBundle() {
      const content = loadContent(root, config);
      this.emitFile({ type: "asset", fileName: "__prd/content.json", source: JSON.stringify(content) });
      for (const rel of referencedImages(content)) {
        const file = safeRequirementFile(root, config, rel);
        if (!file || !fs.existsSync(file)) continue;
        this.emitFile({ type: "asset", fileName: FILES_BASE + rel, source: fs.readFileSync(file) });
      }
    },
  };
}
