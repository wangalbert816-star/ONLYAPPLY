import { useMemo } from "react";
import type { ProfileDimension, ProfileDimensionKey } from "../../lib/fiveDimensionProfile";
import { PROFILE_DIMENSION_KEYS } from "../../lib/schoolFiveDimensionBenchmarks";
import type { SchoolBenchmarkScores } from "../../lib/schoolFiveDimensionBenchmarks";
import type { Translate } from "../../i18n/LanguageContext";

const VIEW_W = 328;
const VIEW_H = 276;
const CX = 164;
const CY = 128;
const R = 74;
const R_LABEL = 96;
const ANGLES_DEG = [-90, -18, 54, 126, 198];

function pt(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function polygonForScores(scores: number[]): string {
  return scores
    .map((score, i) => {
      const clamp = Math.max(8, Math.min(100, score)) / 100;
      const { x, y } = pt(ANGLES_DEG[i], R * clamp);
      return `${i === 0 ? "" : " "}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join("");
}

function polygonForScale(scale: number): string {
  return ANGLES_DEG.map((deg, i) => {
    const { x, y } = pt(deg, R * scale);
    return `${i === 0 ? "" : " "}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join("");
}

type Props = {
  userDimensions: ProfileDimension[];
  schoolScores: SchoolBenchmarkScores;
  t: Translate;
};

export function SchoolFitComparisonRadar({ userDimensions, schoolScores, t }: Props) {
  const userScores = useMemo(() => {
    const byKey = Object.fromEntries(userDimensions.map((d) => [d.key, d.score])) as Record<
      ProfileDimensionKey,
      number
    >;
    return PROFILE_DIMENSION_KEYS.map((k) => byKey[k] ?? 0);
  }, [userDimensions]);

  const schoolPoly = useMemo(() => polygonForScores(benchmarkScoresToList(schoolScores)), [schoolScores]);
  const userPoly = useMemo(() => polygonForScores(userScores), [userScores]);

  const labelItems = PROFILE_DIMENSION_KEYS.map((key, i) => {
    const deg = ANGLES_DEG[i];
    const { x, y } = pt(deg, R_LABEL);
    const anchor: "start" | "end" | "middle" = x > CX + 10 ? "start" : x < CX - 10 ? "end" : "middle";
    const dy = y < CY - 18 ? -4 : y > CY + 18 ? 16 : 6;
    return { key, x, y, dy, anchor };
  });

  return (
    <div className="school-fit-radar">
      <svg
        className="school-fit-radar__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={t("auth.accountSchoolFit.chartAria")}
      >
        <title>{t("auth.accountSchoolFit.chartAria")}</title>
        {[0.25, 0.5, 0.75, 1].map((s) => (
          <polygon key={s} className="school-fit-radar__grid" points={polygonForScale(s)} fill="none" />
        ))}
        {ANGLES_DEG.map((deg) => {
          const outer = pt(deg, R);
          const inner = pt(deg, 0);
          return (
            <line
              key={deg}
              className="school-fit-radar__axis"
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
            />
          );
        })}
        <polygon className="school-fit-radar__area school-fit-radar__area--school" points={schoolPoly} />
        <polyline className="school-fit-radar__stroke school-fit-radar__stroke--school" points={schoolPoly} />
        <polygon className="school-fit-radar__area school-fit-radar__area--user" points={userPoly} />
        <polyline className="school-fit-radar__stroke school-fit-radar__stroke--user" points={userPoly} />
        {labelItems.map(({ key, x, y, dy, anchor }) => (
          <text key={key} className="school-fit-radar__label" x={x} y={y + dy} textAnchor={anchor}>
            {t(`report.profileFive.axisShort.${key}`)}
          </text>
        ))}
      </svg>
      <ul className="school-fit-radar__legend" aria-hidden={false}>
        <li>
          <span className="school-fit-radar__swatch school-fit-radar__swatch--user" />
          {t("auth.accountSchoolFit.legendYou")}
        </li>
        <li>
          <span className="school-fit-radar__swatch school-fit-radar__swatch--school" />
          {t("auth.accountSchoolFit.legendSchool")}
        </li>
      </ul>
    </div>
  );
}

function benchmarkScoresToList(scores: SchoolBenchmarkScores): number[] {
  return PROFILE_DIMENSION_KEYS.map((k) => scores[k]);
}
