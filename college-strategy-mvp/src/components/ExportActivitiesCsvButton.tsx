import type { ActivityItem, FormState } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { countExportableActivities, downloadActivitiesCsvFromForm } from "../lib/exportActivitiesCsv";

type Props = {
  activities: ActivityItem[];
  form?: Pick<FormState, "intakeTerm" | "intakeOtherDetail">;
  className?: string;
  showHint?: boolean;
};

export function ExportActivitiesCsvButton({ activities, form, className, showHint = true }: Props) {
  const { t, locale } = useLanguage();
  const disabled = countExportableActivities(activities) === 0;
  const btnClass = ["btn", "btn-secondary", className].filter(Boolean).join(" ");

  return (
    <div className="activity-export">
      <button
        type="button"
        className={btnClass}
        disabled={disabled}
        title={disabled ? t("wizard.s3.activities.exportDisabled") : undefined}
        onClick={() => downloadActivitiesCsvFromForm(activities, locale, form)}
      >
        {t("wizard.s3.activities.exportCsv")}
      </button>
      {showHint && <p className="activity-export__hint">{t("wizard.s3.activities.exportHint")}</p>}
    </div>
  );
}
