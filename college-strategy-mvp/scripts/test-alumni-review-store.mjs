import assert from "node:assert/strict";
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

console.log("alumni review store regression tests passed");
