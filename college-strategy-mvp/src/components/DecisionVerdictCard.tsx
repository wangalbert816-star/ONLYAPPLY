import type { OverallVerdict } from "../lib/decisionReport";
import type { Translate } from "../i18n/LanguageContext";

export function DecisionVerdictCard({ verdict, t }: { verdict: OverallVerdict; t: Translate }) {
  return (
    <div className="decision-verdict-card" role="region" aria-labelledby="decision-verdict-title">
      <p className="decision-verdict-eyebrow">{t("report.decision.verdictEyebrow")}</p>
      <h3 id="decision-verdict-title" className="decision-verdict-headline">
        {verdict.headline}
      </h3>
      {verdict.subline && <p className="decision-verdict-subline">{verdict.subline}</p>}
      <ul className="decision-verdict-bullets">
        <li>
          <span className="decision-verdict-tag decision-verdict-tag--ok">{t("report.decision.bulletAdvantage")}</span>
          {verdict.advantage}
        </li>
        <li>
          <span className="decision-verdict-tag decision-verdict-tag--risk">{t("report.decision.bulletWeakness")}</span>
          {verdict.weakness}
        </li>
        <li>
          <span className="decision-verdict-tag decision-verdict-tag--go">{t("report.decision.bulletStrategy")}</span>
          {verdict.strategy}
        </li>
      </ul>
    </div>
  );
}
