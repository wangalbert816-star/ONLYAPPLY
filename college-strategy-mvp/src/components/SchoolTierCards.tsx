import type { SchoolRow, SchoolTier } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { proseToBullets } from "../lib/textBullets";
import "./SchoolTierCards.css";

function whyCell(row: SchoolRow, tier: SchoolTier): string {
  if (tier === "reach") return row.why_reach_for_you || "";
  if (tier === "match") return row.why_match_for_you || "";
  return row.why_safety_for_you || "";
}

function tierTitle(tier: SchoolTier, t: Translate): string {
  if (tier === "reach") return t("report.tierReach");
  if (tier === "match") return t("report.tierMatch");
  return t("report.tierSafety");
}

function BulletList({ items, lockedLabel }: { items: string[]; lockedLabel?: string }) {
  if (!items.length && lockedLabel) {
    return <p className="school-card__locked">{lockedLabel}</p>;
  }
  if (!items.length) return null;
  return (
    <ul className="school-card__bullets">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

function SchoolCard({
  row,
  tier,
  t,
  unlocked,
  highlight,
}: {
  row: SchoolRow;
  tier: SchoolTier;
  t: Translate;
  unlocked: boolean;
  highlight?: boolean;
}) {
  const whyBullets = proseToBullets(whyCell(row, tier), 5);
  const signals = row.key_fit_signals ?? [];
  const risks = row.key_risks ?? [];
  const verify = row.verification_focus ?? [];
  const links = row.official_links ?? [];

  return (
    <article className={`school-card${highlight ? " school-card--highlight" : ""}`}>
      <header className="school-card__header">
        <h3 className="school-card__name">{row.school}</h3>
        <span className="school-card__tier">{tierTitle(tier, t)}</span>
      </header>
      {row.campus_vibe ? (
        <p className="school-card__vibe">
          <span className="school-card__label">{t("report.schoolCard.vibe")}</span>
          {row.campus_vibe}
        </p>
      ) : null}
      {row.school_differentiator ? (
        <p className="school-card__diff">
          <span className="school-card__label">{t("report.schoolCard.diff")}</span>
          {row.school_differentiator}
        </p>
      ) : null}
      <div className="school-card__block">
        <p className="school-card__label">{t("report.schoolCard.why")}</p>
        <BulletList items={whyBullets} />
      </div>
      {unlocked ? (
        <>
          {signals.length > 0 && (
            <div className="school-card__block">
              <p className="school-card__label">{t("report.thSignals")}</p>
              <BulletList items={signals} />
            </div>
          )}
          {risks.length > 0 && (
            <div className="school-card__block">
              <p className="school-card__label">{t("report.thRisks")}</p>
              <BulletList items={risks} />
            </div>
          )}
          {verify.length > 0 && (
            <div className="school-card__block">
              <p className="school-card__label">{t("report.thVerify")}</p>
              <BulletList items={verify} />
            </div>
          )}
          {links.length > 0 && (
            <div className="school-card__links">
              <p className="school-card__label">{t("report.schoolCard.links")}</p>
              <ul>
                {links.map((l, i) => (
                  <li key={i}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="school-card__locked">{t("report.lockRowSub")}</p>
      )}
    </article>
  );
}

type Props = {
  tier: SchoolTier;
  rows: SchoolRow[];
  t: Translate;
  unlocked: boolean;
  highlightSchoolKeys?: Set<string>;
  lockedPlaceholderCount?: number;
  /** 外层已有折叠标题时不重复 h2 */
  hideHeading?: boolean;
};

export function SchoolTierCards({
  tier,
  rows,
  t,
  unlocked,
  highlightSchoolKeys,
  lockedPlaceholderCount = 0,
  hideHeading = false,
}: Props) {
  if (!rows.length) return null;
  const visible = unlocked ? rows : rows.slice(0, 1);
  const lockedCount = unlocked ? 0 : Math.max(lockedPlaceholderCount, rows.length - 1);

  return (
    <div className="school-tier-cards">
      {!hideHeading && (
        <h2 className="school-tier-cards__heading">
          {tierTitle(tier, t)}
          {!unlocked && lockedCount > 0 && (
            <span className="inline-hint">{t("report.tierMore", { n: lockedCount })}</span>
          )}
        </h2>
      )}
      <div className="school-tier-cards__grid">
        {visible.map((row, i) => (
          <SchoolCard
            key={`${row.school}-${i}`}
            row={row}
            tier={tier}
            t={t}
            unlocked={unlocked}
            highlight={highlightSchoolKeys?.has(row.school.trim().toLowerCase())}
          />
        ))}
        {!unlocked &&
          rows.slice(1).map((_, i) => (
            <div key={`lock-${i}`} className="school-card school-card--locked">
              <span className="lock-icon" aria-hidden>
                🔒
              </span>
              {t("report.lockRow", { n: i + 2 })}
              <span className="lock-sub">{t("report.lockRowSub")}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
