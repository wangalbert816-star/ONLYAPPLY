import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { getSampleForm, getSampleReport } from "../data/sampleReport";
import { buildFiveDimensionProfile, type ProfileDimension } from "../lib/fiveDimensionProfile";
import type { SchoolRow, SchoolTier } from "../types";
import "./LandingHeroPreview.css";

const SLIDE_KEYS = ["draft", "five", "gaps"] as const;
const ROTATE_MS = 4800;

const RADAR_VIEW_W = 220;
const RADAR_VIEW_H = 188;
const RADAR_CX = 110;
const RADAR_CY = 88;
const RADAR_R = 54;
const RADAR_R_LABEL = 72;
const RADAR_ANGLES = [-90, -18, 54, 126, 198];

function radarPt(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: RADAR_CX + radius * Math.cos(rad), y: RADAR_CY + radius * Math.sin(rad) };
}

function radarPolygon(scale: number) {
  return RADAR_ANGLES.map((deg, i) => {
    const { x, y } = radarPt(deg, RADAR_R * scale);
    return `${i === 0 ? "" : " "}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join("");
}

type ReanalyzePhase = "idle" | "typing" | "submit" | "analyzing" | "done";

function tierLabel(tier: SchoolTier, t: (key: string) => string) {
  if (tier === "reach") return t("report.tierReach");
  if (tier === "match") return t("report.tierMatch");
  return t("report.tierSafety");
}

function TierRow({ tier, row, t }: { tier: SchoolTier; row?: SchoolRow; t: (key: string) => string }) {
  if (!row) return null;
  return (
    <div className={`landing-hero-preview__tier landing-hero-preview__tier--${tier}`}>
      <span className="landing-hero-preview__tier-pill">{tierLabel(tier, t)}</span>
      <span className="landing-hero-preview__tier-school">{row.school}</span>
    </div>
  );
}

function DraftSlide({ summary, report, t }: { summary: string; report: ReturnType<typeof getSampleReport>; t: (key: string) => string }) {
  return (
    <div className="landing-hero-preview__panel">
      <p className="landing-hero-preview__eyebrow">{t("report.summaryTitle")}</p>
      <p className="landing-hero-preview__summary">{summary}</p>
      <div className="landing-hero-preview__tiers">
        <TierRow tier="reach" row={report.reach?.[0]} t={t} />
        <TierRow tier="match" row={report.match?.[0]} t={t} />
        <TierRow tier="safety" row={report.safety?.[0]} t={t} />
      </div>
    </div>
  );
}

function MiniProfileRadar({
  dimensions,
  t,
  animate,
}: {
  dimensions: ProfileDimension[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  animate: boolean;
}) {
  const dataPts = dimensions.map((it, i) => {
    const clamp = Math.max(8, Math.min(100, it.score)) / 100;
    return radarPt(RADAR_ANGLES[i], RADAR_R * clamp);
  });
  const dataPoly = dataPts.map((p, i) => `${i === 0 ? "" : " "}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");

  return (
    <svg
      className={`landing-hero-preview__radar${animate ? " landing-hero-preview__radar--animate" : ""}`}
      viewBox={`0 0 ${RADAR_VIEW_W} ${RADAR_VIEW_H}`}
      role="img"
      aria-hidden
    >
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon key={s} className="landing-hero-preview__radar-grid" points={radarPolygon(s)} fill="none" />
      ))}
      {RADAR_ANGLES.map((deg) => {
        const outer = radarPt(deg, RADAR_R);
        return (
          <line
            key={deg}
            className="landing-hero-preview__radar-axis"
            x1={RADAR_CX}
            y1={RADAR_CY}
            x2={outer.x}
            y2={outer.y}
          />
        );
      })}
      <polygon className="landing-hero-preview__radar-area" points={dataPoly} />
      <polyline className="landing-hero-preview__radar-stroke" points={dataPoly} />
      {RADAR_ANGLES.map((deg, i) => {
        const dim = dimensions[i];
        const { x, y } = radarPt(deg, RADAR_R_LABEL);
        const anchor = x > RADAR_CX + 8 ? "start" : x < RADAR_CX - 8 ? "end" : "middle";
        const dy = y < RADAR_CY - 14 ? -3 : y > RADAR_CY + 14 ? 12 : 5;
        return (
          <text
            key={dim.key}
            className="landing-hero-preview__radar-label"
            x={x}
            y={y + dy}
            textAnchor={anchor}
          >
            {t(`report.profileFive.axisShort.${dim.key}`)}
          </text>
        );
      })}
      {dataPts.map((p, i) => (
        <circle key={dimensions[i].key} className="landing-hero-preview__radar-node" cx={p.x} cy={p.y} r="3.5" />
      ))}
    </svg>
  );
}

function FiveSlide({
  dimensions,
  t,
  isActive,
  motionOk,
}: {
  dimensions: ProfileDimension[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  isActive: boolean;
  motionOk: boolean;
}) {
  const [animKey, setAnimKey] = useState(0);
  const wasActive = useRef(false);
  useEffect(() => {
    if (isActive && !wasActive.current && motionOk) {
      setAnimKey((k) => k + 1);
    }
    wasActive.current = isActive;
  }, [isActive, motionOk]);

  return (
    <div className="landing-hero-preview__panel landing-hero-preview__panel--five">
      <p className="landing-hero-preview__eyebrow">{t("report.profileFive.title")}</p>
      <div className="landing-hero-preview__radar-wrap">
        <MiniProfileRadar key={animKey} dimensions={dimensions} t={t} animate={isActive && motionOk} />
      </div>
      <p className="landing-hero-preview__spotlight">{t("app.hero.previewFiveLead")}</p>
    </div>
  );
}

function useReanalyzeDemo(isActive: boolean, motionOk: boolean, sampleNote: string) {
  const [phase, setPhase] = useState<ReanalyzePhase>("idle");
  const [typedLen, setTypedLen] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setPhase("idle");
      setTypedLen(0);
      return;
    }

    if (!motionOk) {
      setPhase("done");
      setTypedLen(sampleNote.length);
      return;
    }

    let cancelled = false;
    const timers = new Set<number>();

    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.add(id);
    };

    const runCycle = () => {
      setPhase("idle");
      setTypedLen(0);

      schedule(() => {
        setPhase("typing");
        let i = 0;
        const typeId = window.setInterval(() => {
          if (cancelled) {
            window.clearInterval(typeId);
            return;
          }
          i += 1;
          setTypedLen(i);
          if (i >= sampleNote.length) {
            window.clearInterval(typeId);
            schedule(() => setPhase("submit"), 350);
            schedule(() => setPhase("analyzing"), 1100);
            schedule(() => setPhase("done"), 2400);
            schedule(() => runCycle(), 4200);
          }
        }, 32);
        timers.add(typeId);
      }, 500);
    };

    runCycle();

    return () => {
      cancelled = true;
      timers.forEach((id) => {
        window.clearTimeout(id);
        window.clearInterval(id);
      });
    };
  }, [isActive, motionOk, sampleNote]);

  return { phase, typedText: sampleNote.slice(0, typedLen) };
}

function GapsSlide({
  gaps,
  t,
  isActive,
  motionOk,
}: {
  gaps: string[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  isActive: boolean;
  motionOk: boolean;
}) {
  const sampleNote = t("app.hero.previewSampleNote");
  const { phase, typedText } = useReanalyzeDemo(isActive, motionOk, sampleNote);
  const resolved = phase === "done";

  return (
    <div className="landing-hero-preview__panel">
      <p className="landing-hero-preview__eyebrow">{t("report.gapsTitle")}</p>
      <p className="landing-hero-preview__panel-lead">{t("app.hero.previewGapsLead")}</p>
      <ul className="landing-hero-preview__gap-list">
        {gaps.slice(0, 2).map((gap, index) => (
          <li
            key={gap}
            className={resolved && index === 0 ? "landing-hero-preview__gap-item--resolved" : undefined}
          >
            {resolved && index === 0 ? <span className="landing-hero-preview__gap-check" aria-hidden>✓</span> : null}
            {gap}
          </li>
        ))}
      </ul>

      <div
        className={`landing-hero-preview__reanalyze landing-hero-preview__reanalyze--${phase}`}
        aria-live="polite"
      >
        <label className="landing-hero-preview__reanalyze-label">{t("report.profileFive.directLabel")}</label>
        <div className="landing-hero-preview__reanalyze-field">
          <span className="landing-hero-preview__reanalyze-text">{typedText}</span>
          {phase === "typing" ? <span className="landing-hero-preview__reanalyze-caret" aria-hidden /> : null}
        </div>
        <div className="landing-hero-preview__reanalyze-btn-wrap">
          <span className="landing-hero-preview__reanalyze-btn">
            {phase === "analyzing" ? (
              <>
                <span className="landing-hero-preview__reanalyze-spinner" aria-hidden />
                {t("report.refresh.optimizing")}
              </>
            ) : (
              t("report.profileFive.directSubmit")
            )}
          </span>
        </div>
        {phase === "done" ? (
          <p className="landing-hero-preview__reanalyze-done">{t("app.hero.previewReanalyzeDone")}</p>
        ) : null}
      </div>
    </div>
  );
}

export function LandingHeroPreview() {
  const { t, locale } = useLanguage();
  const report = getSampleReport(locale);
  const form = getSampleForm(locale);
  const dimensions = useMemo(() => buildFiveDimensionProfile(form, locale), [form, locale]);
  const summary = report.executive_summary?.[0] ?? "";
  const gaps = report.information_gaps ?? [];

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [motionOk, setMotionOk] = useState(true);

  useEffect(() => {
    setMotionOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const goTo = useCallback((index: number) => {
    setActive((index + SLIDE_KEYS.length) % SLIDE_KEYS.length);
  }, []);

  useEffect(() => {
    if (!motionOk || paused) return;
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % SLIDE_KEYS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [motionOk, paused]);

  return (
    <aside
      className="landing-hero-preview notranslate"
      translate="no"
      aria-label={t("app.hero.previewAria")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="landing-hero-preview__frame">
        <div className="landing-hero-preview__chrome">
          <span className="landing-hero-preview__chrome-dot" aria-hidden />
          <span className="landing-hero-preview__chrome-title">{t("app.hero.previewLabel")}</span>
        </div>

        <div className="landing-hero-preview__tabs" role="tablist" aria-label={t("app.hero.previewTabsAria")}>
          {SLIDE_KEYS.map((key, index) => (
            <button
              key={key}
              type="button"
              role="tab"
              className={`landing-hero-preview__tab${active === index ? " landing-hero-preview__tab--on" : ""}`}
              aria-selected={active === index}
              onClick={() => goTo(index)}
            >
              {t(`app.hero.previewTab.${key}`)}
            </button>
          ))}
        </div>

        <div className="landing-hero-preview__body">
          <div className="landing-hero-preview__stage">
            {SLIDE_KEYS.map((key, index) => (
              <div
                key={key}
                className={`landing-hero-preview__slide${active === index ? " landing-hero-preview__slide--on" : ""}`}
                role="tabpanel"
                aria-hidden={active !== index}
              >
                {key === "draft" ? <DraftSlide summary={summary} report={report} t={t} /> : null}
                {key === "five" ? (
                  <FiveSlide dimensions={dimensions} t={t} isActive={active === index} motionOk={motionOk} />
                ) : null}
                {key === "gaps" ? <GapsSlide gaps={gaps} t={t} isActive={active === index} motionOk={motionOk} /> : null}
              </div>
            ))}
          </div>

          <div className="landing-hero-preview__dots" aria-hidden>
            {SLIDE_KEYS.map((key, index) => (
              <span key={key} className={`landing-hero-preview__dot${active === index ? " landing-hero-preview__dot--on" : ""}`} />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
