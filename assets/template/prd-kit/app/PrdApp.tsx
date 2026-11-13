// PRD 外壳：顶栏 + 舞台 + 文档侧栏。把内容包、舞台快照和页面模型串起来。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildPageModel } from "../model/page-model.ts";
import { parsePrd } from "../parser/parse-prd.ts";
import { Sidebar, VALIDATE_TAB } from "../sidebar/Sidebar.tsx";
import { DEVICES, Stage, ZOOMS, type Zoom } from "../stage/Stage.tsx";
import { locateAnchor, useFrameSnapshot } from "../stage/use-frame.ts";
import type { Annotation, PrdContent } from "../types.ts";
import { KitContext, Lightbox, type PrdKitContext } from "../ui/shared.tsx";
import { validate } from "../validator/checks.ts";
import { usePrdContent } from "./use-content.ts";
import baseline from '../../baseline.json';

const PREFS_KEY = "prototype-prd-kit.prefs";

interface Prefs {
  annotate: boolean;
  device: string;
  zoom: Zoom;
  sidebar: boolean;
}

function readPrefs(): Prefs {
  const fallback: Prefs = { annotate: false, device: "1280", zoom: "fit", sidebar: true };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return fallback;
  }
}

export function PrdApp() {
  const { content, error } = usePrdContent();
  if (!content)
    return <div className="pk-boot">{error ? <p className="pk-error">{error}</p> : <p>正在读取 PRD…</p>}</div>;
  return <Shell content={content} error={error} />;
}

function Shell({ content, error }: { content: PrdContent; error: string | null }) {
  const [prefs, setPrefs] = useState(readPrefs);
  const update = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // 无痕模式等无法保存偏好时忽略
      }
      return next;
    });

  const prdDoc = content.docs.find((d) => d.annotations && d.source != null) ?? null;
  const prd = useMemo(() => parsePrd(prdDoc?.source ?? ""), [prdDoc?.source]);

  // 地址栏 hash 记录原型路由，链接可直接分享到某个页面
  const [src] = useState(() => decodeURIComponent(location.hash.slice(1)) || content.appEntry);
  const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null);
  const snapshot = useFrameSnapshot(iframe);
  const model = useMemo(() => buildPageModel(prd, snapshot), [prd, snapshot]);

  useEffect(() => {
    if (snapshot.path) history.replaceState(null, "", "#" + snapshot.path);
  }, [snapshot.path]);

  const seen = useRef(new Set<string>());
  const [seenVersion, setSeenVersion] = useState(0);
  useEffect(() => {
    let added = false;
    for (const h of snapshot.anchors)
      if (!seen.current.has(h.id)) {
        seen.current.add(h.id);
        added = true;
      }
    if (added) setSeenVersion((v) => v + 1);
  }, [snapshot.anchors]);

  const report = useMemo(
    () =>
      validate({
        prd,
        content,
        knownAnchors: new Set(seen.current),
        undocumented: model.undocumented,
        anchorTotal: snapshot.anchors.length,
      }),
    // seenVersion 变化时重新计算
    [prd, content, model.undocumented, snapshot.anchors.length, seenVersion],
  );

  const [tab, setTab] = useState(() => prdDoc?.id ?? content.docs[0]?.id ?? VALIDATE_TAB);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  const select = useCallback(
    (key: string) => {
      setSelectedKey(key);
      if (prdDoc) setTab(prdDoc.id);
      update({ sidebar: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prdDoc?.id],
  );

  const locate = useCallback(
    (a: Annotation) => {
      setSelectedKey(a.key);
      if (!a.anchor) return;
      const result = locateAnchor(iframe, a.anchor);
      if (result === "missing") setToast(`当前页面没有「${a.title}」对应的元素`);
    },
    [iframe],
  );

  const kit = useMemo<PrdKitContext>(
    () => ({
      content,
      openImage: setImage,
      openDoc: (file) => {
        const doc = content.docs.find((d) => d.file === file);
        if (doc) setTab(doc.id);
        return !!doc;
      },
    }),
    [content],
  );

  const device = DEVICES.find((d) => d.id === prefs.device) ?? DEVICES[1];
  const annotationCount = prd.sections.reduce((n, s) => n + s.annotations.length, 0);

  return (
    <KitContext.Provider value={kit}>
      <div className={`pk-root${prefs.sidebar ? "" : " no-sidebar"}`}>
        <header className="pk-topbar">
          <div className="pk-brand">
            <span className="pk-logo">PRD</span>
            <span className="pk-req" title={content.requirement}>
              {content.requirement.split("/").pop()}
            </span>
            <span className="pk-muted" title={`Source ${baseline.sourceRevision}`}>v{baseline.version} · {baseline.stage}</span>
          </div>
          <div className="pk-segment" role="group" aria-label="模式">
            <button className={!prefs.annotate ? "is-on" : ""} onClick={() => update({ annotate: false })}>
              原型
            </button>
            <button className={prefs.annotate ? "is-on" : ""} onClick={() => update({ annotate: true })}>
              标注 <span className="pk-muted">{model.staged.length}</span>
            </button>
          </div>
          <label className="pk-select">
            宽度
            <select value={device.id} onChange={(e) => update({ device: e.target.value })}>
              {DEVICES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="pk-select">
            缩放
            <select
              value={String(prefs.zoom)}
              onChange={(e) => update({ zoom: e.target.value === "fit" ? "fit" : (Number(e.target.value) as Zoom) })}
            >
              {ZOOMS.map((z) => (
                <option key={String(z)} value={String(z)}>
                  {z === "fit" ? `适应 ${Math.round(scale * 100)}%` : `${z * 100}%`}
                </option>
              ))}
            </select>
          </label>
          <span className="pk-path" title="原型当前路由">
            {snapshot.path || "加载中…"}
          </span>
          {error && <span className="pk-error-inline">{error}</span>}
          <div className="pk-spacer" />
          {!prdDoc && <span className="pk-text-amber">未找到带批注的 PRD 文档</span>}
          <span className="pk-muted">批注 {annotationCount}</span>
          <a className="pk-btn" href={snapshot.path || content.appEntry} target="_blank" rel="noreferrer">
            新窗口打开原型
          </a>
          <button className="pk-btn" onClick={() => update({ sidebar: !prefs.sidebar })}>
            {prefs.sidebar ? "收起文档" : "展开文档"}
          </button>
        </header>

        <main className="pk-main">
          <Stage
            src={src}
            annotate={prefs.annotate}
            device={device}
            zoom={prefs.zoom}
            model={model}
            docFile={prdDoc?.file ?? "prd.md"}
            selectedKey={selectedKey}
            onIframe={setIframe}
            onSelect={select}
            onScale={setScale}
          />
          {prefs.sidebar && (
            <Sidebar
              content={content}
              prd={prd}
              prdFile={prdDoc?.file ?? null}
              model={model}
              path={snapshot.path}
              tab={tab}
              onTab={setTab}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              onLocate={locate}
              report={report}
            />
          )}
        </main>
        {toast && <div className="pk-toast">{toast}</div>}
        <Lightbox src={image} onClose={() => setImage(null)} />
      </div>
    </KitContext.Provider>
  );
}
