// prd-kit 的公共类型。原型 app 不引用这里的任何东西，只遵守两个约定：
// 元素上的 data-prd 锚点，以及 prd.md 章节上的 {route=...}。

export interface PrdDocConfig {
  id: string;
  title: string;
  /** 相对需求目录的路径 */
  file: string;
  /** 是否从这份文档解析章节路由与批注（通常只有 prd.md） */
  annotations?: boolean;
}

export interface PrdConfig {
  /** 当前版本的需求目录，相对原型项目根目录 */
  requirement: string;
  docs: PrdDocConfig[];
  /** 舞台里加载的原型入口 */
  appEntry: string;
  /** 命令行校验扫描 data-prd 的源码目录，相对原型项目根目录 */
  srcDir: string;
}

/** 开发服务器 / 构建产物里的 __prd/content.json */
export interface PrdContent {
  requirement: string;
  appEntry: string;
  docs: Array<PrdDocConfig & { source: string | null }>;
  /** 引用了但不存在的图片，相对需求目录 */
  missingImages: string[];
  /** 需求目录内文件的访问前缀（相对 prd.html） */
  filesBase: string;
}

/** 本版相对线上的变化，研发据此判断哪些地方要动 */
export type Change = "新增" | "改动" | "删除";

export interface Annotation {
  /** 唯一 key：有锚点用锚点，否则用 章节 id + 序号 */
  key: string;
  anchor: string | null;
  type: string | null;
  change: Change | null;
  title: string;
  /** 正文 markdown，已去掉缩进 */
  body: string;
  /** 正文中引用的图片原始路径 */
  images: string[];
  sectionId: string;
  line: number;
}

export interface Section {
  id: string;
  title: string;
  routes: string[];
  /** PRD 与 Dev Spec 章节共用的稳定关联标识 */
  specs: string[];
  change: Change | null;
  line: number;
  /** 章节正文 markdown（不含批注区），标题行已去掉属性 */
  prose: string;
  annotations: Annotation[];
}

export interface ParsedPrd {
  /** 第一个 ## 之前的内容 */
  preamble: string;
  sections: Section[];
  /** 重复定义的锚点 */
  duplicates: string[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AnchorHit {
  id: string;
  /** iframe 视口坐标（未缩放） */
  rect: Rect;
  visible: boolean;
  count: number;
}

/** 原型导航（data-prd-nav 容器）里的一条链接 */
export interface NavHit {
  /** 链接的 pathname */
  path: string;
  label: string;
  rect: Rect;
  visible: boolean;
}

export interface FrameSnapshot {
  ready: boolean;
  /** pathname + search */
  path: string;
  pathname: string;
  viewport: { w: number; h: number };
  anchors: AnchorHit[];
  navLinks: NavHit[];
}
