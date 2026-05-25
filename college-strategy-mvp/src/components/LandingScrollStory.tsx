import { useMemo, useState } from "react";
import { getSampleReport } from "../data/sampleReport";
import { useLanguage } from "../i18n/LanguageContext";
import { LegalLinks } from "./LegalLinks";
import { SampleReportShowcase } from "./SampleReportShowcase";
import { UniversityLogoMarquee } from "./UniversityLogoMarquee";
import type { SchoolRow, SchoolTier } from "../types";
import "./LandingScrollStory.css";

type Props = {
  id?: string;
  onStart: () => void;
};

function tierLabel(tier: SchoolTier, t: (key: string) => string) {
  if (tier === "reach") return t("report.tierReach");
  if (tier === "match") return t("report.tierMatch");
  return t("report.tierSafety");
}

function TierCard({ tier, row, t }: { tier: SchoolTier; row?: SchoolRow; t: (key: string) => string }) {
  if (!row) return null;
  return (
    <article className={`landing-tier-card landing-tier-card--${tier}`}>
      <span className="landing-tier-card__pill">{tierLabel(tier, t)}</span>
      <h3 className="landing-tier-card__school">{row.school}</h3>
      <p className="landing-tier-card__why">{row.why_reach_for_you || row.why_match_for_you || row.why_safety_for_you}</p>
    </article>
  );
}

function ChapterHead({
  index,
  eyebrow,
  title1,
  title2,
  lead,
}: {
  index: string;
  eyebrow: string;
  title1: string;
  title2: string;
  lead?: string;
}) {
  return (
    <header className="landing-chapter__head">
      <div className="landing-chapter__meta">
        <span className="landing-chapter__index">{index}</span>
        <span className="landing-chapter__eyebrow">{eyebrow}</span>
      </div>
      <h2 className="landing-chapter__title">
        <span className="landing-chapter__title-line">{title1}</span>
        <span className="landing-chapter__title-line landing-chapter__title-line--accent">{title2}</span>
      </h2>
      {lead ? <p className="landing-chapter__lead">{lead}</p> : null}
    </header>
  );
}

function CtaBand({ lead, onStart, startLabel }: { lead: string; onStart: () => void; startLabel: string }) {
  return (
    <div className="landing-cta-band">
      <p className="landing-cta-band__lead">{lead}</p>
      <button type="button" className="btn btn-primary btn-cta-landing landing-cta-band__btn" onClick={onStart}>
        {startLabel}
      </button>
    </div>
  );
}

export function LandingScrollStory({ id, onStart }: Props) {
  const { t, locale } = useLanguage();
  const [legalOpen, setLegalOpen] = useState<"terms" | "privacy" | "disclaimer" | null>(null);
  const report = useMemo(() => getSampleReport(locale), [locale]);
  const startLabel = t("app.welcome.start");

  const steps = [
    { title: t("productIntro.steps.s1Title"), body: t("productIntro.steps.s1Body") },
    { title: t("productIntro.steps.s2Title"), body: t("productIntro.steps.s2Body") },
    { title: t("productIntro.steps.s3Title"), body: t("productIntro.steps.s3Body") },
  ];

  const principles = [
    t("productIntro.method.p1"),
    t("productIntro.method.p2"),
    t("productIntro.method.p3"),
    t("productIntro.method.p4"),
    t("productIntro.method.p5"),
  ];

  const notList = [t("productIntro.not.n1"), t("productIntro.not.n2"), t("productIntro.not.n3")];

  const privacyBullets = [
    t("productIntro.privacy.b1"),
    t("productIntro.privacy.b2"),
    t("productIntro.privacy.b3"),
  ];

  return (
    <div id={id} className="landing-scroll-story">
      <div className="landing-scroll-bridge" aria-hidden />

      <section className="landing-chapter landing-chapter--band landing-chapter--results" aria-labelledby="landing-ch-results">
        <div className="landing-chapter__inner">
          <ChapterHead
            index="01"
            eyebrow={t("landingScroll.results.eyebrow")}
            title1={t("landingScroll.results.title1")}
            title2={t("landingScroll.results.title2")}
            lead={t("landingScroll.results.lead")}
          />

          <ul className="landing-stat-row" aria-label={t("landingScroll.results.eyebrow")}>
            <li>{t("landingScroll.results.statSchools")}</li>
            <li>{t("landingScroll.results.statFive")}</li>
            <li>{t("landingScroll.results.statIterate")}</li>
          </ul>

          <p className="landing-chapter__subhead">{t("landingScroll.results.schoolsLabel")}</p>
          <div className="landing-tier-grid">
            <TierCard tier="reach" row={report.reach?.[0]} t={t} />
            <TierCard tier="match" row={report.match?.[0]} t={t} />
            <TierCard tier="safety" row={report.safety?.[0]} t={t} />
          </div>

          <ul className="landing-not-pills">
            {notList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="landing-chapter__marquee">
          <UniversityLogoMarquee colored durationSec={140} />
        </div>
      </section>

      <section className="landing-chapter landing-chapter--band landing-chapter--journey" aria-labelledby="landing-ch-journey">
        <div className="landing-chapter__inner">
          <ChapterHead
            index="02"
            eyebrow={t("landingScroll.journey.eyebrow")}
            title1={t("landingScroll.journey.title1")}
            title2={t("landingScroll.journey.title2")}
            lead={t("landingScroll.journey.lead")}
          />

          <ol className="landing-phase-grid">
            {steps.map((step, i) => (
              <li key={step.title} className="landing-phase-card">
                <span className="landing-phase-card__index">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="landing-phase-card__title">{step.title}</h3>
                <p className="landing-phase-card__body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="landing-chapter__cta-wrap">
        <CtaBand lead={t("landingScroll.ctaMidLead")} onStart={onStart} startLabel={startLabel} />
      </div>

      <section className="landing-chapter landing-chapter--band landing-chapter--method" aria-labelledby="landing-ch-method">
        <div className="landing-chapter__inner">
          <ChapterHead
            index="03"
            eyebrow={t("landingScroll.method.eyebrow")}
            title1={t("landingScroll.method.title1")}
            title2={t("landingScroll.method.title2")}
            lead={t("landingScroll.method.lead")}
          />
          <p className="landing-chapter__method-lead">{t("productIntro.methodLead")}</p>
          <ul className="landing-method-grid">
            {principles.map((item, i) => (
              <li key={item} className="landing-method-card">
                <span className="landing-method-card__check" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p>{item}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-chapter landing-chapter--sample" aria-labelledby="landing-ch-sample">
        <div className="landing-chapter__inner landing-chapter__inner--wide">
          <ChapterHead
            index="04"
            eyebrow={t("landingScroll.sample.eyebrow")}
            title1={t("landingScroll.sample.title1")}
            title2={t("landingScroll.sample.title2")}
            lead={t("productIntro.sampleLead")}
          />
          <div className="landing-sample-shell card">
            <SampleReportShowcase locale={locale} t={t} />
          </div>
        </div>
      </section>

      <div className="landing-scroll-fade landing-scroll-fade--to-muted" aria-hidden />

      <section className="landing-chapter landing-chapter--band landing-chapter--privacy" aria-labelledby="landing-ch-privacy">
        <div className="landing-chapter__inner">
          <ChapterHead
            index="05"
            eyebrow={t("landingScroll.privacy.eyebrow")}
            title1={t("landingScroll.privacy.title1")}
            title2={t("landingScroll.privacy.title2")}
            lead={t("productIntro.privacy.lead")}
          />
          <ul className="landing-privacy-list">
            {privacyBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <button type="button" className="landing-privacy-link" onClick={() => setLegalOpen("privacy")}>
            {t("productIntro.privacy.policyLink")}
          </button>
          <LegalLinks className="landing-privacy-legal" openDoc={legalOpen} onOpenDocChange={setLegalOpen} />

          <CtaBand lead={t("landingScroll.ctaFinalLead")} onStart={onStart} startLabel={startLabel} />
        </div>
      </section>
    </div>
  );
}
