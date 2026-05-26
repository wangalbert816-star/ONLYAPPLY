import { BrandLogo } from "./BrandLogo";
import { LandingHeroPreview } from "./LandingHeroPreview";
import { UniversityLogoMarquee } from "./UniversityLogoMarquee";
import { SampleReportShowcase } from "./SampleReportShowcase";
import { SampleReportAutoScroll } from "./SampleReportAutoScroll";
import "./LandingSampleReportPeek.css";
import { LanguageToggle } from "../i18n/LanguageToggle";
import { useLanguage } from "../i18n/LanguageContext";
import type { Locale } from "../i18n/strings";

type Props = {
  landingMarqueeVisible: boolean;
  onStart: () => void;
  onOpenBrandStory: () => void;
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
          <span className="text-blue-600">{mid}</span>
          {after}
        </>
      );
    }
  }
  return <>{text}</>;
}

function IconPerson() {
  return (
    <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}

function IconList() {
  return (
    <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.36-2.64" strokeLinecap="round" />
      <path d="M3 12a9 9 0 0 1 9-9 4.5 4.5 0 0 1 4.5 4.5V8l4-4-4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" strokeLinecap="round" />
    </svg>
  );
}

function IconUserCard() {
  return (
    <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15h4M7 11h10" strokeLinecap="round" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      <path d="M10.3 3.6 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconLinkOut() {
  return (
    <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14 3h7v7M10 14 21 3M21 14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightMini() {
  return (
    <svg className="h-5 w-5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LandingPageReplica({ landingMarqueeVisible, onStart, onOpenBrandStory, onBookExpertConsult }: Props) {
  const { t, locale } = useLanguage();
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
  ];

  const dontItems = [
    tf("landingReplica.aiDont1"),
    tf("landingReplica.aiDont2"),
    tf("landingReplica.aiDont3"),
    tf("landingReplica.aiDont4"),
    tf("landingReplica.aiDont5"),
  ];
  const doItems = [
    tf("landingReplica.aiDo1"),
    tf("landingReplica.aiDo2"),
    tf("landingReplica.aiDo3"),
    tf("landingReplica.aiDo4"),
    tf("landingReplica.aiDo5"),
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-white pb-28 text-neutral-900 antialiased">
      {/* —— Sticky nav —— */}
      <header className="sticky top-0 z-40 shrink-0 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex min-h-[56px] max-w-[1120px] items-center justify-between gap-4 px-6 py-2.5 sm:min-h-[60px] lg:px-10">
          <button
            type="button"
            onClick={onOpenBrandStory}
            className="-m-1 flex shrink-0 items-center rounded-md p-1 transition hover:bg-neutral-200/50"
            aria-label="OnlyApply"
          >
            <BrandLogo className="onlyapply-logo landing-header-logo block h-9 w-auto sm:h-10" />
          </button>
          <nav className="hidden items-center gap-8 text-[15px] font-medium text-neutral-600 md:flex" aria-label="Primary">
            <button type="button" className="transition hover:text-neutral-950" onClick={() => scrollToId("landing-how-it-works")}>
              {tf("app.productIntroLink")}
            </button>
            <button type="button" className="transition hover:text-neutral-950" onClick={() => scrollToId("landing-sample-output")}>
              {tf("landingReplica.navSampleReport")}
            </button>
            <button type="button" className="transition hover:text-neutral-950" onClick={() => scrollToId("landing-faq")}>
              {tf("landingReplica.navFaq")}
            </button>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <div className="scale-95">
              <LanguageToggle />
            </div>
            <button
              type="button"
              onClick={onStart}
              className="hidden rounded-[10px] border border-neutral-300 bg-white px-4 py-2 text-[14px] font-semibold text-neutral-950 shadow-sm transition hover:border-neutral-400 sm:inline-block"
            >
              {tf("app.welcome.start")}
            </button>
          </div>
        </div>
        <nav className="flex border-t border-neutral-100 bg-white px-6 py-2.5 md:hidden" aria-label="Primary mobile">
          <div className="flex w-full justify-between gap-2 text-[13px] font-medium text-neutral-600">
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

      {/* —— First screen (lg+): hero + marquee; marquee flush to viewport bottom —— */}
      <div className="landing-first-fold lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <section className="mx-auto w-full max-w-[1120px] flex-1 px-6 pb-16 pt-10 lg:flex lg:min-h-0 lg:flex-col lg:justify-center lg:px-10 lg:pb-6 lg:pt-6">
            <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:items-center lg:gap-x-14 lg:gap-y-0">
            <div className="min-w-0">
              <p className="mb-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[12px] font-semibold tracking-wide text-blue-700">
                {tf("landingReplica.heroBadge")}
              </p>
              <h1 className="mb-4 text-[clamp(2rem,5vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.035em] text-neutral-950">
                <span className="block">
                  <HeroTitleLine1 text={tf("app.hero.titleLine1")} locale={locale} />
                </span>
                <span className="mt-1 block text-[clamp(1.15rem,2.8vw,1.5rem)] font-medium leading-snug tracking-[-0.02em] text-neutral-600 lg:text-[clamp(1.2rem,2.5vw,1.45rem)]">
                  {tf("app.hero.titleLine2")}
                </span>
              </h1>
              <p className="mb-8 max-w-[32rem] text-[16px] leading-[1.55] text-neutral-600 lg:text-[17px]">{tf("app.hero.lead")}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <button
                  type="button"
                  onClick={onStart}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-[10px] bg-neutral-950 px-6 text-[15px] font-semibold text-white transition hover:bg-neutral-800"
                >
                  {tf("app.welcome.start")} →
                </button>
                <button
                  type="button"
                  onClick={onBookExpertConsult}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-[10px] bg-blue-600 px-6 text-[15px] font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  {tf("landingReplica.heroBookConsult")}
                </button>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-neutral-400">{tf("landingReplica.heroDisclaimerShort")}</p>
            </div>
            <div className="min-w-0 lg:pt-1">
              <LandingHeroPreview />
            </div>
          </div>
          </section>

          {/* Marquee sits on the bottom edge of the first viewport (lg+) */}
          <section
            className="shrink-0 border-t border-neutral-100 bg-[#f3f4f6] py-8 lg:py-7"
            aria-label={tf("landingReplica.socialLabel")}
          >
            <div className="mx-auto max-w-[1120px] px-6 text-center lg:px-10">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 lg:mb-3">
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
                <UniversityLogoMarquee colored className="landing-hero-marquee" durationSec={100} />
              </div>
            </div>
          </section>
      </div>

      <main>
        {/* —— Testimonials —— */}
        <section className="mx-auto max-w-[1120px] px-6 py-16 lg:px-10 lg:py-20">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
            {testimonials.map((card) => (
              <article
                key={card.name}
                className="rounded-2xl border border-neutral-100 bg-[#fafaf9] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
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
        </section>

        {/* —— How it works —— */}
        <section id="landing-how-it-works" className="scroll-mt-20 border-t border-neutral-100 bg-white py-16 lg:py-24">
          <div className="mx-auto max-w-[1120px] px-6 lg:px-10">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{tf("app.productIntroLink")}</p>
            <h2 className="mb-3 text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.03em] text-neutral-950">
              {tf("landingReplica.stepsH1")}
              <br />
              {tf("landingReplica.stepsH2")}
            </h2>
            <p className="mb-10 max-w-[36rem] text-[16px] leading-relaxed text-neutral-600">{tf("landingReplica.stepsSub")}</p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
              {/* Row 1 */}
              <article className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] md:min-h-[200px]">
                <p className="mb-3 text-[12px] font-bold text-blue-600/50">01</p>
                <div className="mb-3">
                  <IconPerson />
                </div>
                <h3 className="mb-2 text-[18px] font-semibold text-neutral-950">{tf("productIntro.steps.s1Title")}</h3>
                <p className="text-[14px] leading-relaxed text-neutral-600">{tf("productIntro.steps.s1Body")}</p>
              </article>
              <div className="hidden min-h-[120px] items-center justify-center rounded-2xl bg-[#f5f5f0] md:flex" aria-hidden>
                <ArrowRightMini />
              </div>
              <article className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] md:min-h-[200px]">
                <p className="mb-3 text-[12px] font-bold text-blue-600/50">02</p>
                <div className="mb-3">
                  <IconList />
                </div>
                <h3 className="mb-2 text-[18px] font-semibold text-neutral-950">{tf("productIntro.steps.s2Title")}</h3>
                <p className="text-[14px] leading-relaxed text-neutral-600">{tf("productIntro.steps.s2Body")}</p>
              </article>
              {/* Row 2 */}
              <div className="hidden min-h-[120px] items-center justify-center rounded-2xl bg-[#f5f5f0] md:flex" aria-hidden>
                <ArrowRightMini />
              </div>
              <article className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] md:min-h-[200px]">
                <p className="mb-3 text-[12px] font-bold text-blue-600/50">03</p>
                <div className="mb-3">
                  <IconRefresh />
                </div>
                <h3 className="mb-2 text-[18px] font-semibold text-neutral-950">{tf("productIntro.steps.s3Title")}</h3>
                <p className="text-[14px] leading-relaxed text-neutral-600">{tf("productIntro.steps.s3Body")}</p>
              </article>
              <div className="hidden md:block" aria-hidden />
            </div>
          </div>
        </section>

        {/* —— What you get —— */}
        <section className="border-t border-neutral-100 bg-[#f5f5f0] py-16 lg:py-24">
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

        {/* —— AI transparency —— */}
        <section className="bg-[#0a1128] py-16 text-white lg:py-24">
          <div className="mx-auto max-w-[1120px] px-6 lg:px-10">
            <p className="mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-400">{tf("landingReplica.aiEyebrow")}</p>
            <h2 className="mb-12 text-center text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.03em] text-white">{tf("landingReplica.aiTitle")}</h2>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
              <div>
                <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{tf("landingReplica.aiDontTitle")}</p>
                <ul className="flex flex-col gap-3.5">
                  {dontItems.map((line) => (
                    <li key={line} className="flex gap-3 text-[14px] leading-snug text-slate-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-[11px] font-bold text-red-300">
                        ×
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-600/50 bg-[#1e293b] p-6 lg:p-8">
                <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{tf("landingReplica.aiDoTitle")}</p>
                <ul className="flex flex-col gap-3.5">
                  {doItems.map((line) => (
                    <li key={line} className="flex gap-3 text-[14px] leading-snug text-slate-200">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/25 text-[11px] font-bold text-blue-300">
                        ✓
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* —— FAQ —— */}
        <section id="landing-faq" className="scroll-mt-20 border-t border-neutral-100 bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-[720px] px-6 lg:px-10">
            <h2 className="mb-8 text-center text-[22px] font-bold tracking-tight text-neutral-950">{tf("landingReplica.navFaq")}</h2>
            <dl className="flex flex-col gap-8">
              <div>
                <dt className="mb-2 text-[15px] font-semibold text-neutral-950">{tf("landingReplica.faqQ1")}</dt>
                <dd className="text-[14px] leading-relaxed text-neutral-600">{tf("landingReplica.faqA1")}</dd>
              </div>
              <div>
                <dt className="mb-2 text-[15px] font-semibold text-neutral-950">{tf("landingReplica.faqQ2")}</dt>
                <dd className="text-[14px] leading-relaxed text-neutral-600">{tf("landingReplica.faqA2")}</dd>
              </div>
              <div>
                <dt className="mb-2 text-[15px] font-semibold text-neutral-950">{tf("landingReplica.faqQ3")}</dt>
                <dd className="text-[14px] leading-relaxed text-neutral-600">{tf("landingReplica.faqA3")}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* —— Final CTA —— */}
        <section className="border-t border-neutral-100 bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-[640px] px-6 text-center lg:px-10">
            <h2 className="mb-3 text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.03em] text-neutral-950">{tf("landingReplica.finalTitle")}</h2>
            <p className="mb-8 text-[16px] text-neutral-600">{tf("landingReplica.finalSub")}</p>
            <button
              type="button"
              onClick={onStart}
              className="inline-flex min-h-[52px] min-w-[200px] items-center justify-center rounded-[10px] border border-neutral-300 bg-white px-8 text-[15px] font-semibold text-neutral-950 shadow-sm transition hover:border-neutral-400"
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
