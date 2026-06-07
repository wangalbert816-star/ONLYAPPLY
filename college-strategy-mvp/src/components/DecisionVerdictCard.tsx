import type { OverallVerdict } from "../lib/decisionReport";
import type { ProfileDimension } from "../lib/fiveDimensionProfile";
import { profileScoreBand } from "../lib/fiveDimensionProfile";
import type { Translate } from "../i18n/LanguageContext";

type Props = {
  verdict: OverallVerdict;
  dimensions?: ProfileDimension[];
  t: Translate;
};

export function DecisionVerdictCard({ verdict, dimensions, t }: Props) {
  const topDimensions = (dimensions ?? []).slice(0, 4);

  return (
    <div className="decision-verdict-card" role="region" aria-labelledby="decision-verdict-title">
      {topDimensions.length > 0 ? (
        <div className="decision-verdict-scores" aria-label={t("report.decision.scoreGridAria")}>
          {topDimensions.map((d) => {
            const band = profileScoreBand(d.score);
            return (
              <div key={d.key} className={`decision-verdict-score decision-verdict-score--${band}`}>
                <span className="decision-verdict-score__label">{t(`report.profileFive.axisShort.${d.key}`)}</span>
                <span className="decision-verdict-score__value">
                  {d.score}
                  <small>/100</small>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
      <p id="decision-verdict-title" className="decision-verdict-headline">
        {verdict.headline}
      </p>
      {verdict.subline ? <p className="decision-verdict-subline">{verdict.subline}</p> : null}
      <div className="decision-verdict-tags" role="list">
        <span className="decision-verdict-tag decision-verdict-tag--ok" role="listitem">
          {t("report.decision.bulletAdvantage")}
        </span>
        <span className="decision-verdict-tag decision-verdict-tag--risk" role="listitem">
          {t("report.decision.bulletWeakness")}
        </span>
        <span className="decision-verdict-tag decision-verdict-tag--go" role="listitem">
          {t("report.decision.bulletStrategy")}
        </span>
      </div>
    </div>
  );
}
