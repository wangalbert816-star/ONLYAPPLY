import type { ReactNode } from "react";

type Props = {
  step: number;
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
};

/** Flat numbered section — matches OnlyApply report mockup (no outer card). */
export function ReportPathStep({ step, id, title, lead, children }: Props) {
  return (
    <section className="report-path-step" aria-labelledby={`${id}-title`} id={id}>
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
      <div className="report-path-step__body">{children}</div>
    </section>
  );
}
