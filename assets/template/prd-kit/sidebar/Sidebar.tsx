// 文档侧栏：PRD（含批注、随页面定位章节）/ 其他文档 / 校验。

import { memo, useEffect, useMemo, useRef } from "react";
import type { PageModel } from "../model/page-model.ts";
import type { Annotation, ParsedPrd, PrdContent, Section } from "../types.ts";
import { ChangeChip, changeClass, Markdown, NumberBadge, toneOf, TypeChip } from "../ui/shared.tsx";
import { ValidatorPanel, type ValidationReport } from "../validator/ValidatorPanel.tsx";
import { buildChapterPackets, type ChapterPacket } from "../model/chapter-packet.ts";
import { CopyChapter } from "./CopyChapter.tsx";
import { stripSectionAttrs } from "../parser/parse-prd.ts";

export const VALIDATE_TAB = "__validate";

interface Props {
  content: PrdContent;
  prd: ParsedPrd;
  prdFile: string | null;
  model: PageModel;
  path: string;
  tab: string;
  onTab: (tab: string) => void;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onLocate: (a: Annotation) => void;
  report: ValidationReport;
}

export function Sidebar(props: Props) {
  const { content, prd, prdFile, model, path, tab, onTab, report } = props;
  const doc = content.docs.find((d) => d.id === tab);
  const packets = useMemo(() => buildChapterPackets(content, prd), [content, prd]);
  const currentSection = prd.sections.find((section) => section.id === model.activeSectionId);
  const currentPacket = currentSection ? packets.get(currentSection.id) : null;

  return (
    <aside className="pk-sidebar">
      <nav className="pk-tabs">
        {content.docs.map((d) => (
          <button key={d.id} className={d.id === tab ? "is-on" : ""} onClick={() => onTab(d.id)}>
            {d.title}
          </button>
        ))}
        <button className={tab === VALIDATE_TAB ? "is-on" : ""} onClick={() => onTab(VALIDATE_TAB)}>
          校验{report.issueCount > 0 && <span className="pk-tab-count">{report.issueCount}</span>}
        </button>
      </nav>

      {currentPacket && currentSection && (doc?.annotations || doc?.id === "dev") && (
        <div className="pk-copy-current">
          <CopyChapter key={currentSection.id} packet={currentPacket} label="复制当前页给 AI" title={currentSection.title} />
        </div>
      )}

      {tab === VALIDATE_TAB ? (
        <div className="pk-scroll">
          <ValidatorPanel report={report} onLocate={props.onLocate} />
        </div>
      ) : doc?.annotations && prdFile ? (
        <PrdView {...props} prdFile={prdFile} packets={packets} />
      ) : doc ? (
        <div className="pk-scroll pk-doc">
          {doc.source == null ? (
            <p className="pk-empty">找不到 {content.requirement}/{doc.file}</p>
          ) : (
            <Markdown source={doc.id === "dev" ? stripSectionAttrs(doc.source) : doc.source} docFile={doc.file} />
          )}
        </div>
      ) : null}

      <footer className="pk-sidebar-foot">
        <span title={content.requirement}>{content.requirement.split("/").pop()}</span>
        <span>{path || "—"}</span>
      </footer>
    </aside>
  );
}

function PrdView({ prd, prdFile, model, selectedKey, onSelect, onLocate, packets }: Props & {
  prdFile: string;
  packets: Map<string, ChapterPacket>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = (selector: string, flash: boolean): boolean => {
    const box = scrollRef.current;
    const el = box?.querySelector<HTMLElement>(selector);
    if (!box || !el) return false;
    const top = box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top;
    box.scrollTo({ top: top - 12, behavior: "smooth" });
    if (flash) {
      el.classList.remove("is-flash");
      void el.offsetWidth;
      el.classList.add("is-flash");
    }
    return true;
  };

  // 切换页面时定位到对应章节
  useEffect(() => {
    if (model.activeSectionId) scrollTo(`[data-section="${model.activeSectionId}"]`, false);
  }, [model.activeSectionId]);

  // 在舞台上点击批注时定位到对应条目
  useEffect(() => {
    if (!selectedKey || scrollTo(`[data-ann="${CSS.escape(selectedKey)}"]`, true)) return;
    // 自动生成的侧栏入口批注没有文档条目，定位到它对应的章节
    const section = model.nav.find((s) => s.annotation.key === selectedKey)?.annotation.sectionId;
    if (section) scrollTo(`[data-section="${section}"]`, true);
  }, [selectedKey]);

  const numbers = model.staged.map((s) => `${s.annotation.key}=${s.number}`).join("|");

  return (
    <>
      <PagePanel
        model={model}
        prd={prd}
        onLocate={onLocate}
        onSelect={onSelect}
        onJump={(id) => scrollTo(`[data-section="${id}"]`, true)}
      />
      <div className="pk-scroll pk-doc" ref={scrollRef}>
        <PrdBody
          prd={prd}
          prdFile={prdFile}
          packets={packets}
          numbers={numbers}
          activeSectionId={model.activeSectionId}
          routeSectionIds={model.routeSections.map((s) => s.id).join()}
          selectedKey={selectedKey}
          onSelect={onSelect}
          onLocate={onLocate}
        />
      </div>
    </>
  );
}

/** 全文中带变化标记的章节和批注，按章节分组 */
export function collectChanges(prd: ParsedPrd): Array<{ section: Section; items: Annotation[] }> {
  return prd.sections
    .map((section) => ({ section, items: section.annotations.filter((a) => a.change) }))
    .filter((g) => g.section.change || g.items.length);
}

function PagePanel({
  model,
  prd,
  onLocate,
  onSelect,
  onJump,
}: {
  model: PageModel;
  prd: ParsedPrd;
  onLocate: (a: Annotation) => void;
  onSelect: (key: string) => void;
  onJump: (sectionId: string) => void;
}) {
  const changes = collectChanges(prd);
  const changeCount = changes.reduce((n, g) => n + (g.section.change ? 1 : 0) + g.items.length, 0);
  const pageChanges = [...model.staged.map((s) => s.annotation), ...model.others.map((o) => o.annotation)].filter(
    (a) => a.change,
  ).length;
  return (
    <section className="pk-page">
      <div className="pk-page-row">
        <span className="pk-page-label">当前页面</span>
        {model.routeSections.length ? (
          model.routeSections.map((s) => (
            <span key={s.id} className="pk-page-section">
              {s.title}
              <ChangeChip change={s.change} />
            </span>
          ))
        ) : (
          <span className="pk-muted">未绑定章节</span>
        )}
      </div>
      <div className="pk-page-stats">
        <span>舞台批注 {model.staged.length}</span>
        <span>本页其他 {model.others.length}</span>
        {pageChanges > 0 && <span className="pk-text-change">本页改动 {pageChanges}</span>}
        {model.undocumented.length > 0 && <span className="pk-text-amber">缺少说明 {model.undocumented.length}</span>}
      </div>
      {changeCount > 0 && (
        <details className="pk-others pk-changes">
          <summary>本版改动 {changeCount}</summary>
          <ul>
            {changes.map(({ section, items }) => (
              <li key={section.id} className="pk-changes-group">
                <div className="pk-changes-section">
                  <ChangeChip change={section.change} />
                  <button className="pk-others-title pk-changes-title" onClick={() => onJump(section.id)}>
                    {section.title}
                  </button>
                </div>
                {items.map((a) => (
                  <div key={a.key} className="pk-changes-item">
                    <ChangeChip change={a.change} />
                    <button className="pk-others-title pk-changes-title" onClick={() => onSelect(a.key)}>
                      {a.title}
                    </button>
                    {a.anchor && (
                      <button className="pk-link" onClick={() => onLocate(a)}>
                        定位
                      </button>
                    )}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}
      {model.others.length > 0 && (
        <details className="pk-others">
          <summary>本页其他批注</summary>
          <ul>
            {model.others.map(({ annotation: a, inDom }) => (
              <li key={a.key}>
                <TypeChip type={a.type} />
                <ChangeChip change={a.change} />
                <span className="pk-others-title">{a.title}</span>
                <button className="pk-link" onClick={() => onLocate(a)}>
                  {inDom ? "滚动定位" : "未出现"}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

const PrdBody = memo(function PrdBody({
  prd,
  prdFile,
  packets,
  numbers,
  activeSectionId,
  routeSectionIds,
  selectedKey,
  onSelect,
  onLocate,
}: {
  prd: ParsedPrd;
  prdFile: string;
  packets: Map<string, ChapterPacket>;
  numbers: string;
  activeSectionId: string | null;
  routeSectionIds: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onLocate: (a: Annotation) => void;
}) {
  const numberOf = new Map(numbers ? numbers.split("|").map((p) => p.split("=") as [string, string]) : []);
  const routeIds = new Set(routeSectionIds.split(","));
  return (
    <>
      {prd.preamble && <Markdown source={prd.preamble} docFile={prdFile} />}
      {prd.sections.map((s) => (
        <section
          key={s.id}
          data-section={s.id}
          className={`pk-section${s.id === activeSectionId ? " is-active" : ""}${routeIds.has(s.id) ? " is-route" : ""}`}
        >
          <div className="pk-section-tools">
            {s.routes.length > 0 && (
              <div className="pk-routes">
                {s.routes.map((r) => <code key={r}>{r}</code>)}
              </div>
            )}
            {packets.has(s.id) && <CopyChapter packet={packets.get(s.id)!} label="复制本章给 AI" title={s.title} />}
          </div>
          {s.change && (
            <div className="pk-section-change">
              <ChangeChip change={s.change} />
              <span>本章整体{s.change}</span>
            </div>
          )}
          <Markdown source={s.prose} docFile={prdFile} />
          {s.annotations.length > 0 && (
            <div className="pk-annotations">
              <div className="pk-annotations-head">批注</div>
              {s.annotations.map((a) => {
                const n = numberOf.get(a.key);
                const tone = toneOf(a.type);
                return (
                  <div
                    key={a.key}
                    data-ann={a.key}
                    className={`pk-ann pk-card-${tone} ${changeClass(a.change)}${a.key === selectedKey ? " is-selected" : ""}`}
                    onClick={() => onSelect(a.key)}
                  >
                    <div className="pk-card-head">
                      {n && <NumberBadge n={Number(n)} tone={tone} />}
                      <TypeChip type={a.type} />
                      <ChangeChip change={a.change} />
                      <span className={`pk-card-title pk-text-${tone}`}>{a.title}</span>
                      {a.anchor && (
                        <button
                          className="pk-link pk-ann-locate"
                          title={a.anchor}
                          onClick={(e) => {
                            e.stopPropagation();
                            onLocate(a);
                          }}
                        >
                          定位
                        </button>
                      )}
                    </div>
                    {a.body && <Markdown source={a.body} docFile={prdFile} compact />}
                    {a.anchor && <code className="pk-anchor">#{a.anchor}</code>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </>
  );
});
