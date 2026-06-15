import { useCallback, useState } from "react";
import type { AdminEvalCase, AdminEvalRun, AdminEvalRunResult } from "../../../lib/admin/crmAdminApi";
import {
  CORRECTION_REASON_CATEGORIES,
  RUBRIC_DIMENSIONS,
  rubricAverage,
  type EvalReviewDraft,
  type RubricDimension,
} from "../../../lib/admin/evalRubric";
import { countProfileAdjustments, countSchoolCorrections } from "../../../lib/admin/evalReviewState";
import { AdminEvalReportPreview } from "../AdminEvalReportPreview";
import { buildEvalReportPreview } from "../../../lib/admin/evalCaseForm";
import type { Translate } from "../../../i18n/LanguageContext";

type Props = {
  variant?: "admin" | "alumni";
  evalCase: AdminEvalCase;
  run: AdminEvalRun;
  result: AdminEvalRunResult;
  draft: EvalReviewDraft;
  onChange: (draft: EvalReviewDraft) => void;
  onSave: (status: EvalReviewDraft["status"]) => void;
  onAutoSave?: (mode?: "immediate" | "debounced", draftOverride?: EvalReviewDraft) => void;
  saving: boolean;
  saveState?: "idle" | "saving" | "saved" | "error";
  onWriteEngineStandard?: () => void;
  engineWriteBusy?: boolean;
  engineWriteOk?: boolean;
  canWriteEngineStandard?: boolean;
  t: Translate;
};

type ReviewTab = "report" | "rubric" | "schools" | "profile" | "final";

const REVIEW_TABS: ReviewTab[] = ["report", "rubric", "schools", "profile", "final"];
const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const;

function tierLabel(t: Translate, tier: "reach" | "match" | "safety" | null) {
  if (tier === "reach") return t("admin.eval.reachLabel");
  if (tier === "match") return t("admin.eval.matchLabel");
  if (tier === "safety") return t("admin.eval.safetyLabel");
  return "—";
}

function canSubmitNineSchools(draft: EvalReviewDraft) {
  const f = draft.finalApprovedRecommendation;
  return (
    f.reach.filter((s) => s.trim()).length >= 3 &&
    f.match.filter((s) => s.trim()).length >= 3 &&
    f.safety.filter((s) => s.trim()).length >= 3
  );
}

function ReviewActionButtons({
  saving,
  canSubmit,
  onSave,
  t,
  size = "md",
  variant = "admin",
}: {
  saving: boolean;
  canSubmit: boolean;
  onSave: (status: EvalReviewDraft["status"]) => void;
  t: Translate;
  size?: "md" | "lg";
  variant?: "admin" | "alumni";
}) {
  const sizeClass = size === "lg" ? " admin-portal__btn--lg" : "";
  const saveDraftLabel =
    variant === "alumni" ? t("alumni.review.saveDraft") : t("admin.evalHarness.saveDraft");
  const submitLabel =
    variant === "alumni"
      ? saving
        ? t("alumni.review.submitting")
        : t("alumni.review.submit")
      : saving
        ? t("admin.eval.savingScore")
        : t("admin.evalHarness.submitReview");
  return (
    <>
      <button
        type="button"
        className={`admin-portal__btn admin-portal__btn--secondary${sizeClass}`}
        disabled={saving}
        onClick={() => onSave("draft")}
      >
        {saveDraftLabel}
      </button>
      <button
        type="button"
        className={`admin-portal__btn admin-portal__btn--submit${sizeClass}`}
        disabled={saving || !canSubmit}
        title={!canSubmit ? t("admin.evalHarness.submitReviewNeedSchools") : undefined}
        onClick={() => onSave("submitted")}
      >
        {submitLabel}
      </button>
    </>
  );
}

export function AdminEvalReviewForm({
  variant = "admin",
  evalCase,
  run,
  result,
  draft,
  onChange,
  onSave,
  onAutoSave,
  saving,
  saveState = "idle",
  onWriteEngineStandard,
  engineWriteBusy = false,
  engineWriteOk = false,
  canWriteEngineStandard = false,
  t,
}: Props) {
  const [tab, setTab] = useState<ReviewTab>("report");
  const preview = buildEvalReportPreview(result.reportPayload);
  const avg = rubricAverage(draft.rubricScores);
  const schoolCorrections = countSchoolCorrections(draft);
  const profileAdjustments = countProfileAdjustments(draft);
  const canSubmit = canSubmitNineSchools(draft);

  const saveItem = useCallback(
    (mode: "immediate" | "debounced" = "immediate", draftOverride?: EvalReviewDraft) => {
      onAutoSave?.(mode, draftOverride);
    },
    [onAutoSave],
  );

  const updateRubric = (key: RubricDimension, patch: Partial<(typeof draft.rubricScores)[RubricDimension]>) => {
    onChange({
      ...draft,
      rubricScores: { ...draft.rubricScores, [key]: { ...draft.rubricScores[key], ...patch } },
    });
  };

  const tabBadge = (id: ReviewTab) => {
    if (id === "rubric") {
      const filled = RUBRIC_DIMENSIONS.filter((k) => draft.rubricScores[k].score != null).length;
      return `${filled}/${RUBRIC_DIMENSIONS.length}`;
    }
    if (id === "schools") return schoolCorrections > 0 ? String(schoolCorrections) : null;
    if (id === "profile") return profileAdjustments > 0 ? String(profileAdjustments) : null;
    return null;
  };

  return (
    <div className="admin-eval-review">
      <div className="admin-eval-review__toolbar">
        <div className="admin-eval-review__toolbar-main">
          <strong>{evalCase.title}</strong>
          <span className="admin-eval-review__chips">
            {variant === "admin" ? (
              <>
                <span className="admin-eval-review__chip">P {run.promptVersion ?? "—"}</span>
                <span className="admin-eval-review__chip">M {result.model ?? "—"}</span>
              </>
            ) : (
              <span className="admin-eval-review__chip">{t("alumni.review.badge")}</span>
            )}
            {avg != null ? (
              <span className="admin-eval-review__chip admin-eval-review__chip--accent">
                {t("admin.evalHarness.rubricAvg", { avg: avg.toFixed(1) })}
              </span>
            ) : null}
          </span>
          <div className="admin-eval-review__toolbar-actions">
            <ReviewActionButtons
              saving={saving}
              canSubmit={canSubmit}
              onSave={onSave}
              t={t}
              variant={variant}
            />
          </div>
        </div>
        <div className="admin-eval-review__tabs" role="tablist" aria-label={t("admin.evalHarness.reviewTabsLabel")}>
          {REVIEW_TABS.map((id) => {
            const badge = tabBadge(id);
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`admin-eval-review__tab${tab === id ? " admin-eval-review__tab--active" : ""}`}
                onClick={() => setTab(id)}
              >
                {t(`admin.evalHarness.tabs.${id}`)}
                {badge ? <span className="admin-eval-review__tab-badge">{badge}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "report" ? (
        <section className="admin-eval-review__pane">
          <p className="admin-eval__sub">{t("admin.evalHarness.tabs.reportLead")}</p>
          {preview ? (
            <AdminEvalReportPreview
              expectedReach={evalCase.expectedReach}
              expectedMatch={evalCase.expectedMatch}
              expectedSafety={evalCase.expectedSafety}
              preview={preview}
            />
          ) : (
            <p className="admin-eval__empty">{t("admin.evalHarness.noReportYet")}</p>
          )}
        </section>
      ) : null}

      {tab === "rubric" ? (
        <section className="admin-eval-review__pane">
          <p className="admin-eval__sub">{t("admin.evalHarness.rubricLead")}</p>
          <div className="admin-eval-review__rubric-cards">
            {RUBRIC_DIMENSIONS.map((key) => {
              const row = draft.rubricScores[key];
              return (
                <div key={key} className="admin-eval-review__rubric-card">
                  <div className="admin-eval-review__rubric-head">
                    <span>{t(`admin.evalHarness.rubric.${key}`)}</span>
                    <div className="admin-eval-review__score-pills">
                      {SCORE_OPTIONS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`admin-eval-review__score-pill${row.score === n ? " admin-eval-review__score-pill--active" : ""}`}
                          onClick={() => {
                            const nextDraft = {
                              ...draft,
                              rubricScores: {
                                ...draft.rubricScores,
                                [key]: { ...draft.rubricScores[key], score: n },
                              },
                            };
                            onChange(nextDraft);
                            saveItem("immediate", nextDraft);
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    className="admin-eval-review__inline-input"
                    placeholder={t("admin.evalHarness.rubricNotesPlaceholder")}
                    value={row.notes}
                    onChange={(e) => updateRubric(key, { notes: e.target.value })}
                    onBlur={() => saveItem("immediate")}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "schools" ? (
        <section className="admin-eval-review__pane">
          <p className="admin-eval__sub">{t("admin.evalHarness.schoolLead")}</p>
          <div className="admin-eval-review__school-list">
            {draft.schoolReviews.map((row, index) => {
              const needsDetail = row.action !== "agree";
              return (
                <div
                  key={`${row.school}-${index}`}
                  className={`admin-eval-review__school-row${needsDetail ? " admin-eval-review__school-row--expanded" : ""}`}
                >
                  <div className="admin-eval-review__school-main">
                    <strong className="admin-eval-review__school-name">{row.school}</strong>
                    <span className="admin-eval-review__tier-pair">
                      AI {tierLabel(t, row.aiTier)} → {tierLabel(t, row.counselorTier)}
                    </span>
                    <div className="admin-eval-review__action-pills">
                      {(["agree", "adjust", "reject"] as const).map((action) => (
                        <button
                          key={action}
                          type="button"
                          className={`admin-eval-review__action-pill admin-eval-review__action-pill--${action}${
                            row.action === action ? " admin-eval-review__action-pill--active" : ""
                          }`}
                          onClick={() => {
                            const next = [...draft.schoolReviews];
                            next[index] = { ...row, action };
                            const nextDraft = { ...draft, schoolReviews: next };
                            onChange(nextDraft);
                            saveItem("immediate", nextDraft);
                          }}
                        >
                          {action === "agree"
                            ? t("admin.evalHarness.actionAgree")
                            : action === "adjust"
                              ? t("admin.evalHarness.actionAdjust")
                              : t("admin.evalHarness.actionReject")}
                        </button>
                      ))}
                    </div>
                    {row.action === "adjust" ? (
                      <label className="admin-eval-review__inline-field">
                        {t("admin.evalHarness.counselorTier")}
                        <select
                          value={row.counselorTier ?? ""}
                          onChange={(e) => {
                            const next = [...draft.schoolReviews];
                            next[index] = {
                              ...row,
                              counselorTier: e.target.value as "reach" | "match" | "safety",
                            };
                            const nextDraft = { ...draft, schoolReviews: next };
                            onChange(nextDraft);
                            saveItem("immediate", nextDraft);
                          }}
                        >
                          <option value="reach">{t("admin.eval.reachLabel")}</option>
                          <option value="match">{t("admin.eval.matchLabel")}</option>
                          <option value="safety">{t("admin.eval.safetyLabel")}</option>
                        </select>
                      </label>
                    ) : null}
                  </div>
                  {needsDetail ? (
                    <div className="admin-eval-review__school-detail">
                      <label>
                        {t("admin.evalHarness.reason")}
                        <input
                          value={row.reason}
                          onChange={(e) => {
                            const next = [...draft.schoolReviews];
                            next[index] = { ...row, reason: e.target.value };
                            onChange({ ...draft, schoolReviews: next });
                          }}
                          onBlur={() => saveItem("immediate")}
                        />
                      </label>
                      <label>
                        {t("admin.evalHarness.evidence")}
                        <input
                          value={row.evidence}
                          onChange={(e) => {
                            const next = [...draft.schoolReviews];
                            next[index] = { ...row, evidence: e.target.value };
                            onChange({ ...draft, schoolReviews: next });
                          }}
                          onBlur={() => saveItem("immediate")}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "profile" ? (
        <section className="admin-eval-review__pane">
          <p className="admin-eval__sub">{t("admin.evalHarness.profileLead")}</p>
          <div className="admin-eval-review__profile-list">
            {draft.profileDimensionReviews.map((row, index) => {
              const adjusted = row.aiScore != null && row.counselorScore != null && row.aiScore !== row.counselorScore;
              return (
                <div key={row.key} className={`admin-eval-review__profile-card${adjusted ? " admin-eval-review__profile-card--adjusted" : ""}`}>
                  <div className="admin-eval-review__profile-head">
                    <strong>{row.label}</strong>
                    <span className="admin-eval-review__score-compare">
                      AI {row.aiScore ?? "—"} → {t("admin.evalHarness.counselorScore")}{" "}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="admin-eval-review__score-input"
                        value={row.counselorScore ?? ""}
                        onChange={(e) => {
                          const next = [...draft.profileDimensionReviews];
                          next[index] = {
                            ...row,
                            counselorScore: e.target.value === "" ? null : Number(e.target.value),
                          };
                          onChange({ ...draft, profileDimensionReviews: next });
                        }}
                        onBlur={() => saveItem("immediate")}
                      />
                    </span>
                  </div>
                  {adjusted ? (
                    <div className="admin-eval-review__profile-detail">
                      <label>
                        {t("admin.evalHarness.reasonCategoryLabel")}
                        <select
                          value={row.reasonCategory}
                          onChange={(e) => {
                            const next = [...draft.profileDimensionReviews];
                            next[index] = { ...row, reasonCategory: e.target.value as typeof row.reasonCategory };
                            const nextDraft = { ...draft, profileDimensionReviews: next };
                            onChange(nextDraft);
                            saveItem("immediate", nextDraft);
                          }}
                        >
                          <option value="">{t("admin.eval.optional")}</option>
                          {CORRECTION_REASON_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {t(`admin.evalHarness.reasonCategories.${cat}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("admin.evalHarness.reason")}
                        <input
                          value={row.reason}
                          onChange={(e) => {
                            const next = [...draft.profileDimensionReviews];
                            next[index] = { ...row, reason: e.target.value };
                            onChange({ ...draft, profileDimensionReviews: next });
                          }}
                          onBlur={() => saveItem("immediate")}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "final" ? (
        <section className="admin-eval-review__pane">
          <p className="admin-eval__sub">{t("admin.evalHarness.finalLead")}</p>
          <div className="admin-eval-review__final-grid">
            <label>
              {t("admin.eval.reachLabel")}
              <textarea
                rows={3}
                value={draft.finalApprovedRecommendation.reach.join("\n")}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    finalApprovedRecommendation: {
                      ...draft.finalApprovedRecommendation,
                      reach: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    },
                  })
                }
                onBlur={() => saveItem("immediate")}
              />
            </label>
            <label>
              {t("admin.eval.matchLabel")}
              <textarea
                rows={3}
                value={draft.finalApprovedRecommendation.match.join("\n")}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    finalApprovedRecommendation: {
                      ...draft.finalApprovedRecommendation,
                      match: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    },
                  })
                }
                onBlur={() => saveItem("immediate")}
              />
            </label>
            <label>
              {t("admin.eval.safetyLabel")}
              <textarea
                rows={3}
                value={draft.finalApprovedRecommendation.safety.join("\n")}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    finalApprovedRecommendation: {
                      ...draft.finalApprovedRecommendation,
                      safety: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    },
                  })
                }
                onBlur={() => saveItem("immediate")}
              />
            </label>
          </div>
          <label className="admin-eval-review__notes">
            {t("admin.evalHarness.finalNotes")}
            <textarea
              rows={2}
              value={draft.finalApprovedRecommendation.notes}
              onChange={(e) =>
                onChange({
                  ...draft,
                  finalApprovedRecommendation: { ...draft.finalApprovedRecommendation, notes: e.target.value },
                })
              }
              onBlur={() => saveItem("immediate")}
            />
          </label>
          <label className="admin-eval-review__notes">
            {t("admin.eval.scoreNotes")}
            <textarea
              rows={2}
              value={draft.overallNotes}
              onChange={(e) => onChange({ ...draft, overallNotes: e.target.value })}
              onBlur={() => saveItem("immediate")}
            />
          </label>
        </section>
      ) : null}

      <div className="admin-eval-review__action-bar">
        <div className="admin-eval-review__action-bar-copy">
          <strong>
            {variant === "alumni"
              ? t("alumni.review.submitTitle")
              : t("admin.evalHarness.submitReviewTitle")}
          </strong>
          <p className={canSubmit ? undefined : "admin-eval-review__action-bar-warn"}>
            {canSubmit
              ? variant === "alumni"
                ? t("alumni.review.submitHint")
                : t("admin.evalHarness.submitReviewHint")
              : t("admin.evalHarness.submitReviewNeedSchools")}
          </p>
        </div>
        <div className="admin-eval-review__action-bar-btns">
          {variant === "admin" && onWriteEngineStandard ? (
            <button
              type="button"
              className="admin-portal__btn admin-portal__btn--ghost admin-portal__btn--lg"
              disabled={saving || engineWriteBusy || !canWriteEngineStandard}
              title={!canWriteEngineStandard ? t("admin.evalHarness.engineWriteNeedSubmit") : undefined}
              onClick={() => onWriteEngineStandard()}
            >
              {engineWriteBusy
                ? t("admin.evalHarness.engineWritingStandard")
                : engineWriteOk
                  ? t("admin.evalHarness.engineWroteStandard")
                  : t("admin.evalHarness.engineWriteStandard")}
            </button>
          ) : null}
          <ReviewActionButtons
            saving={saving}
            canSubmit={canSubmit}
            onSave={onSave}
            t={t}
            size="lg"
            variant={variant}
          />
        </div>
        <p className="admin-eval-review__footer-meta">
          {t("admin.evalHarness.reviewStats", {
            schools: String(schoolCorrections),
            profile: String(profileAdjustments),
          })}
          {saveState === "saving" ? ` · ${t("admin.evalHarness.reviewAutoSaving")}` : null}
          {saveState === "saved" ? ` · ${t("admin.evalHarness.reviewAutoSaved")}` : null}
          {saveState === "error" ? ` · ${t("admin.evalHarness.reviewAutoSaveErr")}` : null}
        </p>
      </div>
    </div>
  );
}
