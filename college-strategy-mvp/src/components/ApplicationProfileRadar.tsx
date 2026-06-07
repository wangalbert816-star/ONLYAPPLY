import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import type { ProfileDimension, ProfileDimensionKey } from "../lib/fiveDimensionProfile";
import { profileScoreBand } from "../lib/fiveDimensionProfile";
import type { Translate } from "../i18n/LanguageContext";
import type { SupplementaryNote } from "../types";

type Props = {
  items: ProfileDimension[];
  t: Translate;
  onCommitProfileFiveNotes?: (notes: SupplementaryNote[]) => Promise<void>;
  isCommitting?: boolean;
  previewLocked?: boolean;
  mockupLayout?: boolean;
};

const MIN_DIRECT_LEN = 3;

const BLANK_DRAFTS: Record<ProfileDimensionKey, string> = {
  academic: "",
  testing: "",
  activities: "",
  rigor: "",
  strategy: "",
};

/** 加宽 viewBox，避免轴标签被裁切；略缩小半径为标签留边 */
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

function polygonForScale(scale: number): string {
  return ANGLES_DEG.map((deg, i) => {
    const { x, y } = pt(deg, R * scale);
    return `${i === 0 ? "" : " "}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join("");
}

export function ApplicationProfileRadar({
  items,
  t,
  onCommitProfileFiveNotes,
  isCommitting = false,
  previewLocked = false,
  mockupLayout = false,
}: Props) {
  const [spotKey, setSpotKey] = useState<ProfileDimensionKey | null>(null);
  const [drafts, setDrafts] = useState<Record<ProfileDimensionKey, string>>(() => ({ ...BLANK_DRAFTS }));
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const toggleSpot = useCallback((key: ProfileDimensionKey) => {
    setSpotKey((prev) => (prev === key ? null : key));
  }, []);

  const onAxisKeyDown = useCallback(
    (e: KeyboardEvent, key: ProfileDimensionKey) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSpot(key);
      }
    },
    [toggleSpot],
  );

  const canSubmit = useMemo(
    () => items.some((it) => drafts[it.key].trim().length >= MIN_DIRECT_LEN),
    [drafts, items],
  );

  async function handleCommitProfileNotes() {
    if (!onCommitProfileFiveNotes || isCommitting) return;
    setSubmitErr(null);
    const notes: SupplementaryNote[] = [];
    for (const it of items) {
      const text = drafts[it.key].trim();
      if (text.length < MIN_DIRECT_LEN) continue;
      const axis = t(`report.profileFive.axis.${it.key}`);
      notes.push({ topic: t("report.profileFive.noteTopicTemplate", { axis }), text });
    }
    if (notes.length === 0) {
      setSubmitErr(t("report.profileFive.directMinErr", { n: MIN_DIRECT_LEN }));
      return;
    }
    await onCommitProfileFiveNotes(notes);
  }

  const dataPts = items.map((it, i) => {
    const clamp = Math.max(8, Math.min(100, it.score)) / 100;
    return pt(ANGLES_DEG[i], R * clamp);
  });
  const dataPoly = dataPts.map((p, i) => `${i === 0 ? "" : " "}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");

  const spot = spotKey ? items.find((x) => x.key === spotKey) : null;

  return (
    <div className={`profile-five${previewLocked ? " profile-five--preview-locked" : ""}${mockupLayout ? " profile-five--mockup" : ""}`}>
      <div className="profile-five-radar-wrap">
        <svg
          className="profile-five-radar"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={t("report.profileFive.title")}
        >
          <title>{t("report.profileFive.title")}</title>
          {[0.25, 0.5, 0.75, 1].map((s) => (
            <polygon key={s} className="profile-five-grid" points={polygonForScale(s)} fill="none" />
          ))}
          {ANGLES_DEG.map((deg) => {
            const outer = pt(deg, R);
            const inner = pt(deg, 0);
            return <line key={deg} className="profile-five-axis" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />;
          })}
          <polygon className="profile-five-area" points={dataPoly} />
          <polyline className="profile-five-stroke" points={dataPoly} />
          {ANGLES_DEG.map((deg, i) => {
            const dim = items[i];
            const { x, y } = pt(deg, R_LABEL);
            const anchor = x > CX + 10 ? "start" : x < CX - 10 ? "end" : "middle";
            const dy = y < CY - 18 ? -4 : y > CY + 18 ? 16 : 6;
            return (
              <text key={`lbl-${dim.key}`} className="profile-five-label" x={x} y={y + dy} textAnchor={anchor}>
                {t(`report.profileFive.axisShort.${dim.key}`)}
              </text>
            );
          })}
          {dataPts.map((p, i) => {
            const dim = items[i];
            const active = spotKey === dim.key;
            const band = profileScoreBand(dim.score);
            return (
              <g
                key={dim.key}
                role={previewLocked ? undefined : "button"}
                tabIndex={previewLocked ? undefined : 0}
                className="profile-five-axis-hit"
                aria-pressed={active}
                aria-label={
                  previewLocked
                    ? t(`report.profileFive.axisShort.${dim.key}`)
                    : t("report.profileFive.axisTapAria", { axis: t(`report.profileFive.axisShort.${dim.key}`) })
                }
                onClick={previewLocked ? undefined : () => toggleSpot(dim.key)}
                onKeyDown={previewLocked ? undefined : (e) => onAxisKeyDown(e, dim.key)}
              >
                <circle className="profile-five-hit" cx={p.x} cy={p.y} r="18" fill="transparent" />
                <circle
                  className={`profile-five-node profile-five-node--${band}${active ? " profile-five-node--active" : ""}`}
                  cx={p.x}
                  cy={p.y}
                  r={active ? 6 : 4.5}
                />
              </g>
            );
          })}
        </svg>

        {spot && !previewLocked && (
          <div className="profile-five-spotlight" role="region" aria-live="polite" id="profile-five-spotlight">
            <div className="profile-five-spotlight-head">
              <strong className="profile-five-spotlight-title">{t(`report.profileFive.axis.${spot.key}`)}</strong>
              <button type="button" className="profile-five-spotlight-close btn btn-secondary" onClick={() => setSpotKey(null)}>
                {t("report.profileFive.spotClose")}
              </button>
            </div>
            <p className="profile-five-spotlight-line profile-five-spotlight-line--judgment">{spot.judgment}</p>
            <p className="profile-five-spotlight-line">
              <span className="profile-five-k">{t("report.profileFive.reasonLabel")}</span>
              {spot.explain}
            </p>
            <p className="profile-five-spotlight-line profile-five-spotlight-line--suggest">
              <span className="profile-five-k">{t("report.profileFive.suggestAdvisorLabel")}</span>
              {spot.suggest}
            </p>
          </div>
        )}

        {!mockupLayout && (
          <p className="profile-five-radar-hint">
            {previewLocked ? t("report.profileFive.previewHint") : t("report.profileFive.chartHint")}
          </p>
        )}
      </div>

      {mockupLayout ? (
        <div className="profile-five-mockup-grid" aria-label={t("report.profileFive.title")}>
          {items.map((it) => {
            const band = profileScoreBand(it.score);
            const pct = Math.max(8, Math.min(100, it.score));
            return (
              <div key={it.key} className={`profile-five-mockup-card profile-five-mockup-card--${band}`}>
                <div className="profile-five-mockup-card__head">
                  <span className="profile-five-mockup-card__label">{t(`report.profileFive.axisShort.${it.key}`)}</span>
                  <span className={`profile-five-mockup-card__score profile-five-mockup-card__score--${band}`}>{it.score}</span>
                </div>
                <div className="profile-five-mockup-card__track" aria-hidden>
                  <span style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <ul className="profile-five-list">
        {items.map((it) => {
          const band = profileScoreBand(it.score);
          return (
          <li
            key={it.key}
            id={`profile-five-row-${it.key}`}
            className={`profile-five-row profile-five-row--${band}${spotKey === it.key ? " profile-five-row--spot" : ""}`}
          >
            <div className="profile-five-row-head">
              <span className="profile-five-row-title">{t(`report.profileFive.axis.${it.key}`)}</span>
              <span className={`profile-five-score profile-five-score--${band}`}>{t("report.profileFive.score", { n: it.score })}</span>
            </div>
            {!previewLocked ? (
              <>
                <p className="profile-five-judgment">{it.judgment}</p>
                <p className="profile-five-explain">
                  <span className="profile-five-k">{t("report.profileFive.reasonLabel")}</span>
                  {it.explain}
                </p>
                <p className="profile-five-suggest">
                  <span className="profile-five-k">{t("report.profileFive.suggestAdvisorLabel")}</span>
                  {it.suggest}
                </p>
              </>
            ) : (
              <div className={`profile-five-preview-bar profile-five-preview-bar--${band}`} aria-hidden>
                <span style={{ width: `${Math.max(8, Math.min(100, it.score))}%` }} />
              </div>
            )}
            {onCommitProfileFiveNotes && !previewLocked && (
              <div className="profile-five-direct">
                <label className="profile-five-direct-label" htmlFor={`profile-five-input-${it.key}`}>
                  {t("report.profileFive.directLabel")}
                </label>
                <textarea
                  id={`profile-five-input-${it.key}`}
                  className="profile-five-direct-input"
                  rows={3}
                  maxLength={2000}
                  disabled={isCommitting}
                  value={drafts[it.key]}
                  placeholder={t("report.profileFive.directPlaceholder")}
                  onChange={(e) => {
                    setDrafts((d) => ({ ...d, [it.key]: e.target.value }));
                    setSubmitErr(null);
                  }}
                />
              </div>
            )}
          </li>
          );
        })}
      </ul>
      )}

      {previewLocked && !mockupLayout && (
        <p className="block-locked profile-five-preview-lock">
          <span className="lock-icon" aria-hidden>
            🔒
          </span>
          {t("report.profileFive.previewLocked")}
        </p>
      )}

      {onCommitProfileFiveNotes && !previewLocked && (
        <>
          <div id="profile-five-commit-anchor" className="profile-five-commit-anchor" aria-hidden />
          <div className="profile-five-commit">
          {submitErr && <p className="profile-five-commit-err">{submitErr}</p>}
          <button
            type="button"
            className="btn btn-primary profile-five-commit-btn"
            disabled={!canSubmit || isCommitting}
            onClick={() => void handleCommitProfileNotes()}
          >
            {t("report.profileFive.directSubmit")}
          </button>
          <p className="profile-five-commit-hint">{t("report.profileFive.directHint")}</p>
        </div>
        </>
      )}
    </div>
  );
}
