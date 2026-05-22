import { useId, useState, type ReactNode } from "react";
import "./ReportCollapsibleSection.css";

type Props = {
  id?: string;
  title: ReactNode;
  lead?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function ReportCollapsibleSection({ id, title, lead, defaultOpen = true, children, className }: Props) {
  const autoId = useId();
  const panelId = id ?? autoId;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`report-collapse ${className ?? ""}`.trim()} id={panelId}>
      <button
        type="button"
        className="report-collapse__trigger"
        aria-expanded={open}
        aria-controls={`${panelId}-body`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="report-collapse__chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className="report-collapse__title">{title}</span>
      </button>
      {lead && open ? <p className="report-collapse__lead">{lead}</p> : null}
      <div id={`${panelId}-body`} className="report-collapse__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
