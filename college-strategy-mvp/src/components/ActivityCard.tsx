import type { ActivityItem } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import "./ActivityCard.css";

const ACTIVITY_KINDS = [
  "activity",
  "competition",
  "research",
  "internship",
  "club",
  "service",
  "arts",
  "sports",
  "other",
] as const;

const ACTIVITY_SCOPES = ["school", "local", "regional", "state", "national", "international"] as const;

type Props = {
  item: ActivityItem;
  index: number;
  incomplete?: boolean;
  showRemove?: boolean;
  onChange: (patch: Partial<ActivityItem>) => void;
  onRemove?: () => void;
  t: Translate;
};

export function ActivityCard({
  item,
  index,
  incomplete = false,
  showRemove = false,
  onChange,
  onRemove,
  t,
}: Props) {
  const theme = (index + 1) % 2 === 1 ? "odd" : "even";

  return (
    <article
      className={`activity-card activity-card--${theme}${incomplete ? " activity-card--incomplete" : ""}`}
    >
      <header className="activity-card__head">
        <div className="activity-card__title">
          <svg className="activity-card__trophy" viewBox="0 0 24 24" aria-hidden focusable="false">
            <path
              fill="currentColor"
              d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"
            />
          </svg>
          <strong>{t("wizard.s3.activities.cardTitle", { n: index + 1 })}</strong>
        </div>
        {showRemove && onRemove ? (
          <button type="button" className="activity-card__remove" onClick={onRemove}>
            {t("wizard.s3.activities.remove")}
          </button>
        ) : null}
      </header>

      <div className="activity-card__body">
        <div className="activity-card__grid">
          <label>
            <span>{t("wizard.s3.activities.name")}</span>
            <input
              className="input-modern activity-card__input"
              value={item.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={t("wizard.s3.activities.namePh")}
            />
          </label>
          <label>
            <span>{t("wizard.s3.activities.kind")}</span>
            <select
              className="select-modern activity-card__input"
              value={item.kind}
              onChange={(e) => onChange({ kind: e.target.value as ActivityItem["kind"] })}
            >
              <option value="">{t("form.opt.choose")}</option>
              {ACTIVITY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`wizard.s3.activities.kindOpt.${kind}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("wizard.s3.activities.grades")}</span>
            <input
              className="input-modern activity-card__input"
              value={item.grades}
              onChange={(e) => onChange({ grades: e.target.value })}
              placeholder={t("wizard.s3.activities.gradesPh")}
            />
          </label>
          <label>
            <span>{t("wizard.s3.activities.hours")}</span>
            <input
              className="input-modern activity-card__input"
              value={item.hours}
              onChange={(e) => onChange({ hours: e.target.value })}
              placeholder={t("wizard.s3.activities.hoursPh")}
            />
          </label>
          <label>
            <span>{t("wizard.s3.activities.role")}</span>
            <input
              className="input-modern activity-card__input"
              value={item.role}
              onChange={(e) => onChange({ role: e.target.value })}
              placeholder={t("wizard.s3.activities.rolePh")}
            />
          </label>
          <label>
            <span>{t("wizard.s3.activities.scope")}</span>
            <select
              className="select-modern activity-card__input"
              value={item.scope}
              onChange={(e) => onChange({ scope: e.target.value as ActivityItem["scope"] })}
            >
              <option value="">{t("form.opt.choose")}</option>
              {ACTIVITY_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {t(`wizard.s3.activities.scopeOpt.${scope}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="activity-card__full">
          <span>{t("wizard.s3.activities.description")}</span>
          <textarea
            className="input-modern activity-card__input activity-card__textarea"
            value={item.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={t("wizard.s3.activities.descriptionPh")}
            rows={3}
          />
        </label>

        <div className="activity-card__grid">
          <label>
            <span>{t("wizard.s3.activities.outcome")}</span>
            <input
              className="input-modern activity-card__input"
              value={item.outcome}
              onChange={(e) => onChange({ outcome: e.target.value })}
              placeholder={t("wizard.s3.activities.outcomePh")}
            />
          </label>
          <label>
            <span>{t("wizard.s3.activities.award")}</span>
            <input
              className="input-modern activity-card__input"
              value={item.award}
              onChange={(e) => onChange({ award: e.target.value })}
              placeholder={t("wizard.s3.activities.awardPh")}
            />
          </label>
          <label>
            <span>{t("wizard.s3.activities.majorRelated")}</span>
            <select
              className="select-modern activity-card__input"
              value={item.majorRelated}
              onChange={(e) => onChange({ majorRelated: e.target.value as ActivityItem["majorRelated"] })}
            >
              <option value="">{t("form.opt.choose")}</option>
              <option value="yes">{t("wizard.s3.activities.majorYes")}</option>
              <option value="no">{t("wizard.s3.activities.majorNo")}</option>
              <option value="unsure">{t("wizard.s3.activities.majorUnsure")}</option>
            </select>
          </label>
          <label>
            <span>{t("wizard.s3.activities.proof")}</span>
            <input
              className="input-modern activity-card__input"
              value={item.proof}
              onChange={(e) => onChange({ proof: e.target.value })}
              placeholder={t("wizard.s3.activities.proofPh")}
            />
          </label>
        </div>
      </div>
    </article>
  );
}
