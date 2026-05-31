import { useLanguage } from "../../i18n/LanguageContext";
import type { CrmCounselor, CrmEngagement } from "../../lib/crm/types";
import { countOpenTasks, countUnreadCounselorMessages } from "../../lib/crm/store";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import "./SignedServiceEntryCard.css";

type Props = {
  engagement: CrmEngagement;
  counselor: CrmCounselor;
  onOpen: () => void;
};

export function SignedServiceEntryCard({ engagement, counselor, onOpen }: Props) {
  const { t, locale } = useLanguage();
  const openTasks = countOpenTasks(engagement.id);
  const unread = countUnreadCounselorMessages(engagement.id);

  return (
    <section className="signed-service-entry" aria-labelledby="signed-service-entry-title">
      <div className="signed-service-entry__head">
        <div>
          <p className="signed-service-entry__kicker">{t("crm.serviceKicker")}</p>
          <h2 id="signed-service-entry-title">{t("crm.signedService.entryTitle")}</h2>
          <p className="signed-service-entry__lead">{t("crm.signedService.entryLead")}</p>
        </div>
        <span className="signed-service-entry__phase">{t(`crm.phase.${engagement.phase}`)}</span>
      </div>

      <div className="signed-service-entry__meta">
        <p>
          <strong>{localizeCrmText(counselor.name, locale, t)}</strong> ·{" "}
          {localizeCrmText(counselor.title, locale, t)}
        </p>
        {engagement.planLabel ? <p>{localizeCrmText(engagement.planLabel, locale, t)}</p> : null}
        <p>
          {t("crm.signedService.entryStats", { tasks: openTasks, unread })}
        </p>
      </div>

      <button type="button" className="btn btn-primary signed-service-entry__cta" onClick={onOpen}>
        {t("crm.signedService.openHub")}
      </button>
    </section>
  );
}
