import type { ProfileDimension } from "../../lib/fiveDimensionProfile";
import type { ReportPayload, SchoolTier } from "../../types";
import "./AccountReportSnapshot.css";

function tierLabel(tier: SchoolTier, t: (key: string) => string) {
  if (tier === "reach") return t("report.tierReach");
  if (tier === "match") return t("report.tierMatch");
  return t("report.tierSafety");
}

type Props = {
  report: ReportPayload;
  dimensions: ProfileDimension[];
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export function AccountReportSnapshot({ report, dimensions, t }: Props) {
  const tiers: { tier: SchoolTier; school: string }[] = [
    { tier: "reach", school: report.reach?.[0]?.school ?? "—" },
    { tier: "match", school: report.match?.[0]?.school ?? "—" },
    { tier: "safety", school: report.safety?.[0]?.school ?? "—" },
  ];

  const weakest = dimensions.reduce((min, item) => (item.score < min.score ? item : min), dimensions[0]);

  return (
    <aside className="account-snapshot" aria-label={t("auth.accountSnapshotTitle")}>
      <header className="account-snapshot__head">
        <div>
          <p className="account-snapshot__kicker">{t("auth.accountSnapshotTitle")}</p>
          <p className="account-snapshot__sub">{t("auth.accountSnapshotSub")}</p>
        </div>
      </header>

      <ul className="account-snapshot__tiers">
        {tiers.map(({ tier, school }) => (
          <li key={tier} className={`account-snapshot__tier account-snapshot__tier--${tier}`}>
            <span className="account-snapshot__tier-pill">{tierLabel(tier, t)}</span>
            <span className="account-snapshot__tier-school" title={school}>
              {school}
            </span>
          </li>
        ))}
      </ul>

      <section className="account-snapshot__profile" aria-labelledby="account-snapshot-profile-title">
        <div className="account-snapshot__profile-head">
          <h3 id="account-snapshot-profile-title">{t("report.profileFive.title")}</h3>
          {weakest && (
            <p className="account-snapshot__profile-spot">
              {t(`report.profileFive.axisShort.${weakest.key}`)} · {weakest.judgment}
            </p>
          )}
        </div>

        <ul className="account-snapshot__dims">
          {dimensions.map((dim) => (
            <li key={dim.key} className="account-snapshot__dim">
              <div className="account-snapshot__dim-head">
                <span className="account-snapshot__dim-label">{t(`report.profileFive.axis.${dim.key}`)}</span>
                <span className="account-snapshot__dim-score">{t("report.profileFive.score", { n: dim.score })}</span>
              </div>
              <div className="account-snapshot__dim-track" aria-hidden>
                <span className="account-snapshot__dim-fill" style={{ width: `${Math.max(8, Math.min(100, dim.score))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
