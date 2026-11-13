// PRD 模式的 vite 配置：继承原型自己的 vite.config.ts，只追加 prd-kit 需要的部分，
// 不修改原型配置。在原型项目根目录运行：
//   pnpm exec vite --config prd-kit/vite.config.ts          开发，http://localhost:7778/prd.html
//   pnpm exec vite build --config prd-kit/vite.config.ts    构建，产物同时包含原型和 prd.html

import path from "node:path";
import { defineConfig, mergeConfig } from "vite";
import base from "../vite.config.ts";
import prdConfig from "../prd.config.ts";
import { prdContentPlugin } from "./server/content-plugin.ts";

const root = path.resolve(import.meta.dirname, "..");
// 临时预览其他需求目录：PRD_REQUIREMENT=prd-kit/example pnpm exec vite --config prd-kit/vite.config.ts
const config = process.env.PRD_REQUIREMENT ? { ...prdConfig, requirement: process.env.PRD_REQUIREMENT } : prdConfig;

export default mergeConfig(
  base,
  defineConfig({
    root,
    // 独立的依赖缓存，避免和原型自己的 dev server 互相触发重新预构建
    cacheDir: path.resolve(root, "node_modules/.vite-prd"),
    plugins: [prdContentPlugin({ root, config })],
    server: { port: 7778, strictPort: true },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(root, "index.html"),
          prd: path.resolve(root, "prd.html"),
        },
      },
    },
  }),
);
