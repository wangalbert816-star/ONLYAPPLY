/** Promote admin-approved alumni reviews into engine benchmarks and training corpus. */

import { mapEvalReview } from "./adminEvalReview.mjs";
import { upsertBenchmarkToLiveFromReview } from "./engineStandards.mjs";
import { upsertGoldCaseFromEval } from "./trainingCorpus.mjs";
import { reportBodyFromFormSnapshot } from "./reportApiBody.mjs";

export function evalCaseFromAlumniRow(row) {
  const form = row.form_snapshot ?? {};
  const intake = row.intake_term || reportBodyFromFormSnapshot(form).intakeTerm || "alumni";
  return {
    caseKey: `alumni-${row.id}`,
    title: `${intake} · Alumni feedback`,
    tags: ["alumni", String(intake).slice(0, 40)],
    source: "alumni_feedback",
    reportBody: reportBodyFromFormSnapshot(form, row.locale),
    expectedReach: [],
    expectedMatch: [],
    expectedSafety: [],
  };
}

export function reviewFromAlumniRow(row, statusOverride) {
  const status = statusOverride ?? row.status;
  return mapEvalReview({
    ...row,
    status,
    run_id: null,
    case_id: null,
    reviewed_by: row.user_id,
    approved_at: status === "approved" ? row.approved_at ?? new Date().toISOString() : null,
  });
}

export async function syncApprovedAlumniReview(row, reviewerEmail) {
  const review = reviewFromAlumniRow(row, "approved");
  const evalCase = evalCaseFromAlumniRow(row);
  const result = { reportPayload: row.report_snapshot ?? {} };

  const trainingCorpus = upsertGoldCaseFromEval({
    evalCase,
    review,
    result,
    run: null,
  });
  const decisionEngine = await upsertBenchmarkToLiveFromReview({
    evalCase,
    review,
    reviewerEmail,
  });

  return { trainingCorpus, decisionEngine };
}
