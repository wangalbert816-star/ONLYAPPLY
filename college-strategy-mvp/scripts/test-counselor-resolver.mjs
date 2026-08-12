import assert from "node:assert/strict";

import { resolveCounselorForAuthUser } from "../server/counselorCrm.mjs";

class FakeCounselorQuery {
  constructor(rows, calls) {
    this.rows = rows;
    this.calls = calls;
    this.filters = [];
  }

  select(columns) {
    this.calls.push({ method: "select", columns });
    return this;
  }

  eq(column, value) {
    this.calls.push({ method: "eq", column, value });
    this.filters.push({ column, value });
    return this;
  }

  ilike(column, value) {
    this.calls.push({ method: "ilike", column, value });
    return this;
  }

  update(payload) {
    this.calls.push({ method: "update", payload });
    return this;
  }

  maybeSingle() {
    this.calls.push({ method: "maybeSingle" });
    const matches = this.rows.filter((row) =>
      this.filters.every(({ column, value }) => row[column] === value),
    );
    return { data: matches[0] ?? null, error: null };
  }
}

function fakeAdmin(rows) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push({ method: "from", table });
      assert.equal(table, "counselors");
      return new FakeCounselorQuery(rows, calls);
    },
  };
}

const boundCounselor = {
  id: "counselor-1",
  user_id: "auth-user-1",
  email: "counselor@example.com",
  active: true,
};

{
  const admin = fakeAdmin([boundCounselor]);
  const resolved = await resolveCounselorForAuthUser(admin, {
    id: "auth-user-1",
    email: "counselor@example.com",
  });

  assert.deepEqual(resolved, { counselor: boundCounselor, linkedAuth: true });
  assert.equal(admin.calls.some((call) => call.method === "ilike"), false);
  assert.equal(admin.calls.some((call) => call.method === "update"), false);
}

{
  const unboundCounselor = {
    id: "counselor-2",
    user_id: null,
    email: "claimed@example.com",
    active: true,
  };
  const admin = fakeAdmin([unboundCounselor]);
  const resolved = await resolveCounselorForAuthUser(admin, {
    id: "attacker-auth-user",
    email: "claimed@example.com",
  });

  assert.equal(resolved, null);
  assert.equal(admin.calls.some((call) => call.method === "ilike"), false);
  assert.equal(admin.calls.some((call) => call.method === "update"), false);
}

console.log("test-counselor-resolver: ok");
