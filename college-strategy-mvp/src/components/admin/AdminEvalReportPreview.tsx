import { useLanguage } from "../../i18n/LanguageContext";
import type { EvalReportPreview } from "../../lib/admin/evalCaseForm";

type ExpectedTier = { school: string; note?: string };

type Props = {
  expectedReach: ExpectedTier[];
  expectedMatch: ExpectedTier[];
  expectedSafety: ExpectedTier[];
  preview: EvalReportPreview;
};

function formatExpectedList(list: ExpectedTier[]) {
  if (!list.length) return "—";
  return list.map((s) => (s.note ? `${s.school}（${s.note}）` : s.school)).join(" · ");
}

function TierBlock({
  title,
  expected,
  rows,
}: {
  title: string;
  expected: ExpectedTier[];
  rows: EvalReportPreview["reach"];
}) {
  return (
    <div className="admin-eval-preview__tier">
      <h4 className="admin-eval-preview__tier-title">{title}</h4>
      <p className="admin-eval-preview__expected-line">
        <span className="admin-eval-preview__label">标准</span>
        {formatExpectedList(expected)}
      </p>
      <ul className="admin-eval-preview__schools">
        {rows.length === 0 ? (
          <li className="admin-eval-preview__empty">—</li>
        ) : (
          rows.map((row) => (
            <li key={row.school} className="admin-eval-preview__school">
              <p className="admin-eval-preview__school-name">{row.school}</p>
              {row.why ? <p className="admin-eval-preview__why">{row.why}</p> : null}
              {row.risks.length > 0 ? (
                <p className="admin-eval-preview__risk">
                  {row.risks.slice(0, 2).join(" · ")}
                </p>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function AdminEvalReportPreview({ expectedReach, expectedMatch, expectedSafety, preview }: Props) {
  const { t } = useLanguage();

  return (
    <div className="admin-eval-preview">
      {preview.summaryBullets.length > 0 ? (
        <div className="admin-eval-preview__block">
          <h4 className="admin-eval-preview__block-title">{t("admin.eval.previewSummary")}</h4>
          <ul className="admin-eval-preview__bullets">
            {preview.summaryBullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="admin-eval-preview__tiers">
        <TierBlock title={t("admin.eval.reachLabel")} expected={expectedReach} rows={preview.reach} />
        <TierBlock title={t("admin.eval.matchLabel")} expected={expectedMatch} rows={preview.match} />
        <TierBlock title={t("admin.eval.safetyLabel")} expected={expectedSafety} rows={preview.safety} />
      </div>

      {preview.informationGaps.length > 0 ? (
        <div className="admin-eval-preview__block">
          <h4 className="admin-eval-preview__block-title">{t("admin.eval.previewGaps")}</h4>
          <ul className="admin-eval-preview__bullets">
            {preview.informationGaps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.improvementPlan.length > 0 ? (
        <div className="admin-eval-preview__block">
          <h4 className="admin-eval-preview__block-title">{t("admin.eval.previewPlan")}</h4>
          <ul className="admin-eval-preview__bullets">
            {preview.improvementPlan.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.portfolioRisks.length > 0 ? (
        <div className="admin-eval-preview__block">
          <h4 className="admin-eval-preview__block-title">{t("admin.eval.previewRisks")}</h4>
          <ul className="admin-eval-preview__bullets">
            {preview.portfolioRisks.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
