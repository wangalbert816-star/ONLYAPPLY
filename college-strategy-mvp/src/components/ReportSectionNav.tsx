import { BrandLogo } from "./BrandLogo";
import type { Translate } from "../i18n/LanguageContext";
import "./ReportSectionNav.css";

export type ReportNavItem = { id: string; label: string };

type Props = {
  items: ReportNavItem[];
  t: Translate;
  onRefresh?: () => void;
};

export function ReportSectionNav({ items, t, onRefresh }: Props) {
  if (items.length < 2) return null;

  return (
    <aside className="report-sidebar" aria-label={t("report.navAria")}>
      <div className="report-sidebar__logo">
        <BrandLogo />
      </div>
      <p className="report-sidebar__jump-label">{t("report.nav.jumpTo")}</p>
      <nav className="report-sidebar__nav">
        <ul className="report-sidebar__list">
          {items.map((item, index) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className={index === 0 ? "is-active" : undefined}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="report-sidebar__footer">
        <p className="report-sidebar__filter-label">{t("report.navSchoolListLabel")}</p>
        <div className="report-sidebar__filter-row">
          <select className="report-sidebar__filter-select" defaultValue="all" aria-label={t("report.navFilterAll")}>
            <option value="all">{t("report.navFilterAll")}</option>
          </select>
          {onRefresh ? (
            <button type="button" className="report-sidebar__refresh-btn" onClick={onRefresh} aria-label={t("report.navRefresh")}>
              ↻
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
