import { useState } from "react";
import type { SchoolRow, SchoolTier } from "../types";
import type { Locale } from "../i18n/strings";
import { splitToBullets } from "../lib/schoolRowDisplay";
import { getOfficialLinksForSchool, officialLinkLabel } from "../lib/universityOfficialLinks";
import "./SchoolStrategyCard.css";

type Props = {
  row: SchoolRow;
  tier: SchoolTier;
  locale: Locale;
  unlocked: boolean;
  highlighted?: boolean;
};

function whyText(row: SchoolRow, tier: SchoolTier): string {
  if (tier === "reach") return row.why_reach_for_you || "";
  if (tier === "match") return row.why_match_for_you || "";
  return row.why_safety_for_you || "";
}

function sectionLabel(key: "why" | "signals" | "risks" | "verify" | "links", locale: Locale): string {
  const zh = {
    why: "入档理由",
    signals: "匹配信号",
    risks: "主要风险",
    verify: "官网核对",
    links: "官方链接",
  };
  const en = {
    why: "Why this tier",
    signals: "Fit signals",
    risks: "Key risks",
    verify: "Verify on official site",
    links: "Official links",
  };
  return locale === "en" ? en[key] : zh[key];
}

export function SchoolStrategyCard({ row, tier, locale, unlocked, highlighted }: Props) {
  const [open, setOpen] = useState(false);
  const whyBullets = splitToBullets(whyText(row, tier), 4);
  const signals = splitToBullets(row.key_fit_signals, 4);
  const risks = splitToBullets(row.key_risks, 4);
  const verify = splitToBullets(row.verification_focus, 5);
  const links = getOfficialLinksForSchool(row.school, locale);

  return (
    <article className={`school-card${highlighted ? " school-card--hot" : ""}${open ? " school-card--open" : ""}`}>
      <button
        type="button"
        className="school-card__trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="school-card__chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className="school-card__name">{row.school}</span>
      </button>

      {open && (
        <div className="school-card__body">
          {whyBullets.length > 0 && (
            <div className="school-card__block">
              <p className="school-card__label">{sectionLabel("why", locale)}</p>
              <ul className="school-card__list">
                {whyBullets.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {unlocked ? (
            <>
              {signals.length > 0 && (
                <div className="school-card__block">
                  <p className="school-card__label">{sectionLabel("signals", locale)}</p>
                  <ul className="school-card__list">
                    {signals.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {risks.length > 0 && (
                <div className="school-card__block">
                  <p className="school-card__label">{sectionLabel("risks", locale)}</p>
                  <ul className="school-card__list school-card__list--risks">
                    {risks.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {verify.length > 0 && (
                <div className="school-card__block">
                  <p className="school-card__label">{sectionLabel("verify", locale)}</p>
                  <ul className="school-card__list">
                    {verify.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {links.length > 0 && (
                <div className="school-card__block school-card__links">
                  <p className="school-card__label">{sectionLabel("links", locale)}</p>
                  <ul className="school-card__link-list">
                    {links.map((link) => (
                      <li key={link.id}>
                        <a href={link.href} target="_blank" rel="noopener noreferrer">
                          {officialLinkLabel(link, locale)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="school-card__lock-hint">
              <span className="lock-icon" aria-hidden>
                🔒
              </span>
              {locale === "en" ? "Unlock for risks, verify checklist, and official links." : "解锁后查看风险、核对项与官网链接。"}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
