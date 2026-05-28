import { useEffect, useMemo, useState } from "react";
import type { ProfileDimension } from "../../lib/fiveDimensionProfile";
import {
  collectReportSchoolOptions,
  lookupSchoolBenchmark,
  PROFILE_DIMENSION_KEYS,
  type ReportSchoolOption,
} from "../../lib/schoolFiveDimensionBenchmarks";
import type { ReportPayload, SchoolTier } from "../../types";
import type { Translate } from "../../i18n/LanguageContext";
import { SchoolFitComparisonRadar } from "./SchoolFitComparisonRadar";
import "./SchoolFitComparisonCard.css";

const GAP_THRESHOLD = 8;

type Props = {
  report: ReportPayload;
  userDimensions: ProfileDimension[];
  t: Translate;
};

function tierLabel(tier: SchoolTier, t: Translate) {
  if (tier === "reach") return t("report.tierReach");
  if (tier === "match") return t("report.tierMatch");
  return t("report.tierSafety");
}

export function SchoolFitComparisonCard({ report, userDimensions, t }: Props) {
  const schools = useMemo(() => collectReportSchoolOptions(report), [report]);
  const [selectedSchool, setSelectedSchool] = useState("");

  useEffect(() => {
    if (schools.length === 0) {
      setSelectedSchool("");
      return;
    }
    setSelectedSchool((prev) => {
      if (prev && schools.some((s) => s.school === prev)) return prev;
      return schools[0].school;
    });
  }, [schools]);

  const selected = useMemo(
    () => schools.find((s) => s.school === selectedSchool) ?? schools[0] ?? null,
    [schools, selectedSchool],
  );

  const benchmark = useMemo(() => {
    if (!selected) return null;
    return lookupSchoolBenchmark(selected.school, selected.tier);
  }, [selected]);

  const gaps = useMemo(() => {
    if (!benchmark) return [];
    const byKey = Object.fromEntries(userDimensions.map((d) => [d.key, d.score]));
    return PROFILE_DIMENSION_KEYS.map((key) => {
      const user = byKey[key] ?? 0;
      const bench = benchmark.scores[key];
      const delta = user - bench;
      return { key, user, bench, delta };
    }).filter((row) => row.delta < -GAP_THRESHOLD);
  }, [benchmark, userDimensions]);

  if (schools.length === 0 || userDimensions.length === 0) return null;

  return (
    <section className="account-school-fit" aria-labelledby="account-school-fit-title">
      <header className="account-school-fit__head">
        <div>
          <p className="account-school-fit__kicker">{t("auth.accountSchoolFit.kicker")}</p>
          <h2 id="account-school-fit-title">{t("auth.accountSchoolFit.title")}</h2>
          <p className="account-school-fit__lead">{t("auth.accountSchoolFit.lead")}</p>
        </div>
        <label className="account-school-fit__picker">
          <span className="account-school-fit__picker-label">{t("auth.accountSchoolFit.schoolLabel")}</span>
          <select
            value={selected?.school ?? ""}
            onChange={(e) => setSelectedSchool(e.target.value)}
            aria-describedby="account-school-fit-disclaimer"
          >
            {schools.map((opt: ReportSchoolOption) => (
              <option key={opt.school} value={opt.school}>
                {opt.school} · {tierLabel(opt.tier, t)}
              </option>
            ))}
          </select>
        </label>
      </header>

      {benchmark && selected && (
        <div className="account-school-fit__body">
          <SchoolFitComparisonRadar
            userDimensions={userDimensions}
            schoolScores={benchmark.scores}
            t={t}
          />

          <div className="account-school-fit__side">
            <ul className="account-school-fit__scores">
              {PROFILE_DIMENSION_KEYS.map((key) => {
                const user = userDimensions.find((d) => d.key === key)?.score ?? 0;
                const bench = benchmark.scores[key];
                const delta = user - bench;
                const behind = delta < -GAP_THRESHOLD;
                const ahead = delta > GAP_THRESHOLD;
                return (
                  <li
                    key={key}
                    className={`account-school-fit__score-row${behind ? " account-school-fit__score-row--behind" : ""}${ahead ? " account-school-fit__score-row--ahead" : ""}`}
                  >
                    <span className="account-school-fit__score-label">{t(`report.profileFive.axis.${key}`)}</span>
                    <span className="account-school-fit__score-values">
                      <span className="account-school-fit__score-you">
                        {t("auth.accountSchoolFit.youShort", { n: user })}
                      </span>
                      <span className="account-school-fit__score-vs" aria-hidden>
                        /
                      </span>
                      <span className="account-school-fit__score-bench">
                        {t("auth.accountSchoolFit.benchShort", { n: bench })}
                      </span>
                    </span>
                    <span className="account-school-fit__score-delta">
                      {delta >= 0 ? "+" : ""}
                      {delta}
                    </span>
                  </li>
                );
              })}
            </ul>

            {gaps.length > 0 ? (
              <div className="account-school-fit__gaps">
                <p className="account-school-fit__gaps-title">{t("auth.accountSchoolFit.gapsTitle")}</p>
                <ul>
                  {gaps.map((g) => (
                    <li key={g.key}>
                      {t("auth.accountSchoolFit.gapLine", {
                        axis: t(`report.profileFive.axisShort.${g.key}`),
                        n: Math.abs(Math.round(g.delta)),
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="account-school-fit__aligned">{t("auth.accountSchoolFit.aligned")}</p>
            )}

            {benchmark.source === "tier" && (
              <p className="account-school-fit__tier-note">{t("auth.accountSchoolFit.tierFallback")}</p>
            )}
          </div>
        </div>
      )}

      <p id="account-school-fit-disclaimer" className="account-school-fit__disclaimer">
        {t("auth.accountSchoolFit.disclaimer")}
      </p>
    </section>
  );
}
