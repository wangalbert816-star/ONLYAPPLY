import { BrandLogo } from "./BrandLogo";
import { LandingHeroPreview } from "./LandingHeroPreview";
import { UniversityLogoMarquee } from "./UniversityLogoMarquee";
import { SampleReportShowcase } from "./SampleReportShowcase";
import { SampleReportAutoScroll } from "./SampleReportAutoScroll";
import { LandingCalendlyEmbed } from "./LandingCalendlyEmbed";
import "./LandingSampleReportPeek.css";
import "./LandingPageReplica.css";
import { LanguageToggle } from "../i18n/LanguageToggle";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuthChrome } from "../auth/AuthChromeContext";
import { useState, type ReactNode } from "react";
import type { Locale } from "../i18n/strings";

type Props = {
  landingMarqueeVisible: boolean;
  onStart: () => void;
  onOpenBrandStory: () => void;
  onOpenAboutUs: () => void;
  onBookExpertConsult: () => void;
};

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function HeroTitleLine1({ text, locale }: { text: string; locale: Locale }) {
  if (locale === "en") {
    const lower = text.toLowerCase();
    const idx = lower.indexOf("before");
    if (idx !== -1) {
      const before = text.slice(0, idx);
      const mid = text.slice(idx, idx + 6);
      const after = text.slice(idx + 6);
      return (
        <>
          {before}
          <span className="text-[var(--landing-accent,#006644)]">{mid}</span>
          {after}
        </>
      );
    }
  }
  return <>{text}</>;
}

function IconQuestion() {
  return (
    <svg className="h-6 w-6 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 4.6 1.2c-.9.5-1.1 1-1.1 1.8V13" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconList() {
  return (
    <svg className="h-6 w-6 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />
    </svg>
  );
}

/** Step 03: verify on official sites */
function IconCheck() {
  return (
    <svg className="h-6 w-6 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5 10.5 15 16 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg className="h-5 w-5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" strokeLinecap="round" />
    </svg>
  );
}

function IconUserCard() {
  return (
    <svg className="h-5 w-5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15h4M7 11h10" strokeLinecap="round" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg className="h-5 w-5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      <path d="M10.3 3.6 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconLinkOut() {
  return (
    <svg className="h-5 w-5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14 3h7v7M10 14 21 3M21 14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepChevron({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-emerald-300 ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HowItWorksStepCard({
  step,
  title,
  body,
  icon,
}: {
  step: string;
  title: string;
  body: string;
  icon: ReactNode;
}) {
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_48px_-24px_rgba(37,99,235,0.14)] lg:p-7">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500"
        aria-hidden
      />
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="text-[13px] font-bold tracking-[0.2em] text-emerald-700">{step}</span>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100/80">
          {icon}
        </div>
      </div>
      <h3 className="mb-2.5 text-[17px] font-semibold leading-snug tracking-[-0.02em] text-neutral-950 lg:text-[18px]">{title}</h3>
      <p className="mt-auto text-[14px] leading-relaxed text-neutral-600">{body}</p>
    </article>
  );
}

function IconChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 ${className}`.trim()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LandingFaqItem({ id, question, answer }: { id: string; question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`landing-faq__item overflow-hidden rounded-2xl border border-slate-400/30 bg-slate-200/95 shadow-sm transition-shadow ${
        open ? "border-slate-500/45 shadow-[0_4px_24px_rgba(0,0,0,0.22)]" : "border-slate-400/22"
      }`}
    >
      <h3 className="m-0">
        <button
          type="button"
          id={`${id}-trigger`}
          className="landing-faq__trigger flex w-full items-start justify-between gap-4 text-left font-semibold text-neutral-950 transition hover:bg-slate-300/75"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{question}</span>
          <IconChevronDown className={`mt-0.5 shrink-0 text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </h3>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-trigger`} hidden={!open}>
        <div className="border-t border-slate-300/90 bg-slate-200/80">
          <p className="landing-faq__answer m-0 text-neutral-600">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function LandingPageReplica({
  landingMarqueeVisible,
  onStart,
  onOpenBrandStory,
  onOpenAboutUs,
  onBookExpertConsult,
}: Props) {
  const { t, locale } = useLanguage();
  const { onOpenAccount } = useAuthChrome();
  const tf = (k: string) => t(k);

  const testimonials = [
    {
      initials: tf("landingReplica.testimonial1Initials"),
      name: tf("landingReplica.testimonial1Name"),
      meta: tf("landingReplica.testimonial1Meta"),
      quote: tf("landingReplica.testimonial1Quote"),
    },
    {
      initials: tf("landingReplica.testimonial2Initials"),
      name: tf("landingReplica.testimonial2Name"),
      meta: tf("landingReplica.testimonial2Meta"),
      quote: tf("landingReplica.testimonial2Quote"),
    },
    {
      initials: tf("landingReplica.testimonial3Initials"),
      name: tf("landingReplica.testimonial3Name"),
      meta: tf("landingReplica.testimonial3Meta"),
      quote: tf("landingReplica.testimonial3Quote"),
    },
    {
      initials: tf("landingReplica.testimonial4Initials"),
      name: tf("landingReplica.testimonial4Name"),
      meta: tf("landingReplica.testimonial4Meta"),
      quote: tf("landingReplica.testimonial4Quote"),
    },
    {
      initials: tf("landingReplica.testimonial5Initials"),
      name: tf("landingReplica.testimonial5Name"),
      meta: tf("landingReplica.testimonial5Meta"),
      quote: tf("landingReplica.testimonial5Quote"),
    },
    {
      initials: tf("landingReplica.testimonial6Initials"),
      name: tf("landingReplica.testimonial6Name"),
      meta: tf("landingReplica.testimonial6Meta"),
      quote: tf("landingReplica.testimonial6Quote"),
    },
  ];

  const howItWorksSteps = [
    { step: "01", icon: <IconQuestion />, title: tf("productIntro.steps.s1Title"), body: tf("productIntro.steps.s1Body") },
    { step: "02", icon: <IconList />, title: tf("productIntro.steps.s2Title"), body: tf("productIntro.steps.s2Body") },
    { step: "03", icon: <IconCheck />, title: tf("productIntro.steps.s3Title"), body: tf("productIntro.steps.s3Body") },
  ];

  const faqItems = Array.from({ length: 8 }, (_, i) => {
    const n = i + 1;
    return {
      q: tf(`landingReplica.faqQ${n}`),
      a: tf(`landingReplica.faqA${n}`),
    };
  }).filter((item) => item.q && item.a && !item.q.startsWith("landingReplica."));

  return (
    <div className="landing-page-replica flex min-h-dvh flex-col bg-[var(--landing-page-bg,#ecf3ea)] pb-24 text-neutral-900 antialiased">
      {/* —— Sticky nav —— */}
      <header className="sticky top-0 z-40 shrink-0 border-b border-[#006644]/12 bg-[var(--landing-page-bg,#ecf3ea)]/95 backdrop-blur-sm">
        <div className="landing-header-inner mx-auto flex min-h-[52px] max-w-[1320px] min-w-0 items-center justify-between gap-3 px-4 py-2 lg:min-h-[60px] lg:gap-5 lg:px-12">
          <button
            type="button"
            onClick={onOpenBrandStory}
            className="landing-header-brand -m-1 flex min-w-0 shrink items-center rounded-md p-1 transition hover:bg-[#006644]/8 active:bg-[#006644]/12"
            aria-label="OnlyApply"
          >
            <BrandLogo className="landing-header-logo block h-9 w-auto max-w-full lg:h-10" />
          </button>
          <nav className="landing-header-nav hidden shrink-0 items-center gap-8 text-[15px] font-medium text-neutral-600 md:flex" aria-label="Primary">
            <button type="button" className="whitespace-nowrap transition hover:text-neutral-950" onClick={onOpenAboutUs}>
              {tf("aboutUs.nav")}
            </button>
            <button type="button" className="whitespace-nowrap transition hover:text-neutral-950" onClick={() => scrollToId("landing-how-it-works")}>
              {tf("app.productIntroLink")}
            </button>
            <button type="button" className="whitespace-nowrap transition hover:text-neutral-950" onClick={() => scrollToId("landing-sample-output")}>
              {tf("landingReplica.navSampleReport")}
            </button>
            <button type="button" className="whitespace-nowrap transition hover:text-neutral-950" onClick={() => scrollToId("landing-faq")}>
              {tf("landingReplica.navFaq")}
            </button>
          </nav>
          <div className="landing-header-actions landing-header-actions--mobile md:hidden">
            <button
              type="button"
              onClick={onOpenAccount}
              className="landing-btn landing-btn--secondary landing-btn--sm landing-header-actions__apps"
            >
              {t("auth.myApplications")}
            </button>
            <div className="landing-header-actions__pair">
              <div className="landing-header-actions__lang">
                <LanguageToggle />
              </div>
              <button type="button" onClick={onStart} className="landing-btn landing-btn--primary landing-btn--sm">
                {tf("app.welcome.start")}
              </button>
            </div>
          </div>
          <div className="landing-header-actions hidden shrink-0 items-center gap-2 md:flex sm:gap-3">
            <LanguageToggle />
            <button
              type="button"
              onClick={onOpenAccount}
              className="landing-btn landing-btn--secondary landing-btn--sm"
            >
              {t("auth.myApplications")}
            </button>
            <button type="button" onClick={onStart} className="landing-btn landing-btn--primary landing-btn--sm">
              {tf("app.welcome.start")}
            </button>
          </div>
        </div>
        <nav className="landing-mobile-nav border-t border-neutral-100 bg-[var(--landing-page-bg,#ecf3ea)] md:hidden" aria-label="Primary mobile">
          <div className="landing-mobile-nav__track">
            <button type="button" onClick={onOpenAboutUs}>
              {tf("aboutUs.nav")}
            </button>
            <button type="button" onClick={() => scrollToId("landing-how-it-works")}>
              {tf("app.productIntroLink")}
            </button>
            <button type="button" onClick={() => scrollToId("landing-sample-output")}>
              {tf("landingReplica.navSampleReport")}
            </button>
            <button type="button" onClick={() => scrollToId("landing-faq")}>
              {tf("landingReplica.navFaq")}
            </button>
          </div>
        </nav>
      </header>

      {/* —— First screen: hero sits lower; logo banner flush to viewport bottom —— */}
      <div className="landing-first-fold flex min-h-0 flex-1 flex-col">
          <section className="landing-hero-section mx-auto flex w-full max-w-[1120px] flex-col justify-start px-6 pb-5 pt-6 lg:flex-1 lg:justify-end lg:px-10 lg:pb-6 lg:pt-16">
            <div className="landing-hero-grid grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:items-center lg:gap-x-12 lg:gap-y-0">
            <div className="min-w-0">
              <p className="landing-hero-badge mb-3 inline-flex rounded-full border border-emerald-200/90 bg-emerald-50/90 px-3 py-1.5 text-[12px] font-semibold tracking-wide text-emerald-900">
                {tf("landingReplica.heroBadge")}
              </p>
              <h1 className="landing-hero-title mb-3 text-[clamp(1.85rem,4.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.035em] text-neutral-950">
                <span className="block">
                  <HeroTitleLine1 text={tf("app.hero.titleLine1")} locale={locale} />
                </span>
                <span className="landing-hero-title__sub mt-1 block text-[clamp(1.15rem,2.8vw,1.5rem)] font-medium leading-snug tracking-[-0.02em] text-neutral-600 lg:text-[clamp(1.2rem,2.5vw,1.45rem)]">
                  {tf("app.hero.titleLine2")}
                </span>
              </h1>
              <p className="landing-hero-lead mb-6 max-w-[32rem] text-[15px] leading-[1.55] text-neutral-600 lg:text-[16px]">{tf("app.hero.lead")}</p>
              <div className="landing-hero-ctas flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <button
                  type="button"
                  onClick={onStart}
                  className="landing-btn landing-btn--black landing-btn--md min-h-[48px]"
                >
                  {tf("app.welcome.start")} →
                </button>
                <button
                  type="button"
                  onClick={() => scrollToId("landing-booking")}
                  className="landing-btn landing-btn--primary landing-btn--md min-h-[48px]"
                >
                  <span className="md:hidden">{tf("landingReplica.heroBookConsultMobile")}</span>
                  <span className="hidden md:inline">{tf("landingReplica.heroBookConsult")}</span>
                </button>
              </div>
            </div>
            <div className="landing-hero-preview-col min-w-0 lg:pt-1">
              <LandingHeroPreview />
            </div>
          </div>
          </section>

          <section
            className="landing-band-marquee landing-marquee-bridge mt-auto shrink-0 pt-5 pb-0 lg:pt-6 lg:pb-0"
            aria-label={tf("landingReplica.socialLabel")}
          >
            <div className="mx-auto max-w-[1120px] px-6 text-center lg:px-10">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                {tf("landingReplica.socialLabel")}
              </p>
              <div
                className={
                  landingMarqueeVisible
                    ? "overflow-hidden opacity-100 max-h-[320px] transition-all duration-700 ease-out"
                    : "pointer-events-none overflow-hidden opacity-0 max-h-0 transition-all duration-700 ease-out"
                }
                aria-hidden={!landingMarqueeVisible}
              >
                <UniversityLogoMarquee colored className="landing-hero-marquee" durationSec={140} />
              </div>
            </div>
          </section>
      </div>

      <main>
        {/* —— Testimonials —— */}
        <section className="landing-band-beige mx-auto max-w-none px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 text-center text-[clamp(1.35rem,3.2vw,1.875rem)] font-bold tracking-tight text-neutral-950 lg:mb-10">
              {tf("landingReplica.testimonialsTitle")}
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {testimonials.map((card) => (
                <article
                  key={`${card.initials}-${card.name}`}
                  className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[13px] font-bold text-neutral-700">
                      {card.initials}
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-neutral-950">{card.name}</p>
                      <p className="text-[13px] text-neutral-500">{card.meta}</p>
                    </div>
                  </div>
                  <p className="text-[14px] italic leading-relaxed text-neutral-600">{card.quote}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* —— How it works —— */}
        <section id="landing-how-it-works" className="scroll-mt-20 bg-[var(--landing-page-bg,#ecf3ea)] py-14 lg:py-20">
          <div className="mx-auto max-w-[1120px] px-6 lg:px-10">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{tf("app.productIntroLink")}</p>
            <h2 className="mb-3 text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.03em] text-neutral-950">
              {tf("landingReplica.stepsH1")}
            </h2>
            <p className="mb-12 max-w-[36rem] text-[16px] leading-relaxed text-neutral-600 lg:mb-14">{tf("landingReplica.stepsSub")}</p>

            {/* Mobile: vertical timeline */}
            <ol className="flex flex-col gap-0 lg:hidden">
              {howItWorksSteps.map((item, idx, arr) => (
                <li key={item.step} className="relative">
                  {idx < arr.length - 1 ? (
                    <span
                      className="absolute bottom-0 left-[1.35rem] top-[4.5rem] w-px bg-gradient-to-b from-emerald-200 to-neutral-200"
                      aria-hidden
                    />
                  ) : null}
                  <div className={idx < arr.length - 1 ? "pb-6" : ""}>
                    <HowItWorksStepCard {...item} />
                  </div>
                  {idx < arr.length - 1 ? (
                    <div className="flex justify-center py-1" aria-hidden>
                      <StepChevron className="rotate-90 text-emerald-200" />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            {/* Desktop: three equal columns */}
            <ol className="hidden lg:grid lg:grid-cols-3 lg:gap-8" aria-label={tf("app.productIntroLink")}>
              {howItWorksSteps.map((item) => (
                <li key={item.step} className="min-w-0">
                  <HowItWorksStepCard {...item} />
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* —— What you get —— */}
        <section className="landing-band-beige py-14 lg:py-20">
          <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-12 px-6 lg:grid-cols-2 lg:gap-x-16 lg:px-10">
            <div className="min-w-0">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{tf("landingReplica.whatEyebrow")}</p>
              <h2 className="mb-3 text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.03em] text-neutral-950">
                {tf("landingReplica.whatTitle")}
              </h2>
              <p className="mb-10 text-[16px] leading-relaxed text-neutral-600">{tf("landingReplica.whatSub")}</p>
              <ul className="flex flex-col gap-7">
                <li className="flex gap-4">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/80">
                    <IconTarget />
                  </div>
                  <div>
                    <p className="mb-1 text-[16px] font-semibold text-neutral-950">{tf("landingReplica.feature1Title")}</p>
                    <p className="text-[14px] leading-relaxed text-neutral-600">{tf("landingReplica.feature1Body")}</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/80">
                    <IconUserCard />
                  </div>
                  <div>
                    <p className="mb-1 text-[16px] font-semibold text-neutral-950">{tf("landingReplica.feature2Title")}</p>
                    <p className="text-[14px] leading-relaxed text-neutral-600">{tf("landingReplica.feature2Body")}</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/80">
                    <IconAlert />
                  </div>
                  <div>
                    <p className="mb-1 text-[16px] font-semibold text-neutral-950">{tf("landingReplica.feature3Title")}</p>
                    <p className="text-[14px] leading-relaxed text-neutral-600">{tf("landingReplica.feature3Body")}</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/80">
                    <IconLinkOut />
                  </div>
                  <div>
                    <p className="mb-1 text-[16px] font-semibold text-neutral-950">{tf("landingReplica.feature4Title")}</p>
                    <p className="text-[14px] leading-relaxed text-neutral-600">{tf("landingReplica.feature4Body")}</p>
                  </div>
                </li>
              </ul>
            </div>
            <div id="landing-sample-output" className="min-h-0 min-w-0 scroll-mt-24 lg:h-full">
              <div className="sample-report-peek-shell border border-neutral-200/90">
                <p className="sample-report-peek-shell__label px-5 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 lg:px-8 lg:pt-8">
                  {tf("landingReplica.sampleOutputLabel")}
                </p>
                <div className="sample-report-peek-shell__body">
                  <SampleReportAutoScroll className="sample-report-peek-scroll px-5 pb-5 lg:px-8 lg:pb-8">
                    <SampleReportShowcase locale={locale} t={t} />
                  </SampleReportAutoScroll>
                  <div className="sample-report-peek-fade" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* —— 1:1 booking (Calendly inline) —— */}
        <section id="landing-booking" className="landing-navy-band scroll-mt-20 pb-0 pt-20 text-neutral-950 lg:pb-2 lg:pt-28">
          <div className="mx-auto max-w-[1100px] px-6 lg:px-10">
            <div className="landing-band-copy mb-8 text-center lg:mb-10">
              <p className="landing-band-copy__eyebrow mb-3 text-[12px] font-semibold uppercase tracking-[0.1em]">
                {tf("landingReplica.bookingEyebrow")}
              </p>
              <h2 className="landing-band-copy__title text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.03em]">
                {tf("landingReplica.bookingTitle")}
              </h2>
            </div>
            <LandingCalendlyEmbed onFallback={onBookExpertConsult} />
          </div>
        </section>

        {/* —— FAQ (same Babson green band as AI section above) —— */}
        <section id="landing-faq" className="scroll-mt-20 bg-[var(--landing-navy,#006644)] pb-20 pt-14 lg:pb-24 lg:pt-16">
          <div className="mx-auto max-w-[min(52rem,100%)] px-6 lg:px-10">
            <h2 className="landing-faq__title text-center text-white">{tf("landingReplica.navFaq")}</h2>
            <div className="landing-faq__list flex flex-col">
              {faqItems.map((item, idx) => (
                <LandingFaqItem key={idx} id={`landing-faq-${idx}`} question={item.q} answer={item.a} />
              ))}
            </div>
          </div>
        </section>

        <div className="landing-fade-navy-to-page" aria-hidden />

        {/* —— Final CTA —— */}
        <section className="bg-[var(--landing-page-bg,#ecf3ea)] py-20 lg:py-28">
          <div className="mx-auto max-w-[640px] px-6 text-center lg:px-10">
            <h2 className="mb-3 text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.03em] text-neutral-950">{tf("landingReplica.finalTitle")}</h2>
            <p className="mb-8 text-[16px] text-neutral-600">{tf("landingReplica.finalSub")}</p>
            <button
              type="button"
              onClick={onStart}
              className="landing-btn landing-btn--primary landing-btn--md min-h-[52px] min-w-[200px] px-8"
            >
              {tf("app.welcome.start")} →
            </button>
            <p className="mt-4 text-[12px] text-neutral-400">{tf("landingReplica.finalDisclaimer")}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
