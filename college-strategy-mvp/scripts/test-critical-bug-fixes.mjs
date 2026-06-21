import assert from "node:assert/strict";
import express from "express";
import { registerAlumniReviewRoutes } from "../server/alumniReviews.mjs";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function withServer(app, fn) {
  const server = await listen(app);
  try {
    const { port } = server.address();
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function testLargeTranscriptPayloadUsesRouteLimit() {
  process.env.VERCEL = "1";
  const { default: app } = await import("../server/index.mjs");
  await withServer(app, async (baseUrl) => {
    const text = `${"A".repeat(4.5 * 1024 * 1024)}\nGrade 12 AP Calculus A`;
    const res = await fetch(`${baseUrl}/api/transcript/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locale: "en" }),
    });
    assert.notEqual(res.status, 413, "transcript route should accept payloads over the global 4mb limit");
  });
}

async function testLockedAlumniReportUpsertWithoutIdIsRejected() {
  const app = express();
  const userId = "11111111-1111-4111-8111-111111111111";
  const reportId = "22222222-2222-4222-8222-222222222222";
  let updateCalled = false;

  const admin = {
    auth: {
      async getUser() {
        return { data: { user: { id: userId, email: "alumni@example.com" } }, error: null };
      },
    },
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        update() {
          updateCalled = true;
          return this;
        },
        async maybeSingle() {
          return {
            data: {
              id: "33333333-3333-4333-8333-333333333333",
              user_id: userId,
              report_id: reportId,
              status: "approved",
              report_snapshot: {},
              form_snapshot: {},
            },
            error: null,
          };
        },
      };
    },
  };

  registerAlumniReviewRoutes(app, { supabaseAdmin: () => admin, express });

  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/alumni/report-reviews`, {
      method: "PUT",
      headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId,
        status: "draft",
        rubricScores: {},
        schoolReviews: [],
        profileDimensionReviews: [],
        finalApprovedRecommendation: {},
      }),
    });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "alumni_review_locked" });
    assert.equal(updateCalled, false, "locked reviews must be rejected before update");
  });
}

await testLargeTranscriptPayloadUsesRouteLimit();
await testLockedAlumniReportUpsertWithoutIdIsRejected();
console.log("critical bug regression checks passed");
