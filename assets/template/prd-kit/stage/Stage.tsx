// 舞台：中间是原型 iframe，两侧留出批注栏；顶部是页面级批注。

import { useEffect, useRef, useState, type RefObject } from "react";
import type { PageModel } from "../model/page-model.ts";
import { CARD_WIDTH, GUTTER, Overlay, type FrameBox } from "../overlay/Overlay.tsx";
import { Markdown, toneOf, TypeChip } from "../ui/shared.tsx";

export interface Device {
  id: string;
  label: string;
  width: number | null;
}

export const DEVICES: Device[] = [
  { id: "1440", label: "1440", width: 1440 },
  { id: "1280", label: "1280", width: 1280 },
  { id: "1024", label: "1024", width: 1024 },
  { id: "390", label: "手机 390", width: 390 },
  { id: "fluid", label: "铺满", width: null },
];

export const ZOOMS = ["fit", 0.5, 0.75, 1] as const;
export type Zoom = (typeof ZOOMS)[number];

const PAD = 20;

function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

interface Props {
  src: string;
  annotate: boolean;
  device: Device;
  zoom: Zoom;
  model: PageModel;
  docFile: string;
  selectedKey: string | null;
  onIframe: (el: HTMLIFrameElement | null) => void;
  onSelect: (key: string) => void;
  onScale: (scale: number) => void;
}

export function Stage({ src, annotate, device, zoom, model, docFile, selectedKey, onIframe, onSelect, onScale }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const view = useSize(viewportRef);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const side = annotate ? CARD_WIDTH + GUTTER + PAD : PAD;
  const avail = Math.max(240, view.w - 2 * side);
  const innerWidth = device.width ?? avail;
  const scale = zoom === "fit" ? Math.min(1, avail / innerWidth) : zoom;
  const frameW = innerWidth * scale;
  const frameH = Math.max(200, view.h - 2 * PAD);
  const canvasW = Math.max(view.w, frameW + 2 * side);
  const frame: FrameBox = {
    left: Math.round((canvasW - frameW) / 2),
    top: PAD,
    width: frameW,
    height: frameH,
    scale,
    innerWidth,
  };

  useEffect(() => onScale(scale), [scale, onScale]);

  return (
    <div className="pk-stage">
      {annotate && model.pageLevel.length > 0 && (
        <div className="pk-pagenotes">
          <span className="pk-pagenotes-label">本页说明</span>
          {model.pageLevel.map((a) => (
            <div
              key={a.key}
              className={`pk-pagenote pk-card-${toneOf(a.type)}${a.key === selectedKey ? " is-selected" : ""}`}
              onClick={() => onSelect(a.key)}
            >
              <TypeChip type={a.type} />
              <span className={`pk-card-title pk-text-${toneOf(a.type)}`}>{a.title}</span>
              {a.body && <Markdown source={a.body} docFile={docFile} compact />}
            </div>
          ))}
        </div>
      )}
      <div className="pk-viewport" ref={viewportRef}>
        <div className="pk-canvas" style={{ width: canvasW, height: frameH + 2 * PAD }}>
          <div
            className="pk-frame"
            style={{ left: frame.left, top: frame.top, width: frameW, height: frameH }}
          >
            <iframe
              ref={onIframe}
              src={src}
              title="原型"
              style={{
                width: innerWidth,
                height: frameH / scale,
                transform: `scale(${scale})`,
              }}
            />
          </div>
          {annotate && view.w > 0 && (
            <Overlay
              staged={model.staged}
              nav={model.nav}
              frame={frame}
              docFile={docFile}
              selectedKey={selectedKey}
              hoverKey={hoverKey}
              onHover={setHoverKey}
              onSelect={onSelect}
            />
          )}
        </div>
      </div>
    </div>
  );
}
