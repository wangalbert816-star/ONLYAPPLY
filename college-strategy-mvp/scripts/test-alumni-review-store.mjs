import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerAlumniReviewRoutes } from "../server/alumniReviews.mjs";
import { upsertAlumniReview } from "../server/alumniReviewsStore.mjs";

const userId = "00000000-0000-4000-8000-000000000001";
const reportId = "00000000-0000-4000-8000-000000000002";

function reviewInput(overrides = {}) {
  return {
    reportId,
    applicationId: null,
    reportSnapshot: { reach: [], match: [], safety: [] },
    formSnapshot: { gpa: "4.0" },
    rubricVersion: "test",
    payload: {
      status: "draft",
      rubric_scores: {},
      school_reviews: [],
      profile_dimension_reviews: [],
      final_approved_recommendation: {},
      overall_notes: null,
      submitted_at: null,
    },
    ...overrides,
  };
}

function createForeignKeyFailingAdmin() {
  const insertedRows = [];
  const admin = {
    insertedRows,
    from(table) {
      assert.equal(table, "alumni_report_reviews");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null });
        },
        insert(row) {
          insertedRows.push(row);
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({
                    data: null,
                    error: {
                      code: "23503",
                      message: 'insert or update on table "alumni_report_reviews" violates foreign key constraint',
                    },
                  });
                },
              };
            },
          };
        },
      };
    },
  };
  return admin;
}

await assert.rejects(
  () => upsertAlumniReview(null, userId, reviewInput({ reportId: null })),
  /alumni_review_report_required/,
);

const admin = createForeignKeyFailingAdmin();
await assert.rejects(
  () => upsertAlumniReview(admin, userId, reviewInput()),
  /alumni_review_report_link_invalid/,
);

assert.equal(admin.insertedRows.length, 1);
assert.equal(admin.insertedRows[0].report_id, reportId);
assert.equal(admin.insertedRows[0].application_id, null);

async function withTestServer(handler) {
  const app = express();
  registerAlumniReviewRoutes(app, {
    express,
    supabaseAdmin: () => ({
      auth: {
        getUser: async (token) => ({
          data: { user: token === "test-token" ? { id: userId, email: "alumni@example.com" } : null },
          error: token === "test-token" ? null : new Error("bad token"),
        }),
      },
      from() {
        throw new Error("store should not be reached when reportId is missing");
      },
    }),
  });

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    await handler(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

await withTestServer(async (baseUrl) => {
  const res = await fetch(`${baseUrl}/api/alumni/report-reviews`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify(reviewInput({ reportId: null })),
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "alumni_review_report_required" });
});

console.log("alumni review store regression tests passed");
