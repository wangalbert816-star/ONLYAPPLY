import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  evaluateChances,
  searchChancesSchools,
  type ChancesEvaluateResponse,
  type ChancesInput,
  type ChancesSchoolResult,
} from "../../lib/chancesApi";
import "./ChancesPage.css";

const EMPTY_INPUT: ChancesInput = {
  gpa: "",
  testMode: "sat",
  satScore: "",
  actScore: "",
};

const TIER_COLOR: Record<string, string> = {
  safety: "#22c55e",
  match: "#7c3aed",
  reach: "#ef4444",
};

const ZONE_LINE_COLOR = {
  safety: "#22c55e",
  match: "#7c3aed",
  reach: "#ef4444",
} as const;

const ZONE_PILL = {
  safety: { fill: "#dcfce7", text: "#15803d" },
  match: { fill: "#fef9c4", text: "#854d0e" },
  reach: { fill: "#fee2e2", text: "#b91c1c" },
} as const;

const ZONE_OFFSET = 13;

function chartZoneBoundaries(academicScore: number) {
  return {
    safety: Math.max(0, Math.round((academicScore - ZONE_OFFSET) * 10) / 10),
    match: academicScore,
    reach: Math.min(100, Math.round((academicScore + ZONE_OFFSET) * 10) / 10),
  };
}

const TAG_NEUTRAL = "#cbd5e1";

function tierColorForSchool(name: string, schools: ChancesSchoolResult[]): string {
  const key = chancesSchoolKey(name);
  const row = schools.find((s) => chancesSchoolKey(s.school) === key);
  if (!row?.tier) return TAG_NEUTRAL;
  return TIER_COLOR[row.tier] ?? TAG_NEUTRAL;
}

/** Match server normalizeSchoolKey for client-side school list ↔ chart sync. */
function chancesSchoolKey(name: string): string {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function reconcileSchoolLabels(selected: string[], evaluated: ChancesSchoolResult[]): string[] {
  const inTable = evaluated.filter((s) => s.inTable);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of selected) {
    const key = chancesSchoolKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const hit = inTable.find((s) => chancesSchoolKey(s.school) === key);
    out.push(hit?.school ?? name);
  }
  return out;
}

function chartSchoolsForSelection(
  selected: string[],
  evaluated: ChancesSchoolResult[] | undefined,
): ChancesSchoolResult[] {
  if (!evaluated?.length || !selected.length) return [];
  const byKey = new Map<string, ChancesSchoolResult>();
  for (const row of evaluated) {
    if (!row.inTable) continue;
    byKey.set(chancesSchoolKey(row.school), row);
  }
  const points: ChancesSchoolResult[] = [];
  const seen = new Set<string>();
  for (const name of selected) {
    const key = chancesSchoolKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const row = byKey.get(key);
    if (row) points.push(row);
  }
  return points;
}

function predictedSelectivityFromSchools(
  schools: ChancesSchoolResult[],
  academicScore: number | null | undefined,
): number | null {
  if (academicScore == null) return null;
  if (!schools.length) return academicScore;
  const matches = schools.filter((s) => s.tier === "match" && s.selectivity != null);
  const pool = matches.length ? matches : schools.filter((s) => s.selectivity != null);
  if (!pool.length) return academicScore;
  const avg = pool.reduce((sum, s) => sum + (s.selectivity ?? 0), 0) / pool.length;
  return Math.round(avg * 10) / 10;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onBookConsult?: () => void;
};

function tierLabel(tier: string | undefined, t: (k: string) => string): string {
  if (tier === "safety") return t("chances.tierSafety");
  if (tier === "reach") return t("chances.tierReach");
  return t("chances.tierMatch");
}

function formatAdmissionRate(rate: number | null | undefined): string | null {
  if (rate == null || Number.isNaN(rate)) return null;
  return `${Math.round(rate * 100)}%`;
}

function ZonePill({
  x,
  y,
  label,
  fill,
  textColor,
}: {
  x: number;
  y: number;
  label: string;
  fill: string;
  textColor: string;
}) {
  const w = Math.max(52, label.length * 6.5 + 22);
  const h = 22;
  return (
    <g>
      <rect x={x - w / 2} y={y} width={w} height={h} rx={11} fill={fill} />
      <text x={x} y={y + 15} textAnchor="middle" fill={textColor} fontSize={10} fontWeight={600}>
        {label}
      </text>
    </g>
  );
}

function ChancesScatterChart({
  academicScore,
  schools,
  t,
}: {
  academicScore: number | null;
  schools: ChancesSchoolResult[];
  t: (k: string) => string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ school: ChancesSchoolResult; left: number; top: number } | null>(null);

  const width = 800;
  const height = 520;
  const pad = { top: 58, right: 24, bottom: 48, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const points = schools.filter((s) => s.inTable && s.selectivity != null);

  const xScale = (v: number) => pad.left + (v / 100) * plotW;
  const yScale = (v: number) => pad.top + plotH - (v / 100) * plotH;

  const ticks = [0, 25, 50, 75, 100];

  const zones =
    academicScore != null
      ? chartZoneBoundaries(academicScore)
      : null;

  const pillY = pad.top - 46;

  useEffect(() => {
    setHover(null);
  }, [schools]);

  const showTooltip = (school: ChancesSchoolResult, cx: number, cy: number) => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap) return;
    const pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const mapped = pt.matrixTransform(ctm);
    const rect = wrap.getBoundingClientRect();
    setHover({
      school,
      left: mapped.x - rect.left,
      top: mapped.y - rect.top,
    });
  };

  return (
    <div className="chances-scatter-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="chances-scatter"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t("chances.chartAria")}
      >
      <rect x={pad.left} y={pad.top} width={plotW} height={plotH} className="chances-scatter__plot" />

      {ticks.map((tick) => (
        <g key={`x-grid-${tick}`}>
          <line x1={xScale(tick)} y1={pad.top} x2={xScale(tick)} y2={pad.top + plotH} className="chances-scatter__grid" />
        </g>
      ))}
      {ticks.map((tick) => (
        <g key={`y-grid-${tick}`}>
          <line x1={pad.left} y1={yScale(tick)} x2={pad.left + plotW} y2={yScale(tick)} className="chances-scatter__grid" />
        </g>
      ))}

      {ticks.map((tick) => (
        <text key={`x-tick-${tick}`} x={xScale(tick)} y={height - 12} textAnchor="middle" className="chances-scatter__tick">
          {tick}
        </text>
      ))}
      {ticks.map((tick) => (
        <text key={`y-tick-${tick}`} x={pad.left - 8} y={yScale(tick) + 4} textAnchor="end" className="chances-scatter__tick">
          {tick}
        </text>
      ))}

      <text x={pad.left + plotW / 2} y={height - 2} textAnchor="middle" className="chances-scatter__axis-label">
        {t("chances.axisAcademicScore")}
      </text>
      <text
        x={14}
        y={pad.top + plotH / 2}
        textAnchor="middle"
        transform={`rotate(-90 14 ${pad.top + plotH / 2})`}
        className="chances-scatter__axis-label"
      >
        {t("chances.axisSelectivity")}
      </text>

      {zones &&
        (
          [
            { key: "safety" as const, x: zones.safety },
            { key: "match" as const, x: zones.match },
            { key: "reach" as const, x: zones.reach },
          ] as const
        ).map(({ key, x }) => (
          <line
            key={`zone-line-${key}`}
            x1={xScale(x)}
            y1={pad.top}
            x2={xScale(x)}
            y2={pad.top + plotH}
            className={`chances-scatter__zone-line chances-scatter__zone-line--${key}`}
            stroke={ZONE_LINE_COLOR[key]}
          />
        ))}

      {zones && (
        <>
          <ZonePill
            x={xScale(zones.safety)}
            y={pillY}
            label={t("chances.tierSafetyShort")}
            fill={ZONE_PILL.safety.fill}
            textColor={ZONE_PILL.safety.text}
          />
          <ZonePill
            x={xScale(zones.match)}
            y={pillY}
            label={t("chances.tierMatchShort")}
            fill={ZONE_PILL.match.fill}
            textColor={ZONE_PILL.match.text}
          />
          <ZonePill
            x={xScale(zones.reach)}
            y={pillY}
            label={t("chances.tierReachShort")}
            fill={ZONE_PILL.reach.fill}
            textColor={ZONE_PILL.reach.text}
          />
        </>
      )}

      {academicScore != null && zones && (
        <text
          x={xScale(zones.match)}
          y={pad.top - 6}
          textAnchor="middle"
          className="chances-scatter__you-score-label"
        >
          {t("chances.youMarker")}
        </text>
      )}

      {points.map((p) => {
        // X follows effective tier (same source as dot color). engineGap can differ after
        // prestige/safety caps (e.g. UC Berkeley safety with gap≈6).
        const tierKey = p.tier ?? "match";
        const tierBase =
          zones && tierKey in zones
            ? zones[tierKey as keyof typeof zones]
            : academicScore != null
              ? academicScore
              : p.selectivity!;
        const sameTierIdx = points.filter((x) => (x.tier ?? "match") === tierKey).indexOf(p);
        const sameTierCount = points.filter((x) => (x.tier ?? "match") === tierKey).length;
        const jitterX = sameTierCount > 1 ? (sameTierIdx - (sameTierCount - 1) / 2) * 8 : 0;
        const cx = Math.min(
          pad.left + plotW,
          Math.max(pad.left, xScale(Math.min(100, Math.max(0, tierBase))) + jitterX),
        );
        const cy = yScale(Math.min(100, Math.max(0, p.selectivity!)));
        const color = TIER_COLOR[p.tier ?? "match"] ?? TIER_COLOR.match;
        return (
          <g key={p.school} className="chances-scatter__point">
            <circle
              cx={cx}
              cy={cy}
              r={16}
              fill="transparent"
              className="chances-scatter__hit"
              onMouseEnter={() => showTooltip(p, cx, cy)}
              onMouseLeave={() => setHover((prev) => (prev?.school.school === p.school ? null : prev))}
              onFocus={() => showTooltip(p, cx, cy)}
              onBlur={() => setHover((prev) => (prev?.school.school === p.school ? null : prev))}
              tabIndex={0}
              role="button"
              aria-label={`${p.school}${formatAdmissionRate(p.acceptanceRate) ? `, ${t("chances.admissionRate")} ${formatAdmissionRate(p.acceptanceRate)}` : ""}`}
            />
            <circle cx={cx} cy={cy} r={7} fill={color} stroke="#fff" strokeWidth={2} pointerEvents="none" />
          </g>
        );
      })}

      {academicScore != null && zones && (
        <path
          className="chances-scatter__you-pin"
          d={`M ${xScale(zones.match) - 7} ${pad.top + 1} L ${xScale(zones.match) + 7} ${pad.top + 1} L ${xScale(zones.match)} ${pad.top + 11} Z`}
          pointerEvents="none"
        />
      )}
      </svg>

      {hover && (
        <div
          className="chances-scatter-tooltip"
          style={{
            left: hover.left,
            top: hover.top,
          }}
        >
          <strong>{hover.school.school}</strong>
          {formatAdmissionRate(hover.school.acceptanceRate) && (
            <span>
              {t("chances.admissionRate")} {formatAdmissionRate(hover.school.acceptanceRate)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ChancesPage({ open, onClose, onBookConsult }: Props) {
  const { t } = useLanguage();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState<ChancesInput>(EMPTY_INPUT);
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<{ school: string; selectivity: number | null }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChancesEvaluateResponse | null>(null);
  const evaluateSeqRef = useRef(0);
  const prevInputRef = useRef(`${EMPTY_INPUT.gpa}|${EMPTY_INPUT.testMode}|${EMPTY_INPUT.satScore}|${EMPTY_INPUT.actScore}`);

  const chartSchools = useMemo(
    () => chartSchoolsForSelection(selectedSchools, result?.schools),
    [selectedSchools, result?.schools],
  );

  const predictedSelectivity = useMemo(
    () => predictedSelectivityFromSchools(chartSchools, result?.academicScore),
    [chartSchools, result?.academicScore],
  );

  const schoolsNotInTable = useMemo(
    () => (result?.schools ?? []).filter((s) => !s.inTable).map((s) => s.school),
    [result?.schools],
  );

  const runEvaluate = useCallback(async () => {
    if (!input.gpa.trim()) {
      setResult(null);
      setError(t("chances.errorNeedGpa"));
      return;
    }
    if (!selectedSchools.length) {
      setResult(null);
      setError(t("chances.errorNeedSchool"));
      return;
    }
    const seq = ++evaluateSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await evaluateChances(input, selectedSchools);
      if (seq !== evaluateSeqRef.current) return;
      setResult(data);
      setSelectedSchools((prev) => {
        const next = reconcileSchoolLabels(prev, data.schools);
        if (next.length === prev.length && next.every((n, i) => n === prev[i])) return prev;
        return next;
      });
    } catch (e) {
      if (seq !== evaluateSeqRef.current) return;
      setError(e instanceof Error ? e.message : t("chances.errorGeneric"));
      setResult(null);
    } finally {
      if (seq === evaluateSeqRef.current) setLoading(false);
    }
  }, [input, selectedSchools, t]);

  useEffect(() => {
    if (!open) return;
    evaluateSeqRef.current += 1;
    setInput(EMPTY_INPUT);
    setSelectedSchools([]);
    setSearchQuery("");
    setSearchHits([]);
    setSearchOpen(false);
    setResult(null);
    setError(null);
    setLoading(false);
    prevInputRef.current = `${EMPTY_INPUT.gpa}|${EMPTY_INPUT.testMode}|${EMPTY_INPUT.satScore}|${EMPTY_INPUT.actScore}`;
  }, [open]);

  const inputFingerprint = `${input.gpa}|${input.testMode}|${input.satScore}|${input.actScore}`;

  useEffect(() => {
    if (prevInputRef.current === inputFingerprint) return;
    prevInputRef.current = inputFingerprint;
    setResult(null);
  }, [inputFingerprint]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!searchOpen || searchQuery.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchChancesSchools(searchQuery)
        .then((hits) => {
          if (!cancelled) setSearchHits(hits);
        })
        .catch(() => {
          if (!cancelled) setSearchHits([]);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (searchContainerRef.current && target && !searchContainerRef.current.contains(target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [searchOpen]);

  const addSchool = (name: string) => {
    const label = name.trim();
    if (!label) return;
    let rejected = false;
    setSelectedSchools((prev) => {
      const key = chancesSchoolKey(label);
      if (prev.some((s) => chancesSchoolKey(s) === key)) return prev;
      if (prev.length >= 8) {
        rejected = true;
        return prev;
      }
      return [...prev, label];
    });
    setError(rejected ? t("chances.errorMaxSchools") : null);
    setSearchQuery("");
    setSearchOpen(false);
    setSearchHits([]);
  };

  const removeSchool = (name: string) => {
    const key = chancesSchoolKey(name);
    setSelectedSchools((prev) => prev.filter((s) => chancesSchoolKey(s) !== key));
  };

  if (!open) return null;

  return createPortal(
    <div className="chances-page" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="chances-page__backdrop" onClick={onClose} aria-hidden />
      <div className="chances-page__panel">
        <header className="chances-page__header">
          <span className="chances-page__eyebrow">{t("chances.title")}</span>
          <button ref={closeRef} type="button" className="chances-page__close" onClick={onClose}>
            {t("chances.close")}
          </button>
        </header>

        <div className="chances-page__body">
          <div className="chances-page__intro">
            <h1 id={titleId} className="chances-page__headline">
              {t("chances.headline")}
            </h1>
            <p className="chances-page__subtitle">{t("chances.subtitle")}</p>
          </div>

          <div className="chances-steps">
            <span className="chances-step">
              {t("chances.stepEnter")}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                <path d="M7 5v9m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="chances-step">
              {t("chances.stepSee")}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                <path d="M17 5v9m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>

          <div className="chances-page__grid">
          <aside className="chances-page__sidebar">
            <section className="chances-card">
              <h2 className="chances-card__title">{t("chances.enterAcademicInfo")}</h2>
              <div className="chances-input-grid">
                <label className="chances-field">
                  <span>{t("chances.gpaLabel")}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={input.gpa}
                    onChange={(e) => setInput((p) => ({ ...p, gpa: e.target.value }))}
                    placeholder="3.7"
                  />
                </label>
                {input.testMode === "sat" ? (
                  <label className="chances-field">
                    <span>{t("chances.satLabel")}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={input.satScore}
                      onChange={(e) => setInput((p) => ({ ...p, satScore: e.target.value }))}
                      placeholder={t("chances.satPlaceholder")}
                    />
                  </label>
                ) : (
                  <label className="chances-field">
                    <span>{t("chances.actLabel")}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={input.actScore}
                      onChange={(e) => setInput((p) => ({ ...p, actScore: e.target.value }))}
                      placeholder={t("chances.actPlaceholder")}
                    />
                  </label>
                )}
                <div className="chances-field chances-field--full">
                  <span>{t("chances.testingLabel")}</span>
                  <div className="chances-test-toggle">
                    <button
                      type="button"
                      className={input.testMode === "sat" ? "is-active" : ""}
                      onClick={() => setInput((p) => ({ ...p, testMode: "sat" }))}
                    >
                      SAT
                    </button>
                    <button
                      type="button"
                      className={input.testMode === "act" ? "is-active" : ""}
                      onClick={() => setInput((p) => ({ ...p, testMode: "act" }))}
                    >
                      ACT
                    </button>
                  </div>
                </div>
              </div>
              <p className="chances-panel__hint">{t("chances.recordHint")}</p>
              <button type="button" className="chances-btn chances-btn--primary" disabled={loading} onClick={() => void runEvaluate()}>
                {loading ? t("chances.updating") : t("chances.calculateBtn")}
              </button>
            </section>

            <section className="chances-card">
              <div className="chances-card__head">
                <h2 className="chances-card__title chances-card__title--flush">{t("chances.profileHeading")}</h2>
                {!result && <span className="chances-card__badge">{t("chances.profilePreviewBadge")}</span>}
              </div>
              <div className="chances-profile-stats">
                <div className="chances-profile-stat">
                  <span className="chances-profile-stat__label">{t("chances.academicScore")}</span>
                  <div className="chances-profile-stat__value">
                    {result ? result.academicScore : "—"}
                    <span>/100</span>
                  </div>
                </div>
                <div className="chances-profile-stat">
                  <span className="chances-profile-stat__label">{t("chances.predictedSelectivity")}</span>
                  <div className="chances-profile-stat__value">
                    {result ? predictedSelectivity ?? "—" : "—"}
                    <span>/100</span>
                  </div>
                </div>
              </div>
            </section>

            {onBookConsult && (
              <section className="chances-card chances-consult">
                <span className="chances-consult__kicker">{t("chances.consultKicker")}</span>
                <h2 className="chances-consult__title">{t("chances.consultHeading")}</h2>
                <p className="chances-consult__lead">{t("chances.consultLead")}</p>
                <ul className="chances-consult__bullets">
                  <li>{t("chances.consultBullet1")}</li>
                  <li>{t("chances.consultBullet2")}</li>
                  <li>{t("chances.consultBullet3")}</li>
                </ul>
                <button type="button" className="chances-btn chances-btn--consult" onClick={onBookConsult}>
                  {t("chances.consultCta")}
                </button>
              </section>
            )}
          </aside>

          <main className="chances-page__main">
            <section className="chances-card">
              <h2 className="chances-card__title">{t("chances.findHeading")}</h2>
              <div className="chances-school-search" ref={searchContainerRef}>
                <span className="chances-school-search__icon" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="M20 20L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  ref={searchRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder={t("chances.searchPlaceholderLong")}
                  aria-label={t("chances.searchPlaceholderLong")}
                />
                {searchOpen && searchHits.length > 0 && (
                  <ul className="chances-school-search__list" role="listbox">
                    {searchHits.map((hit) => (
                      <li key={hit.school}>
                        <button type="button" onClick={() => addSchool(hit.school)}>
                          {hit.school}
                          {hit.selectivity != null ? ` · ${hit.selectivity}` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedSchools.length > 0 && (
                <div className="chances-selected">
                  <span className="chances-selected__label">{t("chances.selectedLabel")}</span>
                  <div className="chances-tags chances-tags--chart">
                  {selectedSchools.map((name) => (
                    <span key={chancesSchoolKey(name) || name} className="chances-tag">
                      <i
                        className="chances-tag__dot"
                        style={{ background: tierColorForSchool(name, chartSchools) }}
                        aria-hidden
                      />
                      {name}
                      <button type="button" aria-label={t("chances.removeSchool")} onClick={() => removeSchool(name)}>
                        ×
                      </button>
                    </span>
                  ))}
                  </div>
                </div>
              )}

              {error && <p className="chances-error">{error}</p>}

              {schoolsNotInTable.length > 0 && (
                <p className="chances-warn" role="status">
                  {t("chances.warnNotInTable")}: {schoolsNotInTable.join(", ")}
                </p>
              )}

              <div className="chances-chart-shell">
                <ChancesScatterChart
                  academicScore={result?.academicScore ?? null}
                  schools={chartSchools}
                  t={t}
                />
              </div>
              <p className="chances-disclaimer">{t("chances.disclaimer")}</p>
            </section>

            <section className="chances-card">
              <h2 className="chances-card__title">{t("chances.interpretHeading")}</h2>
              <ul className="chances-interpret">
                <li>{t("chances.interpretAxisX")}</li>
                <li>{t("chances.interpretAxisY")}</li>
                <li>{t("chances.interpretZoneSafety")}</li>
                <li>{t("chances.interpretZoneMatch")}</li>
                <li>{t("chances.interpretZoneReach")}</li>
                <li>{t("chances.interpretYou")}</li>
              </ul>
            </section>

            <section className="chances-card">
              <h2 className="chances-card__title">{t("chances.categoriesHeading")}</h2>
              <div className="chances-tier-list">
                {(["safety", "match", "reach"] as const).map((tier) => (
                  <div key={tier} className="chances-tier-list__item">
                    <i style={{ background: TIER_COLOR[tier] }} aria-hidden />
                    <span>{tierLabel(tier, t)}</span>
                  </div>
                ))}
              </div>
            </section>
          </main>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
