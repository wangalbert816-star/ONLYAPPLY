import { useMemo } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { reportBodyToFormState, buildAdminEvalFormRows } from "../../../lib/admin/evalCaseForm";
import type { AdminEvalCase } from "../../../lib/admin/crmAdminApi";
import { getEvalCaseReportBody, joinList } from "../../../lib/admin/evalCaseDisplay";
import type { ActivityItem } from "../../../types";
import { activityItemMeetsWizardRequirement } from "../../guidedStepShared";

type Props = {
  evalCase: AdminEvalCase;
};

function activityMeta(item: ActivityItem, locale: "zh" | "en"): string {
  const bits: string[] = [];
  if (item.scope) {
    const scope =
      locale === "en"
        ? { school: "School", local: "Local", regional: "Regional", state: "State", national: "National", international: "International" }[
            item.scope
          ]
        : { school: "校内", local: "本地", regional: "区域", state: "州级", national: "全国", international: "国际" }[
            item.scope
          ];
    if (scope) bits.push(scope);
  }
  if (item.majorRelated === "yes") bits.push(locale === "en" ? "Major-related" : "与专业相关");
  if (item.majorRelated === "no") bits.push(locale === "en" ? "Not major-related" : "与专业不直接相关");
  return bits.join(" · ");
}

function activityLines(item: ActivityItem): string[] {
  const lines: string[] = [];
  if (item.role.trim()) lines.push(item.role.trim());
  if (item.hours.trim()) lines.push(item.hours.trim());
  if (item.grades.trim()) lines.push(item.grades.trim());
  if (item.description.trim()) lines.push(item.description.trim());
  if (item.outcome.trim()) lines.push(item.outcome.trim());
  if (item.award.trim()) lines.push(item.award.trim());
  if (item.proof.trim()) lines.push(item.proof.trim());
  return lines;
}

export function EvalCaseFormSummary({ evalCase }: Props) {
  const { t, locale } = useLanguage();
  const form = useMemo(
    () => reportBodyToFormState(getEvalCaseReportBody(evalCase, locale)),
    [evalCase, locale],
  );
  const rows = useMemo(() => buildAdminEvalFormRows(form, t), [form, t]);
  const activities = (form.structuredActivities ?? []).filter(
    (item) => item.name.trim() || activityItemMeetsWizardRequirement(item),
  );
  const legacyActivities = form.activities.trim();

  return (
    <section className="admin-eval-case-form" aria-label={t("admin.evalHarness.formSummaryTitle")}>
      <h5 className="admin-eval-case-form__title">{t("admin.evalHarness.formSummaryTitle")}</h5>
      <p className="admin-eval-case-form__lead">{t("admin.evalHarness.formSummaryLead")}</p>
      {evalCase.tags.length > 0 ? (
        <p className="admin-eval-case-form__tags">
          {evalCase.tags.map((tag) => (
            <span key={tag} className="admin-eval-case-form__tag">
              {tag}
            </span>
          ))}
        </p>
      ) : null}
      {evalCase.forbiddenSchools.length > 0 ? (
        <p className="admin-eval-case-form__forbidden">
          <strong>{t("admin.eval.forbiddenLabel")}</strong> {joinList(evalCase.forbiddenSchools, locale)}
        </p>
      ) : null}
      <div className="admin-eval-case-form__table-wrap">
        <table className="admin-eval-case-form__table">
          <tbody>
            {rows.map((row) =>
              row.isStepSummary ? (
                <tr key={row.id} className="admin-eval-case-form__section">
                  <th colSpan={2} scope="colgroup">
                    {row.label}
                  </th>
                </tr>
              ) : (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value ?? "—"}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {activities.length > 0 ? (
        <div className="admin-eval-case-form__activities">
          <h6>{t("admin.evalHarness.activityDetailTitle")}</h6>
          <ul>
            {activities.map((item) => (
              <li key={item.id}>
                <strong>{item.name.trim() || t("admin.evalHarness.activityUntitled")}</strong>
                {item.kind ? (
                  <span className="admin-eval-case-form__activity-kind">{item.kind}</span>
                ) : null}
                {activityMeta(item, locale) ? (
                  <span className="admin-eval-case-form__activity-meta">{activityMeta(item, locale)}</span>
                ) : null}
                {activityLines(item).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : legacyActivities ? (
        <div className="admin-eval-case-form__activities">
          <h6>{t("admin.evalHarness.activityDetailTitle")}</h6>
          <p className="admin-eval-case-form__legacy">{legacyActivities}</p>
        </div>
      ) : null}
    </section>
  );
}
