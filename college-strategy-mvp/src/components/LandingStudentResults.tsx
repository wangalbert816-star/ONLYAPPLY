import { useLanguage } from "../i18n/LanguageContext";
import { useAnimatedDecimal, useAnimatedNumber } from "../hooks/useAnimatedNumber";
import { useInViewOnce } from "../hooks/useInViewOnce";
import "./LandingStudentResults.css";

const COMPARISON_ROWS = [
  { metricKey: "resultsMetric1", before: 18, after: 94 },
  { metricKey: "resultsMetric2", before: 22, after: 91 },
  { metricKey: "resultsMetric3", before: 14, after: 89 },
  { metricKey: "resultsMetric4", before: 31, after: 96 },
] as const;

const SUMMARY_STATS = [
  { statKey: "resultsStat1", value: 97, suffix: "%", decimals: 0 },
  { statKey: "resultsStat2", value: 4.9, suffix: "/5", decimals: 1 },
  { statKey: "resultsStat3", value: 83, suffix: "%", decimals: 0 },
] as const;

function AnimatedPercent({ value, active }: { value: number; active: boolean }) {
  const n = useAnimatedNumber(value, active);
  return <>{n}%</>;
}

function ComparisonRow({
  label,
  before,
  after,
  index,
  active,
}: {
  label: string;
  before: number;
  after: number;
  index: number;
  active: boolean;
}) {
  const delay = `${index * 90}ms`;

  return (
    <div className="landing-results__row" style={{ ["--row-delay" as string]: delay }}>
      <p className="landing-results__metric">{label}</p>
      <div className="landing-results__cell">
        <span className="landing-results__pct">
          <AnimatedPercent value={before} active={active} />
        </span>
        <div className="landing-results__bar landing-results__bar--before" aria-hidden>
          <span className="landing-results__bar-fill" style={{ ["--bar-target" as string]: `${before}%` }} />
        </div>
      </div>
      <div className="landing-results__cell">
        <span className="landing-results__pct landing-results__pct--after">
          <AnimatedPercent value={after} active={active} />
        </span>
        <div className="landing-results__bar landing-results__bar--after" aria-hidden>
          <span className="landing-results__bar-fill" style={{ ["--bar-target" as string]: `${after}%` }} />
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  value,
  suffix,
  decimals,
  label,
  delayMs,
  active,
}: {
  value: number;
  suffix: string;
  decimals: number;
  label: string;
  delayMs: number;
  active: boolean;
}) {
  const whole = useAnimatedNumber(decimals === 0 ? value : 0, active, 950);
  const decimal = useAnimatedDecimal(decimals === 1 ? value : 0, active, 950);
  const display = decimals === 1 ? decimal.toFixed(1) : String(whole);

  return (
    <div className="landing-results__stat" style={{ ["--stat-delay" as string]: `${delayMs}ms` }}>
      <p className="landing-results__stat-value">
        {display}
        {suffix}
      </p>
      <p className="landing-results__stat-label">{label}</p>
    </div>
  );
}

export function LandingStudentResults() {
  const { t } = useLanguage();
  const { ref, visible } = useInViewOnce<HTMLElement>();

  return (
    <section
      ref={ref}
      id="landing-student-results"
      className={`landing-results scroll-mt-20 bg-[var(--landing-page-bg,#ecf3ea)] px-6 py-16 lg:px-10 lg:py-20${visible ? " is-visible" : ""}`}
      aria-labelledby="landing-student-results-title"
    >
      <div className="landing-results__inner">
        <header className="landing-results__head">
          <h2 id="landing-student-results-title" className="landing-results__title">
            {t("landingReplica.resultsTitle")}
          </h2>
          <p className="landing-results__sub">{t("landingReplica.resultsSub")}</p>
        </header>

        <div className="landing-results__cols" aria-hidden>
          <span />
          <p className="landing-results__col-label landing-results__col-label--before">{t("landingReplica.resultsBefore")}</p>
          <p className="landing-results__col-label landing-results__col-label--after">{t("landingReplica.resultsAfter")}</p>
        </div>

        <div className="landing-results__rows">
          {COMPARISON_ROWS.map((row, index) => (
            <ComparisonRow
              key={row.metricKey}
              label={t(`landingReplica.${row.metricKey}`)}
              before={row.before}
              after={row.after}
              index={index}
              active={visible}
            />
          ))}
        </div>

        <div className="landing-results__summary">
          {SUMMARY_STATS.map((stat, index) => (
            <SummaryStat
              key={stat.statKey}
              value={stat.value}
              suffix={stat.suffix}
              decimals={stat.decimals}
              label={t(`landingReplica.${stat.statKey}`)}
              delayMs={index * 100}
              active={visible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
