import type { SchoolRow, SchoolTier, UcAnalysis } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import "./UcStrategySection.css";

type Props = {
  uc: UcAnalysis;
  t: Translate;
  unlocked: boolean;
};

function whyCell(row: SchoolRow, tier: SchoolTier): string {
  if (tier === "reach") return row.why_reach_for_you || "";
  if (tier === "match") return row.why_match_for_you || "";
  return row.why_safety_for_you || "";
}

function clamp(text: string, max: number): string {
  const v = (text || "").replace(/\s+/g, " ").trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max)}…`;
}

function tierTitle(tier: SchoolTier, t: Translate): string {
  if (tier === "reach") return t("report.uc.tierReach");
  if (tier === "match") return t("report.uc.tierMatch");
  return t("report.uc.tierSafety");
}

function CampusTable({
  tier,
  rows,
  t,
  unlocked,
}: {
  tier: SchoolTier;
  rows: SchoolRow[];
  t: Translate;
  unlocked: boolean;
}) {
  if (!rows.length) return null;
  const visible = unlocked ? rows : rows.slice(0, 1);
  const lockedCount = unlocked ? 0 : Math.max(0, rows.length - 1);

  return (
    <section className="uc-strategy-tier">
      <h3 className="uc-strategy-tier__title">{tierTitle(tier, t)}</h3>
      <div className="table-wrap uc-strategy-table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("report.thSchool")}</th>
              <th>{t("report.thWhy")}</th>
              {unlocked && (
                <>
                  <th>{t("report.thRisks")}</th>
                  <th>{t("report.thVerify")}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={`${row.school}-${i}`}>
                <td>{row.school}</td>
                <td>{clamp(whyCell(row, tier), unlocked ? 140 : 88)}</td>
                {unlocked && (
                  <>
                    <td>
                      {(row.key_risks || []).map((x, j) => (
                        <div key={j}>{clamp(x, 90)}</div>
                      ))}
                    </td>
                    <td>
                      {(row.verification_focus || []).map((x, j) => (
                        <div key={j}>{clamp(x, 90)}</div>
                      ))}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!unlocked && lockedCount > 0 && (
        <p className="uc-strategy-lock">
          <span className="lock-icon" aria-hidden>
            🔒
          </span>
          {t("report.uc.tierMore", { n: lockedCount })}
        </p>
      )}
    </section>
  );
}

export function UcStrategySection({ uc, t, unlocked }: Props) {
  return (
    <section className="card report-block uc-strategy" aria-labelledby="uc-strategy-title">
      <p className="uc-strategy__eyebrow">{t("report.uc.eyebrow")}</p>
      <h2 id="uc-strategy-title">{t("report.uc.title")}</h2>
      <p className="uc-strategy__lead">{uc.overview}</p>

      <div className="uc-strategy-callout uc-strategy-callout--test-blind" role="note">
        <strong>{t("report.uc.testBlindLabel")}</strong>
        <p>{uc.test_blind_note}</p>
      </div>

      <p className="uc-strategy__app-note">{uc.application_note}</p>

      <CampusTable tier="reach" rows={uc.reach} t={t} unlocked={unlocked} />
      <CampusTable tier="match" rows={uc.match} t={t} unlocked={unlocked} />
      <CampusTable tier="safety" rows={uc.safety} t={t} unlocked={unlocked} />

      {unlocked ? (
        <>
          <div className="uc-strategy-subblock">
            <h3>{t("report.uc.checklistTitle")}</h3>
            <ul>
              {uc.checklist.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="uc-strategy-subblock">
            <h3>{t("report.uc.piqTitle")}</h3>
            <ul>
              {uc.piq_directions.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          {uc.information_gaps.length > 0 && (
            <div className="uc-strategy-subblock">
              <h3>{t("report.uc.gapsTitle")}</h3>
              <ul>
                {uc.information_gaps.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="uc-strategy-lock uc-strategy-lock--block">
          <span className="lock-icon" aria-hidden>
            🔒
          </span>
          {t("report.uc.previewLocked")}
        </p>
      )}
    </section>
  );
}
