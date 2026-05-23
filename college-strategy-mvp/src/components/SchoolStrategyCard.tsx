import { useState } from "react";
import type { FormState, SchoolRow, SchoolTier } from "../types";
import type { Locale } from "../i18n/strings";
import { campusCultureAlignmentNote } from "../lib/campusCulturePref";
import { enrichSchoolRow } from "../lib/enrichSchoolRow";
import { splitToBullets } from "../lib/schoolRowDisplay";
import { getOfficialLinksForSchool, officialLinkLabel } from "../lib/universityOfficialLinks";
import { linkForVerificationItem } from "../lib/verificationLinkMatch";
import "./SchoolStrategyCard.css";

type Props = {
  row: SchoolRow;
  tier: SchoolTier;
  locale: Locale;
  form: FormState;
  unlocked: boolean;
  highlighted?: boolean;
};

function whyText(row: SchoolRow, tier: SchoolTier): string {
  if (tier === "reach") return row.why_reach_for_you || "";
  if (tier === "match") return row.why_match_for_you || "";
  return row.why_safety_for_you || "";
}

function sectionLabel(
  key: "why" | "signals" | "risks" | "verify" | "links" | "vibe" | "diff" | "context" | "cultureFit",
  locale: Locale,
): string {
  const zh = {
    why: "入档理由",
    signals: "匹配信号",
    risks: "主要风险",
    verify: "官网核对",
    links: "官方链接",
    vibe: "校园气质",
    diff: "与同档其它校的差异",
    context: "语境化参考",
    cultureFit: "与你的社区偏好",
  };
  const en = {
    why: "Why this tier",
    signals: "Fit signals",
    risks: "Key risks",
    verify: "Verify on official site",
    links: "Official links",
    vibe: "Campus vibe",
    diff: "How this school differs",
    context: "Context to verify",
    cultureFit: "Vs your campus vibe preference",
  };
  return locale === "en" ? en[key] : zh[key];
}

export function SchoolStrategyCard({ row, tier, locale, form, unlocked, highlighted }: Props) {
  const [open, setOpen] = useState(false);
  const enriched = enrichSchoolRow(row, form, locale);
  const whyBullets = splitToBullets(whyText(enriched, tier), 4);
  const signals = splitToBullets(enriched.key_fit_signals, 4);
  const risks = splitToBullets(enriched.key_risks, 4);
  const verify = splitToBullets(enriched.verification_focus, 5);
  const links = getOfficialLinksForSchool(enriched.school, locale);
  const vibe = enriched.campus_vibe?.trim();
  const diff = enriched.differentiation?.trim();
  const context = enriched.context_note?.trim();
  const cultureFit = campusCultureAlignmentNote(form, enriched, locale);

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
        <span className="school-card__name">{enriched.school}</span>
      </button>

      {open && (
        <div className="school-card__body">
          {vibe ? (
            <div className="school-card__block">
              <p className="school-card__label">{sectionLabel("vibe", locale)}</p>
              <span className="school-card__vibe">{vibe}</span>
              {unlocked && cultureFit ? (
                <p className="school-card__culture-fit">{cultureFit}</p>
              ) : null}
            </div>
          ) : null}

          {whyBullets.length > 0 ? (
            <div className="school-card__block">
              <p className="school-card__label">{sectionLabel("why", locale)}</p>
              <ul className="school-card__list">
                {whyBullets.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {unlocked && diff ? (
            <div className="school-card__block">
              <p className="school-card__label">{sectionLabel("diff", locale)}</p>
              <p className="school-card__diff-text">{diff}</p>
            </div>
          ) : null}

          {unlocked ? (
            <>
              {signals.length > 0 ? (
                <div className="school-card__block">
                  <p className="school-card__label">{sectionLabel("signals", locale)}</p>
                  <ul className="school-card__list">
                    {signals.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {risks.length > 0 ? (
                <div className="school-card__block">
                  <p className="school-card__label">{sectionLabel("risks", locale)}</p>
                  <ul className="school-card__list school-card__list--risks">
                    {risks.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {verify.length > 0 ? (
                <div className="school-card__block">
                  <p className="school-card__label">{sectionLabel("verify", locale)}</p>
                  <ul className="school-card__list school-card__list--verify">
                    {verify.map((item, i) => {
                      const vLink = linkForVerificationItem(item, links);
                      return (
                        <li key={i} className="school-card__verify-item">
                          <span>{item}</span>
                          {vLink ? (
                            <a
                              className="school-card__verify-link"
                              href={vLink.href}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {officialLinkLabel(vLink, locale)} ↗
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {context ? (
                <div className="school-card__block">
                  <p className="school-card__label">{sectionLabel("context", locale)}</p>
                  <ul className="school-card__list school-card__list--context">
                    <li>{context}</li>
                  </ul>
                </div>
              ) : null}
              {links.length > 0 ? (
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
              ) : null}
            </>
          ) : (
            <p className="school-card__lock-hint">
              <span className="lock-icon" aria-hidden>
                🔒
              </span>
              {locale === "en"
                ? "Unlock for differentiation, risks, context notes, and official links."
                : "解锁后查看差异说明、风险、语境参考与官网链接。"}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
