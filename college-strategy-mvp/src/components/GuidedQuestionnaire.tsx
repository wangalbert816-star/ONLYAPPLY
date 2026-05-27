import type { FormState } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { buildSnapshotRows, snapshotProgress, type SnapshotRowStatus } from "./formSnapshotRows";
import type { Step1ScreenId } from "./GuidedStep1Flow";
import type { Step2ScreenId } from "./GuidedStep2Flow";
import type { Step3ScreenId } from "./GuidedStep3Flow";
import "./FormLiveSummary.css";

export type GuideTouch = {
  s2_gpa?: boolean;
  s2_major?: boolean;
  s2_major2?: boolean;
  s3_actv?: boolean;
  s3_deal?: boolean;
};

function snapshotStatusLabel(status: SnapshotRowStatus, t: Translate, isNext: boolean): string {
  if (isNext) return t("wizard.summary.statusNext");
  if (status === "filled") return t("wizard.summary.statusFilled");
  if (status === "optional") return t("wizard.summary.statusOptional");
  if (status === "na") return t("wizard.summary.statusNa");
  return t("wizard.summary.statusPending");
}

export function FormLiveSummary({
  form,
  t,
  step,
  step1ScreenId,
  step2ScreenId,
  step3ScreenId,
}: {
  form: FormState;
  t: Translate;
  step: number;
  step1ScreenId?: Step1ScreenId;
  step2ScreenId?: Step2ScreenId;
  step3ScreenId?: Step3ScreenId;
}) {
  const rows = buildSnapshotRows(form, t, step, step1ScreenId, step2ScreenId, step3ScreenId);
  const { filled, total } = snapshotProgress(rows, step);

  return (
    <aside className="form-snapshot" aria-live="polite">
      <div className="form-snapshot__head">
        <h3 className="form-snapshot__title">{t("wizard.summary.title")}</h3>
        {total > 0 && (
          <p className="form-snapshot__progress">{t("wizard.summary.progress", { filled, total })}</p>
        )}
      </div>
      <p className="form-snapshot__lead">{t("wizard.summary.lead")}</p>
      <div className="form-snapshot__table-wrap">
        <table className="form-snapshot__table">
          <thead>
            <tr>
              <th scope="col">{t("wizard.summary.colField")}</th>
              <th scope="col">{t("wizard.summary.colValue")}</th>
              <th scope="col">{t("wizard.summary.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const statusClass =
                row.status === "filled"
                  ? "filled"
                  : row.status === "optional"
                    ? "optional"
                    : row.status === "na"
                      ? "na"
                      : "pending";
              return (
                <tr
                  key={row.id}
                  className={`form-snapshot__row${row.isStepSummary ? " form-snapshot__row--step" : ""}${row.isNext ? " form-snapshot__row--next" : ""}${row.status === "filled" ? " form-snapshot__row--filled" : ""}`}
                >
                  <td className="form-snapshot__label">{row.label}</td>
                  <td className={`form-snapshot__value${row.value ? "" : " form-snapshot__value--hint"}`}>
                    {row.value ?? row.hint}
                  </td>
                  <td>
                    <span className={`form-snapshot__status form-snapshot__status--${statusClass}`}>
                      {snapshotStatusLabel(row.status, t, row.isNext)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
