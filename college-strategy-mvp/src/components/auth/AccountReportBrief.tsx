import type { ReportPayload } from "../../types";
import { sanitizeReportProse } from "../../lib/reportProseSanitize";
import type { Locale } from "../../i18n/strings";
import "./AccountReportBrief.css";

type Props = {
  report: ReportPayload;
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export function AccountReportBrief({ report, locale, t }: Props) {
  const safe = sanitizeReportProse(report, locale);
  const bullets = (safe.executive_summary ?? []).filter(Boolean).slice(0, 3);
  const tiers = [
    { key: "reach" as const, label: t("report.tierReach"), school: safe.reach?.[0]?.school },
    { key: "match" as const, label: t("report.tierMatch"), school: safe.match?.[0]?.school },
    { key: "safety" as const, label: t("report.tierSafety"), school: safe.safety?.[0]?.school },
  ].filter((row) => row.school?.trim());

  if (bullets.length === 0 && tiers.length === 0) return null;

  return (
    <section className="account-report-brief" aria-labelledby="account-report-brief-title">
      <header className="account-report-brief__head">
        <p className="account-report-brief__kicker">{t("auth.accountReportBriefKicker")}</p>
        <h3 id="account-report-brief-title">{t("auth.accountReportBriefTitle")}</h3>
      </header>

      {bullets.length > 0 ? (
        <ul className="account-report-brief__bullets">
          {bullets.map((line, index) => (
            <li key={`${index}-${line.slice(0, 24)}`} className={index === 0 ? "is-lead" : undefined}>
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {tiers.length > 0 ? (
        <ul className="account-report-brief__tiers">
          {tiers.map(({ key, label, school }) => (
            <li key={key} className={`account-report-brief__tier account-report-brief__tier--${key}`}>
              <span className="account-report-brief__tier-pill">{label}</span>
              <span className="account-report-brief__tier-school" title={school}>
                {school}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
