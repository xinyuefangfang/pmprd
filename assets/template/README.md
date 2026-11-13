# 可交互原型 + PRD 脱敏模板

Node.js 22.18+。安装依赖后即可独立运行，不需要后端、数据库、账号或 API Key。

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 7790
```

打开 `http://127.0.0.1:7790/prd.html#/projects`：左边是可操作原型，右边是中文 PRD/Dev Spec，顶部显示版本。`/projects` 单独显示原型。

默认 PRD 为空。试用批注：`npm run demo:annotations`，切换顶部“标注”；点击右侧说明可定位对应元素。`npm run demo:baseline` 恢复空白。注意这两个演示命令会覆盖 `requirements/product/` 的两份文档，开始写自己的需求后不要再运行。

## 怎么用在自己的产品

请让编码 Agent 阅读随包 Skill，先把现有产品前端复制到独立目录、替换成假数据，再合并本模板外壳。不要用本模板的演示列表替换真实页面。

- `src/`：通用演示页面和内存数据，不包含真实产品代码。
- `prd-kit/`：路由感知、编号、引线、元素定位、文档侧栏与校验。
- `requirements/product/`：本期 PRD 与 Dev Spec，默认空白。
- `examples/annotated/`：中文批注语法示例，不是业务需求。
- `baseline.json`：原型版本与源 revision。
- `prd.config.ts`：需求路径、文档、原型入口和源码目录。

检查：`npm run check`、`npm test`、`npm run validate:prd`、`npm run build`。构建产物 `dist/` 同时包含原型与 PRD，路由需静态托管的 SPA fallback；发布不是此模板的自动行为。

数据只存在内存，刷新重置。这里的批注是 Agent 维护 Markdown 与 DOM 锚点后生成的，不是在线评论或多人协作服务。第三方依赖遵循其各自许可；本模板未附带原产品品牌、业务资产或许可授权。
