import assert from "node:assert/strict";
import test from "node:test";

import { mergeDecisionSchoolsIntoReport } from "./decisionEngine.mjs";

function decisionWithReach(reach) {
  return {
    ok: true,
    mode: "scored",
    source: "test",
    schools: {
      reach,
      match: [],
      safety: [],
    },
  };
}

test("mergeDecisionSchoolsIntoReport keeps reordered LLM prose with the matching school", () => {
  const parsed = {
    reach: [
      {
        school: "Beta University",
        why_reach_for_you: "Beta-specific rationale",
        key_risks: ["Beta-specific risk"],
      },
      {
        school: "Alpha University",
        why_reach_for_you: "Alpha-specific rationale",
        key_risks: ["Alpha-specific risk"],
      },
      {
        school: "Gamma College",
        why_reach_for_you: "Gamma-specific rationale",
        key_risks: ["Gamma-specific risk"],
      },
    ],
  };

  mergeDecisionSchoolsIntoReport(
    parsed,
    decisionWithReach([
      { school: "Alpha University", note: "Alpha engine note" },
      { school: "Beta University", note: "Beta engine note" },
      { school: "Gamma College", note: "Gamma engine note" },
    ]),
    "en",
  );

  assert.deepEqual(
    parsed.reach.map((row) => row.school),
    ["Alpha University", "Beta University", "Gamma College"],
  );
  assert.equal(parsed.reach[0].why_reach_for_you, "Alpha-specific rationale");
  assert.deepEqual(parsed.reach[0].key_risks, ["Alpha-specific risk"]);
  assert.equal(parsed.reach[1].why_reach_for_you, "Beta-specific rationale");
  assert.deepEqual(parsed.reach[1].key_risks, ["Beta-specific risk"]);
});

test("mergeDecisionSchoolsIntoReport matches common school aliases before falling back", () => {
  const parsed = {
    reach: [
      {
        school: "University of California, Los Angeles",
        why_reach_for_you: "UCLA-specific rationale",
      },
    ],
  };

  mergeDecisionSchoolsIntoReport(parsed, decisionWithReach([{ school: "UCLA", note: "Engine UCLA note" }]), "en");

  assert.equal(parsed.reach[0].school, "UCLA");
  assert.equal(parsed.reach[0].why_reach_for_you, "UCLA-specific rationale");
});

test("mergeDecisionSchoolsIntoReport does not attach prose from a different named school", () => {
  const parsed = {
    reach: [
      {
        school: "Wrong University",
        why_reach_for_you: "Wrong-school rationale",
        key_risks: ["Wrong-school risk"],
      },
    ],
  };

  mergeDecisionSchoolsIntoReport(parsed, decisionWithReach([{ school: "New University", note: "Engine note" }]), "en");

  assert.equal(parsed.reach[0].school, "New University");
  assert.equal(parsed.reach[0].why_reach_for_you, "Engine note");
  assert.equal(parsed.reach[0].key_risks, undefined);
});
