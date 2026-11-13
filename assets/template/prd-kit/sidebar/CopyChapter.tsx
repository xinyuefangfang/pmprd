import { useState } from "react";
import type { ChapterPacket } from "../model/chapter-packet.ts";

export function CopyChapter({ packet, label, title }: { packet: ChapterPacket; label: string; title: string }) {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const copied = copiedText === packet.text;
  return (
    <div className="pk-copy">
      <button
        type="button"
        className="pk-btn pk-copy-button"
        title={title}
        aria-label={`${label}：${title}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(packet.text);
            setCopiedText(packet.text);
            setManual(false);
          } catch {
            setCopiedText(null);
            setManual(true);
          }
        }}
      >
        {label}
      </button>
      {copied && (
        <span className="pk-copy-status" role="status">
          已复制 PRD{packet.specCount ? ` + ${packet.specCount} 节 Dev Spec` : ""}
        </span>
      )}
      {packet.warning && <span className="pk-copy-warning">{packet.warning}</span>}
      {manual && (
        <div className="pk-copy-manual">
          <p role="status">浏览器未允许写入剪贴板。点击下方文本全选，手动复制后粘贴给 AI。</p>
          <textarea
            readOnly
            aria-label="本章 PRD 与 Dev Spec，手动复制"
            value={packet.text}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
}
