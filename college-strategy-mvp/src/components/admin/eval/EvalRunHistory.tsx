import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminEvalCase, AdminEvalRun, AdminEvalRunResult } from "../../../lib/admin/crmAdminApi";
import { fetchAdminEvalRun } from "../../../lib/admin/crmAdminApi";
import type { ProfileDimensionKey } from "../../../lib/fiveDimensionProfile";
import {
  buildProfileCompareRows,
  buildRubricCompareRows,
  buildSchoolCompareRows,
  formatCompareDelta,
  formatCompareScore,
  formatRunWhen,
  resultForCase,
  reviewDraftFromResult,
  rubricAvgFromDraft,
  rubricAvgFromResult,
  runsWithCaseResult,
  schoolTierMapFromReport,
  type EvalSchoolTier,
} from "../../../lib/admin/evalRunCompare";
import type { RubricDimension } from "../../../lib/admin/evalRubric";
import type { Translate } from "../../../i18n/LanguageContext";
import type { Locale } from "../../../i18n/strings";

type Props = {
  token: string;
  locale: Locale;
  runs: AdminEvalRun[];
  cases: AdminEvalCase[];
  selectedRunId: string;
  selectedCaseId: string;
  onSelectRun: (runId: string) => void;
  onSelectCase: (caseId: string) => void;
  onOpenReview: () => void;
  t: Translate;
};

type RunBundle = { run: AdminEvalRun; results: AdminEvalRunResult[] };

function tierLabel(t: Translate, tier: EvalSchoolTier | null) {
  if (tier === "reach") return t("admin.eval.reachLabel");
  if (tier === "match") return t("admin.eval.matchLabel");
  if (tier === "safety") return t("admin.eval.safetyLabel");
  return "—";
}

function reviewStatusLabel(t: Translate, results: AdminEvalRunResult[]) {
  const reviewed = results.filter((r) => r.review);
  if (!reviewed.length) return t("admin.evalHarness.historyNoReview");
  const submitted = reviewed.filter((r) => r.review?.status === "submitted" || r.review?.status === "approved");
  if (submitted.length === reviewed.length) return t("admin.evalHarness.submitted");
  if (submitted.length > 0) return t("admin.evalHarness.historyPartialReview");
  return t("admin.evalHarness.draftStatus");
}

export function EvalRunHistory({
  token,
  locale,
  runs,
  cases,
  selectedRunId,
  selectedCaseId,
  onSelectRun,
  onSelectCase,
  onOpenReview,
  t,
}: Props) {
  const profileLabel = useCallback((key: ProfileDimensionKey) => t(`admin.evalHarness.profile.${key}`), [t]);

  const [filterCaseId, setFilterCaseId] = useState(selectedCaseId);
  const [bundles, setBundles] = useState<RunBundle[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [compareRunA, setCompareRunA] = useState("");
  const [compareRunB, setCompareRunB] = useState("");

  useEffect(() => {
    if (selectedCaseId) setFilterCaseId(selectedCaseId);
  }, [selectedCaseId]);

  useEffect(() => {
    if (!runs.length) {
      setBundles([]);
      return;
    }
    let cancelled = false;
    setLoadingRuns(true);
    void (async () => {
      try {
        const slice = runs.slice(0, 24);
        const loaded = await Promise.all(
          slice.map(async (run) => {
            const detail = await fetchAdminEvalRun(token, run.id);
            return { run: detail.run, results: detail.results };
          }),
        );
        if (!cancelled) setBundles(loaded);
      } finally {
        if (!cancelled) setLoadingRuns(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runs, token]);

  const filteredBundles = useMemo(() => {
    if (!filterCaseId) return bundles;
    return bundles.filter(({ results }) => resultForCase(results, filterCaseId));
  }, [bundles, filterCaseId]);

  const compareOptions = useMemo(() => {
    if (!filterCaseId) return [];
    return runsWithCaseResult(bundles, filterCaseId);
  }, [bundles, filterCaseId]);

  useEffect(() => {
    if (compareOptions.length < 2) {
      setCompareRunA("");
      setCompareRunB("");
      return;
    }
    const ids = compareOptions.map((o) => o.run.id);
    setCompareRunA((prev) => (prev && ids.includes(prev) ? prev : compareOptions[1]?.run.id ?? ""));
    setCompareRunB((prev) => (prev && ids.includes(prev) ? prev : compareOptions[0]?.run.id ?? ""));
  }, [compareOptions]);

  const compareLeft = compareOptions.find((o) => o.run.id === compareRunA) ?? null;
  const compareRight = compareOptions.find((o) => o.run.id === compareRunB) ?? null;

  const draftLeft =
    compareLeft && compareRunA !== compareRunB ? reviewDraftFromResult(compareLeft.result, profileLabel) : null;
  const draftRight =
    compareRight && compareRunA !== compareRunB ? reviewDraftFromResult(compareRight.result, profileLabel) : null;

  const compareRows =
    compareLeft && compareRight && compareRunA !== compareRunB
      ? buildSchoolCompareRows(
          schoolTierMapFromReport(compareLeft.result.reportPayload),
          schoolTierMapFromReport(compareRight.result.reportPayload),
        )
      : [];

  const profileCompareRows =
    draftLeft && draftRight ? buildProfileCompareRows(draftLeft, draftRight, profileLabel) : [];

  const rubricCompareRows =
    draftLeft && draftRight
      ? buildRubricCompareRows(draftLeft, draftRight, (key: RubricDimension) => t(`admin.evalHarness.rubric.${key}`))
      : [];

  const changedCount = compareRows.filter((r) => r.changed).length;
  const profileChangedCount = profileCompareRows.filter((r) => r.changed).length;
  const rubricChangedCount = rubricCompareRows.filter((r) => r.changed).length;
  const hasRubricCompare = rubricCompareRows.some((r) => r.scoreA != null || r.scoreB != null);

  return (
    <div className="admin-eval-run-history">
      <section className="admin-eval-run-history__section">
        <div className="admin-eval-harness__section-head">
          <h3 className="admin-eval__heading">{t("admin.evalHarness.historyTitle")}</h3>
          {loadingRuns ? <span className="admin-eval-run-history__meta">{t("admin.evalHarness.historyLoading")}</span> : null}
        </div>
        <p className="admin-eval__sub">{t("admin.evalHarness.historyLead")}</p>

        <label className="admin-eval-run-history__filter">
          <span>{t("admin.evalHarness.historyFilterCase")}</span>
          <select
            value={filterCaseId}
            onChange={(e) => setFilterCaseId(e.target.value)}
            className="admin-portal__input"
          >
            <option value="">{t("admin.evalHarness.historyAllCases")}</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.caseKey} · {c.title}
              </option>
            ))}
          </select>
        </label>

        {!filteredBundles.length && !loadingRuns ? (
          <p className="admin-eval__empty">{t("admin.evalHarness.historyEmpty")}</p>
        ) : (
          <ul className="admin-eval-run-history__list">
            {filteredBundles.map(({ run, results }) => {
              const active = run.id === selectedRunId;
              const okCount = results.filter((r) => r.status === "ok").length;
              return (
                <li
                  key={run.id}
                  className={`admin-eval-run-history__item${active ? " admin-eval-run-history__item--active" : ""}`}
                >
                  <div className="admin-eval-run-history__item-main">
                    <strong>{run.label}</strong>
                    <span className="admin-eval-run-history__meta">
                      {formatRunWhen(run.createdAt, locale)} · P {run.promptVersion ?? "—"} · {okCount}/{run.caseCount}{" "}
                      {t("admin.evalHarness.historyOk")} · {reviewStatusLabel(t, results)}
                    </span>
                  </div>
                  <div className="admin-eval-run-history__actions">
                    <button
                      type="button"
                      className={`admin-portal__btn admin-portal__btn--ghost${active ? " admin-portal__btn--primary" : ""}`}
                      onClick={() => onSelectRun(run.id)}
                    >
                      {active ? t("admin.evalHarness.historySelected") : t("admin.evalHarness.historySelectRun")}
                    </button>
                    {active && resultForCase(results, filterCaseId || selectedCaseId) ? (
                      <button type="button" className="admin-portal__btn admin-portal__btn--ghost" onClick={onOpenReview}>
                        {t("admin.evalHarness.reviewForCase")}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="admin-eval-run-history__section admin-eval-run-history__compare">
        <h3 className="admin-eval__heading">{t("admin.evalHarness.compareTitle")}</h3>
        <p className="admin-eval__sub">{t("admin.evalHarness.compareLead")}</p>

        {compareOptions.length < 2 ? (
          <p className="admin-eval__empty">{t("admin.evalHarness.compareNeedTwo")}</p>
        ) : (
          <>
            <div className="admin-eval-run-history__compare-picks">
              <label>
                <span>{t("admin.evalHarness.compareCase")}</span>
                <select
                  value={filterCaseId}
                  onChange={(e) => {
                    setFilterCaseId(e.target.value);
                    onSelectCase(e.target.value);
                  }}
                  className="admin-portal__input"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseKey} · {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t("admin.evalHarness.compareRunA")}</span>
                <select value={compareRunA} onChange={(e) => setCompareRunA(e.target.value)} className="admin-portal__input">
                  {compareOptions.map(({ run }) => (
                    <option key={run.id} value={run.id} disabled={run.id === compareRunB}>
                      {run.label} · P {run.promptVersion ?? "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t("admin.evalHarness.compareRunB")}</span>
                <select value={compareRunB} onChange={(e) => setCompareRunB(e.target.value)} className="admin-portal__input">
                  {compareOptions.map(({ run }) => (
                    <option key={run.id} value={run.id} disabled={run.id === compareRunA}>
                      {run.label} · P {run.promptVersion ?? "—"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {compareLeft && compareRight && compareRunA !== compareRunB ? (
              <>
                <div className="admin-eval-run-history__compare-meta">
                  <div>
                    <strong>{compareLeft.run.label}</strong>
                    <span>
                      P {compareLeft.run.promptVersion ?? "—"} · M {compareLeft.result.model ?? "—"}
                      {rubricAvgFromDraft(draftLeft) != null
                        ? ` · ${t("admin.evalHarness.rubricAvg", {
                            avg: rubricAvgFromDraft(draftLeft)!.toFixed(1),
                          })}`
                        : rubricAvgFromResult(compareLeft.result, profileLabel) != null
                          ? ` · ${t("admin.evalHarness.rubricAvg", {
                              avg: rubricAvgFromResult(compareLeft.result, profileLabel)!.toFixed(1),
                            })}`
                          : ""}
                    </span>
                  </div>
                  <div>
                    <strong>{compareRight.run.label}</strong>
                    <span>
                      P {compareRight.run.promptVersion ?? "—"} · M {compareRight.result.model ?? "—"}
                      {rubricAvgFromDraft(draftRight) != null
                        ? ` · ${t("admin.evalHarness.rubricAvg", {
                            avg: rubricAvgFromDraft(draftRight)!.toFixed(1),
                          })}`
                        : rubricAvgFromResult(compareRight.result, profileLabel) != null
                          ? ` · ${t("admin.evalHarness.rubricAvg", {
                              avg: rubricAvgFromResult(compareRight.result, profileLabel)!.toFixed(1),
                            })}`
                          : ""}
                    </span>
                  </div>
                </div>

                <div className="admin-eval-run-history__compare-block">
                  <h4 className="admin-eval-run-history__compare-heading">{t("admin.evalHarness.compareSchoolsTitle")}</h4>
                  <p className="admin-eval-run-history__compare-summary">
                    {t("admin.evalHarness.compareChanged", { count: String(changedCount) })}
                  </p>
                  <div className="admin-eval-run-history__compare-table-wrap">
                    <table className="admin-eval-run-history__compare-table">
                      <thead>
                        <tr>
                          <th>{t("admin.evalHarness.compareSchool")}</th>
                          <th>{compareLeft.run.label}</th>
                          <th>{compareRight.run.label}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareRows.map((row) => (
                          <tr key={row.school} className={row.changed ? "admin-eval-run-history__compare-row--changed" : ""}>
                            <td>{row.school}</td>
                            <td>{tierLabel(t, row.tierA)}</td>
                            <td>{tierLabel(t, row.tierB)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="admin-eval-run-history__compare-block">
                  <h4 className="admin-eval-run-history__compare-heading">{t("admin.evalHarness.compareProfileTitle")}</h4>
                  <p className="admin-eval-run-history__compare-summary">
                    {t("admin.evalHarness.compareProfileChanged", { count: String(profileChangedCount) })}
                    {" · "}
                    {t("admin.evalHarness.compareProfileHint")}
                  </p>
                  <div className="admin-eval-run-history__compare-table-wrap">
                    <table className="admin-eval-run-history__compare-table">
                      <thead>
                        <tr>
                          <th>{t("admin.evalHarness.compareDimension")}</th>
                          <th>{compareLeft.run.label}</th>
                          <th>{compareRight.run.label}</th>
                          <th>{t("admin.evalHarness.compareDelta")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profileCompareRows.map((row) => (
                          <tr key={row.key} className={row.changed ? "admin-eval-run-history__compare-row--changed" : ""}>
                            <td>{row.label}</td>
                            <td>{formatCompareScore(row.scoreA)}</td>
                            <td>{formatCompareScore(row.scoreB)}</td>
                            <td>{formatCompareDelta(row.delta)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="admin-eval-run-history__compare-block">
                  <h4 className="admin-eval-run-history__compare-heading">{t("admin.evalHarness.compareRubricTitle")}</h4>
                  {hasRubricCompare ? (
                    <>
                      <p className="admin-eval-run-history__compare-summary">
                        {t("admin.evalHarness.compareRubricChanged", { count: String(rubricChangedCount) })}
                      </p>
                      <div className="admin-eval-run-history__compare-table-wrap">
                        <table className="admin-eval-run-history__compare-table">
                          <thead>
                            <tr>
                              <th>{t("admin.evalHarness.compareDimension")}</th>
                              <th>{compareLeft.run.label}</th>
                              <th>{compareRight.run.label}</th>
                              <th>{t("admin.evalHarness.compareDelta")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rubricCompareRows.map((row) => (
                              <tr key={row.key} className={row.changed ? "admin-eval-run-history__compare-row--changed" : ""}>
                                <td>{row.label}</td>
                                <td>{formatCompareScore(row.scoreA)}</td>
                                <td>{formatCompareScore(row.scoreB)}</td>
                                <td>{formatCompareDelta(row.delta)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="admin-eval__empty">{t("admin.evalHarness.compareRubricNeedReview")}</p>
                  )}
                </div>
              </>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
