import { useState } from "react";
import { SampleReportShowcase } from "./SampleReportShowcase";
import { LegalLinks } from "./LegalLinks";
import { useLanguage } from "../i18n/LanguageContext";
import "./ProductIntroPage.css";

type Props = {
  /** Standalone intro page shows hero + footer; landing embed skips hero */
  variant?: "page" | "embedded";
  id?: string;
  onStart?: () => void;
};

export function ProductIntroContent({ variant = "page", id, onStart }: Props) {
  const { t, locale } = useLanguage();
  const [legalOpen, setLegalOpen] = useState<"terms" | "privacy" | "disclaimer" | null>(null);
  const embedded = variant === "embedded";
  const idPrefix = embedded ? "landing-intro" : "intro";

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
    t("productIntro.privacy.b4"),
    t("productIntro.privacy.b5"),
    t("productIntro.privacy.b6"),
  ];

  return (
    <div id={id} className={embedded ? "landing-product-intro" : undefined}>
      {embedded && (
        <h2 className="landing-product-intro__heading">{t("productIntro.eyebrow")}</h2>
      )}

      {!embedded && (
        <div className="intro-hero card">
          <p className="intro-eyebrow">{t("productIntro.eyebrow")}</p>
          <h1>{t("productIntro.title")}</h1>
          <p className="intro-lead">{t("productIntro.lead")}</p>
        </div>
      )}

      <section className="intro-section card" aria-labelledby={`${idPrefix}-what-title`}>
        <h2 id={`${idPrefix}-what-title`}>{t("productIntro.whatTitle")}</h2>
        <p>{t("productIntro.whatBody")}</p>
        <h3 className="intro-subtitle">{t("productIntro.notTitle")}</h3>
        <ul className="intro-list">
          {notList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="intro-section card" aria-labelledby={`${idPrefix}-steps-title`}>
        <h2 id={`${idPrefix}-steps-title`}>{t("productIntro.stepsTitle")}</h2>
        <ol className="intro-steps">
          {steps.map((step, i) => (
            <li key={step.title}>
              <span className="intro-step-num" aria-hidden>
                {i + 1}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="intro-section card" aria-labelledby={`${idPrefix}-method-title`}>
        <h2 id={`${idPrefix}-method-title`}>{t("productIntro.methodTitle")}</h2>
        <p className="intro-method-lead">{t("productIntro.methodLead")}</p>
        <ul className="intro-list intro-list--checks">
          {principles.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="intro-section card" aria-labelledby={`${idPrefix}-sample-title`}>
        <h2 id={`${idPrefix}-sample-title`}>{t("productIntro.sampleTitle")}</h2>
        <p>{t("productIntro.sampleLead")}</p>
        <SampleReportShowcase locale={locale} t={t} />
      </section>

      <section className="intro-section card intro-section--privacy" aria-labelledby={`${idPrefix}-privacy-title`}>
        <h2 id={`${idPrefix}-privacy-title`}>{t("productIntro.privacy.title")}</h2>
        <p>{t("productIntro.privacy.lead")}</p>
        <ul className="intro-list intro-list--privacy">
          {privacyBullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <button type="button" className="intro-privacy-link" onClick={() => setLegalOpen("privacy")}>
          {t("productIntro.privacy.policyLink")}
        </button>
        {embedded && <LegalLinks className="intro-footer__legal" openDoc={legalOpen} onOpenDocChange={setLegalOpen} />}
      </section>

      {onStart && (
        <div className="intro-cta card">
          <button type="button" className="btn btn-primary btn-block btn-cta-landing" onClick={onStart}>
            {t("productIntro.startCta")}
          </button>
        </div>
      )}

      {!embedded && (
        <footer className="intro-footer" role="contentinfo">
          <LegalLinks className="intro-footer__legal" openDoc={legalOpen} onOpenDocChange={setLegalOpen} />
        </footer>
      )}
    </div>
  );
}
