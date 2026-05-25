import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getAssignedExpert, type AssignedExpert } from "../../lib/assignedExpert";
import { isCalendlyBookingEnabled, requestExpertConsult } from "../../lib/expertConsultBooking";
import { SUPPORT_EMAIL } from "../../lib/support";
import { ExpertConsultLeadDialog } from "../ExpertConsultLeadDialog";
import "./AccountExpertPanel.css";

type Props = {
  gapCount: number;
  applicationId?: string | null;
  reportId?: string | null;
  userEmail?: string | null;
};

function expertInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function AssignedExpertCard({
  expert,
  onContact,
  showCalendlyHint,
}: {
  expert: AssignedExpert;
  onContact: () => void;
  showCalendlyHint: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="account-expert-panel__assigned">
      <div className="account-expert-panel__avatar" aria-hidden>
        {expertInitials(expert.name)}
      </div>
      <p className="account-expert-panel__kicker">{t("auth.accountExpertTitleAssigned")}</p>
      <h2 className="account-expert-panel__name">{expert.name}</h2>
      <p className="account-expert-panel__role">{expert.title}</p>
      {expert.bio && <p className="account-expert-panel__bio">{expert.bio}</p>}
      {expert.specialties && expert.specialties.length > 0 && (
        <ul className="account-expert-panel__tags">
          {expert.specialties.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      <div className="account-expert-panel__contact-list">
        {expert.email && (
          <a className="account-expert-panel__contact-link" href={`mailto:${expert.email}`}>
            {expert.email}
          </a>
        )}
        {expert.wechat && <p className="account-expert-panel__contact-line">{expert.wechat}</p>}
      </div>
      <button type="button" className="btn btn-primary account-expert-panel__cta" onClick={onContact}>
        {showCalendlyHint ? t("auth.accountExpertBookCalendly") : t("auth.accountExpertContact")}
      </button>
      {showCalendlyHint && <p className="account-expert-panel__calendly-hint">{t("auth.accountExpertCalendlyHint")}</p>}
    </div>
  );
}

export function AccountExpertPanel({ gapCount, applicationId = null, reportId = null, userEmail = null }: Props) {
  const { t } = useLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const expert = useMemo(() => getAssignedExpert(), []);
  const calendlyUrl = expert?.calendlyUrl ?? null;
  const showCalendlyHint = isCalendlyBookingEnabled(calendlyUrl);

  const openConsult = () => {
    requestExpertConsult({
      url: calendlyUrl,
      email: userEmail,
      source: expert ? "account_advisor_assigned" : "account_advisor_panel",
      onFallback: () => setDialogOpen(true),
    });
  };

  const riskText =
    gapCount > 0
      ? t("report.expertConsult.riskWithGaps", { n: gapCount })
      : t("report.expertConsult.riskNoGaps");

  return (
    <aside className="account-expert-panel" aria-labelledby="account-expert-panel-title">
      {expert ? (
        <AssignedExpertCard expert={expert} onContact={openConsult} showCalendlyHint={showCalendlyHint} />
      ) : (
        <div className="account-expert-panel__empty">
          <p className="account-expert-panel__kicker">{t("auth.accountExpertKicker")}</p>
          <h2 className="account-expert-panel__title" id="account-expert-panel-title">
            {t("auth.accountExpertTitleEmpty")}
          </h2>
          <p className="account-expert-panel__lead">{t("auth.accountExpertLeadEmpty")}</p>
          <p className="account-expert-panel__risk">{riskText}</p>
          <ul className="account-expert-panel__benefits">
            <li>{t("auth.accountExpertBenefit1")}</li>
            <li>{t("auth.accountExpertBenefit2")}</li>
            <li>{t("auth.accountExpertBenefit3")}</li>
          </ul>
          <button type="button" className="btn btn-primary account-expert-panel__cta" onClick={openConsult}>
            {showCalendlyHint ? t("auth.accountExpertBookCalendly") : t("app.expertConsult.cta")}
          </button>
          {showCalendlyHint ? (
            <p className="account-expert-panel__calendly-hint">{t("auth.accountExpertCalendlyHint")}</p>
          ) : (
            <p className="account-expert-panel__email">
              {t("auth.accountExpertEmailHint")}{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
          )}
        </div>
      )}

      <ExpertConsultLeadDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        applicationId={applicationId}
        reportId={reportId}
        source="account_advisor_panel"
        defaultEmail={userEmail ?? ""}
      />
    </aside>
  );
}
