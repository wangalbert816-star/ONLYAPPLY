import type { FormState } from "../types";
import { isActivityThinFromForm } from "./activityEvidence";

export type UcAcademicBand = "weak" | "mid" | "strong";

export type UcProfileSignals = {
  band: UcAcademicBand;
  activityThin: boolean;
  unweightedGpa: number | null;
  weightedGpa: number | null;
  sat: number | null;
};

function parseGpaNumbers(gpaText: string): { unweighted: number | null; weighted: number | null } {
  const t = gpaText.trim();
  if (!t) return { unweighted: null, weighted: null };
  let unweighted: number | null = null;
  let weighted: number | null = null;
  const uw = t.match(/(?:unweighted|UW|未加权|非加权)[^\d]*(\d(?:\.\d{1,2})?)/i);
  const w = t.match(/(?:weighted|W|加权)[^\d]*(\d(?:\.\d{1,2})?)/i);
  if (uw) unweighted = Number(uw[1]);
  if (w) weighted = Number(w[1]);
  const all = [...t.matchAll(/\b([1-4]\.\d{1,2})\b/g)].map((m) => Number(m[1]));
  if (unweighted == null && all.length) unweighted = Math.min(...all);
  if (weighted == null && all.length > 1) weighted = Math.max(...all);
  if (weighted == null && all.length === 1) weighted = all[0];
  return { unweighted, weighted };
}

function parseSatScore(form: FormState): number | null {
  const d = form.satScore.replace(/\D/g, "");
  if (d.length < 3) return null;
  const n = Number(d.slice(0, 4));
  if (n >= 400 && n <= 1600) return n;
  return null;
}

export function assessUcProfileSignals(form: FormState): UcProfileSignals {
  const { unweighted, weighted } = parseGpaNumbers(form.gpa);
  const sat = parseSatScore(form);
  const activityThin = isActivityThinFromForm(form);

  let band: UcAcademicBand = "mid";
  const uw = unweighted ?? weighted;
  const w = weighted ?? unweighted;

  if ((uw != null && uw <= 3.25) || (w != null && w <= 3.45) || (sat != null && sat <= 1280)) {
    band = "weak";
  } else if (
    (uw != null && uw >= 3.75) ||
    (w != null && w >= 4.0) ||
    (sat != null && sat >= 1420)
  ) {
    band = "strong";
  }

  if (activityThin && band === "strong") band = "mid";
  if (activityThin && band === "mid") band = "weak";

  return {
    band,
    activityThin,
    unweightedGpa: unweighted,
    weightedGpa: weighted,
    sat,
  };
}

/** 是否允许 Berkeley / UCLA 出现在 UC 冲刺档 */
export function allowUcFlagshipReach(form: FormState, signals = assessUcProfileSignals(form)): boolean {
  if (signals.band === "weak" || signals.activityThin) return false;
  if (signals.band === "strong" && !signals.activityThin) return true;
  if (form.riskStyle === "aggressive" && signals.band === "mid" && !signals.activityThin) {
    const satOk = signals.sat == null || signals.sat >= 1350;
    const gpaOk =
      (signals.unweightedGpa != null && signals.unweightedGpa >= 3.5) ||
      (signals.weightedGpa != null && signals.weightedGpa >= 3.7);
    return satOk && gpaOk;
  }
  return false;
}

export function isWeakUcProfile(form: FormState, signals = assessUcProfileSignals(form)): boolean {
  return signals.band === "weak" || signals.activityThin;
}
