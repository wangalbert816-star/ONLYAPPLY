import type { Translate } from "../i18n/LanguageContext";
import "./ReportToc.css";

type Item = { id: string; label: string };

type Props = {
  items: Item[];
  t: Translate;
};

export function ReportToc({ items, t }: Props) {
  if (items.length < 2) return null;
  return (
    <nav className="report-toc card" aria-label="Report sections">
      <p className="report-toc__title">{t("report.tocTitle")}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
