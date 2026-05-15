import type { ReactNode } from "react";

type Props = {
  step: number;
  id: string;
  title: string;
  lead?: string;
  /** 无外层 card（用于学校列表等多卡片组合） */
  bare?: boolean;
  children: ReactNode;
};

export function ReportPathStep({ step, id, title, lead, bare, children }: Props) {
  const head = (
    <header className="report-path-step__head">
      <span className="report-path-step__num" aria-hidden>
        {step}
      </span>
      <div className="report-path-step__titles">
        <h2 id={`${id}-title`} className="report-path-step__title">
          {title}
        </h2>
        {lead ? <p className="report-path-step__lead">{lead}</p> : null}
      </div>
    </header>
  );

  if (bare) {
    return (
      <section className="report-path-step report-path-step--bare" aria-labelledby={`${id}-title`} id={id}>
        {head}
        <div className="report-path-step__body">{children}</div>
      </section>
    );
  }

  return (
    <section className="card report-block report-path-step" aria-labelledby={`${id}-title`} id={id}>
      {head}
      <div className="report-path-step__body">{children}</div>
    </section>
  );
}
