import { BrandLogo } from "./BrandLogo";
import { LegalLinks } from "./LegalLinks";
import { SampleReportShowcase } from "./SampleReportShowcase";
import { useLanguage } from "../i18n/LanguageContext";
import "./ProductIntroPage.css";

type Props = {
  onBack: () => void;
  onStart: () => void;
};

export function ProductIntroPage({ onBack, onStart }: Props) {
  const { t, locale } = useLanguage();

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

  return (
    <div className="app app--intro">
      <header className="intro-header">
        <button type="button" className="intro-back" onClick={onBack}>
          {t("productIntro.back")}
        </button>
        <BrandLogo className="intro-logo" />
      </header>

      <div className="intro-hero card">
        <p className="intro-eyebrow">{t("productIntro.eyebrow")}</p>
        <h1>{t("productIntro.title")}</h1>
        <p className="intro-lead">{t("productIntro.lead")}</p>
      </div>

      <section className="intro-section card" aria-labelledby="intro-what-title">
        <h2 id="intro-what-title">{t("productIntro.whatTitle")}</h2>
        <p>{t("productIntro.whatBody")}</p>
        <h3 className="intro-subtitle">{t("productIntro.notTitle")}</h3>
        <ul className="intro-list">
          {notList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="intro-section card" aria-labelledby="intro-steps-title">
        <h2 id="intro-steps-title">{t("productIntro.stepsTitle")}</h2>
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

      <section className="intro-section card" aria-labelledby="intro-method-title">
        <h2 id="intro-method-title">{t("productIntro.methodTitle")}</h2>
        <p className="intro-method-lead">{t("productIntro.methodLead")}</p>
        <ul className="intro-list intro-list--checks">
          {principles.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="intro-section card" aria-labelledby="intro-sample-title">
        <h2 id="intro-sample-title">{t("productIntro.sampleTitle")}</h2>
        <p>{t("productIntro.sampleLead")}</p>
        <SampleReportShowcase locale={locale} t={t} />
      </section>

      <div className="intro-cta card">
        <button type="button" className="btn btn-primary btn-block" onClick={onStart}>
          {t("productIntro.startCta")}
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={onBack}>
          {t("productIntro.back")}
        </button>
      </div>

      <footer className="intro-footer" role="contentinfo">
        <p>{t("app.disclaimer")}</p>
        <LegalLinks className="intro-footer__legal" />
      </footer>
    </div>
  );
}
