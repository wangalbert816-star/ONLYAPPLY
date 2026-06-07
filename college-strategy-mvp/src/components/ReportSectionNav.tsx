import { BrandLogo } from "./BrandLogo";
import type { Translate } from "../i18n/LanguageContext";
import "./ReportSectionNav.css";

export type ReportNavItem = { id: string; label: string };

type InviteSectionProps = {
  inviteInput: string;
  onInviteInputChange: (value: string) => void;
  inviteRedeemBusy: boolean;
  onRedeemInviteCode: () => void;
  isAuthenticated: boolean;
  sessionSaved: boolean;
};

type Props = {
  items: ReportNavItem[];
  t: Translate;
  onRefresh?: () => void;
  inviteSection?: InviteSectionProps;
};

export function ReportSectionNav({ items, t, onRefresh, inviteSection }: Props) {
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

      {inviteSection ? (
        <div id="report-invite-redeem" className="report-sidebar__invite invite-redeem" data-no-pdf>
          <p className="invite-redeem__label">{t("report.inviteCodeLabel")}</p>
          {!inviteSection.isAuthenticated ? (
            <p className="invite-redeem__hint">{t("report.inviteSignInFirst")}</p>
          ) : !inviteSection.sessionSaved ? (
            <p className="invite-redeem__hint">{t("report.inviteNeedSave")}</p>
          ) : (
            <div className="invite-redeem__row report-sidebar__invite-row">
              <input
                type="text"
                className="invite-redeem__input"
                autoComplete="off"
                spellCheck={false}
                value={inviteSection.inviteInput}
                onChange={(e) => inviteSection.onInviteInputChange(e.target.value)}
                placeholder={t("report.inviteRedeemPlaceholder")}
                aria-label={t("report.inviteCodeLabel")}
              />
              <button
                type="button"
                className="btn btn-secondary invite-redeem__btn report-sidebar__invite-btn"
                disabled={inviteSection.inviteRedeemBusy}
                onClick={inviteSection.onRedeemInviteCode}
              >
                {inviteSection.inviteRedeemBusy ? t("report.inviteRedeemBusy") : t("report.inviteRedeemSubmit")}
              </button>
            </div>
          )}
        </div>
      ) : null}

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
