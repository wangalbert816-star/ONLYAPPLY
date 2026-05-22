import type { Translate } from "../i18n/LanguageContext";
import "./ReportSectionNav.css";

export type ReportNavItem = { id: string; label: string };

type Props = {
  items: ReportNavItem[];
  t: Translate;
};

export function ReportSectionNav({ items, t }: Props) {
  if (items.length < 2) return null;

  return (
    <nav className="report-section-nav card" aria-label={t("report.navAria")}>
      <p className="report-section-nav__eyebrow">{t("report.navEyebrow")}</p>
      <ul className="report-section-nav__list">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
