import { useId, useState } from "react";

type Tag = { label: string; muted?: boolean };

type Props = {
  tags: Tag[];
  title: string;
  body: string;
  points: string[];
  readMoreLabel: string;
  collapseLabel: string;
};

export function ReportStudyCard({ tags, title, body, points, readMoreLabel, collapseLabel }: Props) {
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <article className={`report-study-card${open ? " report-study-card--open" : ""}`}>
      <button
        type="button"
        className="report-study-card__trigger"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="report-study-card__tags">
          {tags.map((tag) => (
            <span
              key={tag.label}
              className={`report-study-tag${tag.muted ? " report-study-tag--muted" : ""}`}
            >
              {tag.label}
            </span>
          ))}
        </div>
        <h3 className="report-study-card__title">{title}</h3>
        <p className="report-study-card__body">{body}</p>
        <span className="report-study-card__cta">{open ? collapseLabel : readMoreLabel}</span>
      </button>
      <div id={detailId} className="report-study-card__detail" hidden={!open}>
        <ul className="report-study-card__list">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
