import { useLanguage } from "../../i18n/LanguageContext";
import "./SaveReportBanner.css";

type Props = {
  onSignIn: () => void;
  onDismiss?: () => void;
  saved?: boolean;
};

export function SaveReportBanner({ onSignIn, onDismiss, saved }: Props) {
  const { t } = useLanguage();

  if (saved) {
    return (
      <div className="save-report-banner save-report-banner--saved" role="status">
        <p>{t("auth.bannerSaved")}</p>
      </div>
    );
  }

  return (
    <div className="save-report-banner" role="region" aria-labelledby="save-report-banner-title">
      <div className="save-report-banner__copy">
        <h3 id="save-report-banner-title">{t("auth.bannerTitle")}</h3>
        <p>{t("auth.bannerLead")}</p>
      </div>
      <div className="save-report-banner__actions">
        <button type="button" className="btn btn-primary" onClick={onSignIn}>
          {t("auth.bannerCta")}
        </button>
        {onDismiss && (
          <button type="button" className="btn btn-secondary save-report-banner__later" onClick={onDismiss}>
            {t("auth.bannerLater")}
          </button>
        )}
      </div>
    </div>
  );
}
