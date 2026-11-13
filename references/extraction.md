# 抽离实施说明

## 保留什么、替换什么

| 部分 | 做法 |
| --- | --- |
| 页面/交互/样式 | 从源仓库复制并保留，不凭截图重写 |
| 路由/组件库 | 保留原实现，修复独立运行所需的别名和依赖 |
| 契约/类型 | 仅带入前端需要的部分；有 schema 就用假数据通过它校验 |
| API/认证 | 在原型副本的统一入口换成本地 adapter，检查旁路客户端 |
| 写入 | 只写内存或明确约定的原型本地存储，标明刷新后是否重置 |
| 充值/授权/上传 | 本地演示，不触发实际扣费、授权或上传 |
| 外壳 | 独立的 prd.html + 同源 iframe，不侵入产品页面布局 |
| PRD | Markdown 为唯一内容源，不在侧栏硬编码第二份文案 |

## 模板接入现有 React/Vite 前端

在独立原型根目录放 `prd-kit/`、`prd.html`、`prd.config.ts`、`baseline.json` 和 `requirements/product/`。不要覆盖原有 `src/`、锁文件和 package.json；合并模板依赖与 scripts。外壳需要 React/React DOM/streamdown，开发需要 Vite/React 插件/TypeScript/Node 类型。外壳使用同源 iframe 读取 DOM，跨域嵌入不能直接定位批注。

```ts
// prd.config.ts
import type { PrdConfig } from './prd-kit/types';
export default {
  requirement: 'requirements/product',
  docs: [
    { id: 'prd', title: 'PRD', file: 'prd.md', annotations: true },
    { id: 'dev', title: 'Dev Spec', file: 'dev-spec.md' },
  ],
  appEntry: '/projects',
  srcDir: 'src',
} satisfies PrdConfig;
```

`prd-kit/vite.config.ts` 会合并根 Vite 配置并生成原型和 PRD 两个入口。根配置如果是函数/Promise、多应用或 SSR 配置，先按项目方式适配，不原样套对象合并。子路径部署需同时检查资源 base 和路由 basename，不能只验证首页。

`baseline.json` 记录版本、阶段与源 revision。它会打包到客户端，分享时不要包含私有仓库 URL、本机路径或内部账号；源 commit 是否对外保留按分享范围决定。

## 本地请求边界

最小示例在模板 `src/preview/store.ts`：只处理已知行为，其他行为报错。抽离真实项目时保留原 API 契约，在统一客户端注入 mock transport，而不是逐个页面散落假数据；原客户端若有多条通道，需要逐一替换。

假登录不等于真实登录；生成的假 Key 不可用于真实调用。不要从用户已登录浏览器提取 token 给原型。检查静态图片、字体、埋点和文档跳转是否残留公司域名，区分允许的外链与真实业务调用。

## 验收

- 源仓库与用户原有改动未被覆盖；独立输出目录可安装和构建。
- 主要页面使用原 UI；必要 mock 数据能走完交互，空态与弹窗不报错。
- 断网或后端不可用不影响本地演示；未知接口不发生产请求。
- 原型模式可操作；标注模式有编号、连线、点击定位；路由切换后右栏跟随。
- 版本显示明确；空 PRD 不会自动冒出虚构的需求。
- 交付构建、源码、运行方法和已知边界，发布线上另按用户授权执行。

## 实际遇到的坑

- 本机目录有空格时，用 `fileURLToPath(new URL(...))`，不要用 URL.pathname 当文件路径。
- 外壳 Markdown 渲染依赖 `streamdown`，只复制源前端依赖会缺它。
- 共享样式可能引用没复制的字体。模板用系统字体，不依赖外部字体请求。
- pnpm 可能需要显式允许 esbuild 构建脚本，按实际版本处理，不为消除提示安装无关服务端包。
- 批注定位只识别真实 DOM 上的 `data-prd`；组件需要透传属性。动态锚点和隐藏弹窗需浏览器实际打开验证。
