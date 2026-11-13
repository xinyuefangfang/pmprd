import type { ReactNode } from "react";
import type { Annotation } from "../types.ts";
import { TypeChip } from "../ui/shared.tsx";
import type { ValidationResult } from "./checks.ts";

export type ValidationReport = ValidationResult;

function Group({ title, hint, count, children }: { title: string; hint: string; count: number; children: ReactNode }) {
  return (
    <section className="pk-check">
      <div className="pk-check-head">
        <span>{title}</span>
        <span className={count ? "pk-check-count is-bad" : "pk-check-count"}>{count}</span>
      </div>
      <p className="pk-check-hint">{hint}</p>
      {count > 0 && <ul className="pk-check-list">{children}</ul>}
    </section>
  );
}

export function ValidatorPanel({ report, onLocate }: { report: ValidationReport; onLocate: (a: Annotation) => void }) {
  return (
    <div className="pk-validator">
      <div className="pk-coverage">
        <span>当前页面覆盖率</span>
        <strong>{report.coverage == null ? "—" : `${Math.round(report.coverage * 100)}%`}</strong>
      </div>
      <Group title="缺少说明" hint="当前页面有 data-prd，但 PRD 中没有对应批注。" count={report.undocumented.length}>
        {report.undocumented.map((id) => (
          <li key={id}>
            <code>#{id}</code>
          </li>
        ))}
      </Group>
      <Group
        title="本次浏览未出现"
        hint="批注写了锚点，但浏览过的页面里还没出现过对应元素。逛完相关页面后仍在这里，多半已失效；也可以运行命令行校验扫描源码。"
        count={report.unseen.length}
      >
        {report.unseen.map((a) => (
          <li key={a.key}>
            <TypeChip type={a.type} />
            <span>{a.title}</span>
            <code>#{a.anchor}</code>
            <button className="pk-link" onClick={() => onLocate(a)}>
              查看
            </button>
          </li>
        ))}
      </Group>
      <Group title="重复锚点" hint="同一锚点在 PRD 中定义了多次，只有第一条生效。" count={report.duplicates.length}>
        {report.duplicates.map((id) => (
          <li key={id}>
            <code>#{id}</code>
          </li>
        ))}
      </Group>
      <Group title="图片缺失" hint="批注或正文引用的图片在需求目录中不存在。" count={report.missingImages.length}>
        {report.missingImages.map((p) => (
          <li key={p}>
            <code>{p}</code>
          </li>
        ))}
      </Group>
      <Group title="文档缺失" hint="prd.config.ts 中配置的文档不存在。" count={report.missingDocs.length}>
        {report.missingDocs.map((p) => (
          <li key={p}>
            <code>{p}</code>
          </li>
        ))}
      </Group>
      <p className="pk-check-hint">
        命令行校验：<code>node --experimental-strip-types prd-kit/validator/cli.ts</code>
      </p>
    </div>
  );
}
