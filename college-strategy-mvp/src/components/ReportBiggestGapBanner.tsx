import type { BiggestGapBlock } from "../lib/decisionReport";
import type { Translate } from "../i18n/LanguageContext";

export function ReportBiggestGapBanner({
  block,
  t,
  embedded = false,
}: {
  block: BiggestGapBlock;
  t: Translate;
  embedded?: boolean;
}) {
  const axis = t(`report.profileFive.axis.${block.dimension.key}`);
  return (
    <div
      className={`report-biggest-gap${embedded ? " report-biggest-gap--embedded" : ""}`}
      role="region"
      aria-labelledby={embedded ? undefined : "report-biggest-gap-title"}
    >
      {!embedded && (
        <h3 id="report-biggest-gap-title" className="report-biggest-gap__title">
          {t("report.decision.biggestGapTitle")}
        </h3>
      )}
      <p className="report-biggest-gap__headline">
        <strong>{axis}</strong>
        <span className="report-biggest-gap__score"> · {t("report.profileFive.score", { n: block.dimension.score })}</span>
      </p>
      <p className="report-biggest-gap__judgment">{block.dimension.judgment}</p>
      <p className="report-biggest-gap__stake">{block.stakeLine}</p>
      <p className="report-biggest-gap__reason">
        <strong>{t("report.profileFive.reasonLabel")}</strong>
        {block.dimension.explain}
      </p>
      <p className="report-biggest-gap__suggest">
        <strong>{t("report.profileFive.suggestAdvisorLabel")}</strong>
        {block.dimension.suggest}
      </p>
    </div>
  );
}
