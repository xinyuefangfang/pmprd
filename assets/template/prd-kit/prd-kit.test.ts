// prd-kit 纯函数测试。跑：node --experimental-strip-types prd-kit/prd-kit.test.ts

import { layoutColumn } from "./overlay/layout.ts";
import { buildPageModel } from "./model/page-model.ts";
import { parsePrd, resolveDocPath, stripSectionAttrs } from "./parser/parse-prd.ts";
import { matchRoute } from "./parser/route.ts";
import { buildChapterPackets } from "./model/chapter-packet.ts";
import type { AnchorHit, FrameSnapshot, PrdContent } from "./types.ts";

let failed = 0;
function check(name: string, cond: boolean): void {
  if (!cond) failed++;
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}`);
}

const SAMPLE = `# Agent Builder PRD

最后更新：2026-10-13

## 1. 概述

正文。

## 3. Agents 页面 {route=/agent-studio}

列表使用统一搜索。

### 批注

- [规则] 搜索框 {#agents.search}
  忽略大小写和两端空白。

  不显示 Mine / Others。
- [状态] 空态 {#agents.list}
  ![空态](assets/annotations/agents-empty.png)
- [规则] Default Agent 不计入列表数量。

### 3.1 卡片

\`\`\`text
- [规则] 代码块里的不是批注 {#fake}
\`\`\`

## 4. 详情 {route=/agent-studio/:agentId route=/agent-studio/create/:id}

### 批注

- [异常] 未保存离开 {#agent-detail.leave}
- [规则] 重复 {#agents.search}
`;

console.log("parsePrd");
const prd = parsePrd(SAMPLE);
check("前言在第一个 ## 之前", prd.preamble.startsWith("# Agent Builder PRD"));
check("三个章节", prd.sections.length === 3);
const s3 = prd.sections[1];
check("章节标题去掉属性", s3.title === "3. Agents 页面");
check("章节路由", s3.routes.join() === "/agent-studio");
check("多个 route 属性", prd.sections[2].routes.length === 2);
check("三条批注", s3.annotations.length === 3);
const search = s3.annotations[0];
check("类型", search.type === "规则");
check("锚点", search.anchor === "agents.search");
check("标题去掉锚点", search.title === "搜索框");
check("正文保留空行", search.body === "忽略大小写和两端空白。\n\n不显示 Mine / Others。");
check("图片", s3.annotations[1].images[0] === "assets/annotations/agents-empty.png");
check("页面级批注无锚点", s3.annotations[2].anchor === null && s3.annotations[2].key === "s2#3");
check("批注区不进正文", !s3.prose.includes("忽略大小写"));
check("### 子标题回到正文", s3.prose.includes("### 3.1 卡片"));
check("代码块里不解析批注", !prd.sections.some((s) => s.annotations.some((a) => a.anchor === "fake")));
check("重复锚点", prd.duplicates.join() === "agents.search");

console.log("变化标记");
const changed = parsePrd(`## 7. Library {route=/skills change=新增}

### 批注

- [规则][改动] 上传 {#lib.upload}
- [删除][交互] 旧入口 {#lib.old}
- [新增] 无类型 {#lib.new}
- [规则] 无标记 {#lib.plain}
`);
const lib = changed.sections[0];
check("章节变化标记", lib.change === "新增" && lib.routes.join() === "/skills");
check("类型在前", lib.annotations[0].type === "规则" && lib.annotations[0].change === "改动");
check("标记在前", lib.annotations[1].type === "交互" && lib.annotations[1].change === "删除");
check("只有标记没有类型", lib.annotations[2].type === null && lib.annotations[2].change === "新增");
check("没有标记", lib.annotations[3].change === null && lib.annotations[3].title === "无标记");
check("没有属性的章节", prd.sections[0].change === null);

console.log("resolveDocPath");
check("prd.md 同级", resolveDocPath("prd.md", "assets/a.png") === "assets/a.png");
check("子目录文档", resolveDocPath("assets/verification.md", "./a.png") === "assets/a.png");
check("上级目录", resolveDocPath("assets/verification.md", "../b.png") === "b.png");

console.log("matchRoute");
check("精确匹配", matchRoute("/agent-studio", "/agent-studio"));
check("尾斜杠", matchRoute("/agent-studio", "/agent-studio/"));
check("参数", matchRoute("/agent-studio/:agentId", "/agent-studio/a1"));
check("段数不同不匹配", !matchRoute("/agent-studio", "/agent-studio/a1"));
check("通配", matchRoute("/chat/*", "/chat/x/y"));
check("忽略查询串", matchRoute("/marketplace", "/marketplace?tab=api"));

console.log("buildPageModel");
const hit = (id: string, y: number, visible = true): AnchorHit => ({
  id,
  rect: { x: 10, y, w: 100, h: 20 },
  visible,
  count: 1,
});
const frame = (pathname: string, anchors: AnchorHit[]): FrameSnapshot => ({
  ready: true,
  path: pathname,
  pathname,
  viewport: { w: 1280, h: 800 },
  anchors,
  navLinks: [],
});
const m = buildPageModel(prd, frame("/agent-studio", [hit("agents.list", 200), hit("agents.search", 100), hit("x.unknown", 10)]));
check("路由章节", m.routeSections.map((s) => s.id).join() === "s2");
check("侧栏定位到路由章节", m.activeSectionId === "s2");
check("按位置编号", m.staged[0].annotation.anchor === "agents.search" && m.staged[0].number === 1);
check("页面级批注", m.pageLevel.length === 1);
check("缺少说明", m.undocumented.join() === "x.unknown");
const dialog = buildPageModel(
  prd,
  frame("/agent-studio/a1", [hit("agents.search", 100, false), hit("agent-detail.leave", 300)]),
);
check("聚合：不同章节的批注都上舞台", dialog.staged.some((s) => s.annotation.anchor === "agent-detail.leave"));
check("不可见元素进入本页其他批注", dialog.others.some((o) => o.annotation.anchor === "agents.search" && o.inDom));
const none = buildPageModel(prd, frame("/home", [hit("agent-detail.leave", 50)]));
check("无路由章节时按第一条批注定位", none.activeSectionId === "s3");

console.log("侧栏入口自动标注");
const navLink = (path: string, label: string, y: number, visible = true) => ({
  path,
  label,
  rect: { x: 0, y, w: 200, h: 36 },
  visible,
});
const navFrame = {
  ...frame("/", []),
  navLinks: [
    navLink("/skills", "Skills", 300),
    navLink("/scheduled", "Scheduled", 400),
    navLink("/connectors", "Connectors", 340, false),
  ],
};
const nav = buildPageModel(changed, navFrame);
check("标了变化的章节入口只出轻量标记", nav.staged.length === 0 && nav.nav.length === 1 && nav.nav[0].annotation.key === "nav:/skills");
check("入口继承章节标记", nav.nav[0].annotation.change === "新增" && nav.nav[0].annotation.sectionId === "s1");
check("没有对应章节的入口不标注", !nav.nav.some((s) => s.annotation.key === "nav:/scheduled"));
check("不可见入口不标注", !nav.nav.some((s) => s.annotation.key === "nav:/connectors"));
check("未标变化的章节不标注入口", buildPageModel(prd, { ...frame("/", []), navLinks: [navLink("/agent-studio", "Agents", 10)] }).nav.length === 0);

console.log("layoutColumn");
const pos = layoutColumn(
  [
    { key: "a", targetY: 100, height: 80 },
    { key: "b", targetY: 120, height: 80 },
    { key: "c", targetY: 900, height: 80 },
  ],
  { top: 0, bottom: 600, gap: 10 },
);
check("对齐目标", pos.get("a") === 100);
check("避让重叠", pos.get("b") === 190);
check("超出栏底上推", pos.get("c") === 520);
const crowded = layoutColumn(
  [
    { key: "a", targetY: 0, height: 300 },
    { key: "b", targetY: 0, height: 300 },
  ],
  { top: 0, bottom: 400, gap: 10 },
);
check("放不下时向下溢出且不重叠", crowded.get("a") === 0 && crowded.get("b") === 310);

console.log("复制章节给 AI");
const exportPrd = `# PRD
## Home {route=/ change=改动 spec=home,templates}
Home 正文。
### 批注
- [规则][新增] 不自动运行 {#home.send}
  用户确认后发送。
\`\`\`md
## 代码块中的标题
\`\`\`
## Other {spec=missing}
不应混入 Home。`;
const exportDev = `# Dev Spec
## 数据结构 {spec=templates}
模板字段。
## 视觉实现 {spec=home,templates}
Home 样式。
## 无关章节 {spec=other}
无关实现。`;
const exportContent: PrdContent = {
  requirement: "../01-requirements/test", appEntry: "/", filesBase: "__prd/files/", missingImages: [],
  docs: [
    { id: "prd", title: "PRD", file: "prd.md", annotations: true, source: exportPrd },
    { id: "dev", title: "Dev Spec", file: "dev-spec.md", source: exportDev },
  ],
};
const exportParsed = parsePrd(exportPrd);
const packets = buildChapterPackets(exportContent, exportParsed);
const homePacket = packets.get("s1")!;
check("解析明确章节绑定", exportParsed.sections[0].specs.join() === "home,templates");
check("保留原始批注、变化标记与代码", homePacket.text.includes("[规则][新增]") && homePacket.text.includes("## 代码块中的标题"));
check("仅复制当前 PRD 章节", homePacket.text.includes("Home 正文") && !homePacket.text.includes("不应混入 Home"));
check("绑定多个 Dev Spec 且不重复", homePacket.specCount === 2 && homePacket.text.match(/Home 样式。/g)?.length === 1);
check("不混入无关开发说明", !homePacket.text.includes("无关实现"));
check("按原文顺序输出开发说明", homePacket.text.indexOf("模板字段") < homePacket.text.indexOf("Home 样式"));
check("携带版本目录与路由", homePacket.text.includes(exportContent.requirement) && homePacket.text.includes("原型路由：/"));
check("完整绑定无警告", homePacket.warning === null);
check("无效绑定明确提示", packets.get("s2")!.warning?.includes("missing") === true);
const noDev = buildChapterPackets({ ...exportContent, docs: exportContent.docs.slice(0, 1) }, exportParsed).get("s1")!;
check("缺失 Dev Spec 仍可复制 PRD", noDev.specCount === 0 && noDev.warning?.includes("文档缺失") === true && noDev.text.includes("Home 正文"));
const unbound = buildChapterPackets(exportContent, parsePrd(exportPrd.replace(" spec=home,templates", ""))).get("s1")!;
check("未绑定章节不猜测或复制全文", unbound.specCount === 0 && unbound.warning?.includes("尚未绑定") === true);
const partial = buildChapterPackets(exportContent, parsePrd(exportPrd.replace("spec=home,templates", "spec=home,missing"))).get("s1")!;
check("部分绑定保留已匹配开发说明并报告缺失", partial.specCount === 1 && partial.warning?.includes("missing") === true);
const displayedSpec = stripSectionAttrs(exportDev + "\n```md\n## 示例 {spec=fake}\n```");
check("开发说明显示隐藏绑定字段", !displayedSpec.includes("数据结构 {spec=") && displayedSpec.includes("模板字段。"));
check("代码块中的标题不被改写", displayedSpec.includes("## 示例 {spec=fake}"));

if (failed) {
  console.error(`\n${failed} 项失败`);
  process.exit(1);
}
console.log("\n全部通过");
