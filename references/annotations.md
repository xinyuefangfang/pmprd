# 批注怎么用

这套能力是“编码 Agent 修改 Markdown 和页面锚点，评审外壳负责显示”，不是在线多人评论系统，也不是任意点页面自动保存批注。

## 最小批注

组件里的真实 DOM：

```tsx
<button data-prd="projects.create">Create project</button>
```

`requirements/product/prd.md`：

```md
## 项目页 {route=/projects change=改动 spec=projects}

本期只调整创建入口。

### 批注

- [交互][改动] 创建项目 {#projects.create}
  点击打开弹窗；取消不保存，提交后加入列表。
```

`dev-spec.md` 按稳定 ID 关联：

```md
## 项目实现 {spec=projects}

仅修改前端；演示数据保存在内存，刷新重置。
```

## 已有能力

- 原型/标注模式切换，原型模式不挡交互。
- 元素锚点对应编号和引线，右栏点击批注定位元素。
- 路由绑定章节，支持 `/projects/:id`、末尾 `*` 和多个 route。
- `[新增]`、`[改动]`、`[删除]` 变化标记；无锚点的页面级说明。
- PRD 与 Dev Spec 分页；复制当前页或本章给 AI。
- 缺失锚点、重复锚点、缺少说明与图片/文档缺失的校验。
- 顶部版本号、设备宽度、缩放、收起文档；保存 Markdown 后开发模式刷新内容。

## 验证和边界

`npm run validate:prd` 校验源码里的字面量锚点，不是所有动态状态的证明。弹窗需先打开，动态 DOM 需在浏览器检查。`npm test` 验证解析、路由、布局和本地数据行为。

默认空白是 Baseline 状态，不是批注能力缺失。示例批注只放在 `examples/annotated/`，用演示命令载入。已经写了业务需求后不要运行重置命令覆盖文档。
