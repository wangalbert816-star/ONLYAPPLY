import assert from "node:assert/strict";
import test from "node:test";

test("publish keeps warm Supabase benchmarks when forced reload fails", async () => {
  const previousEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;

  process.env.SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

  const supabaseDraftRow = {
    tier: "draft",
    source_case_key: "supabase-only-case",
    title: "Supabase only case",
    profile: { gpaBand: "high" },
    approved_schools: { reach: ["A"], match: ["B"], safety: ["C"] },
    review_feedback: null,
    notes: "remote draft",
    updated_at: "2026-08-19T00:00:00.000Z",
    updated_by: "reviewer@example.com",
  };
  const supabaseLiveRow = {
    ...supabaseDraftRow,
    tier: "live",
    notes: "remote live",
  };

  let failLoads = false;
  const benchmarkUpserts = [];

  console.warn = () => {};
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";

    if (url.includes("/rest/v1/engine_benchmarks?select=*") && method === "HEAD") {
      if (failLoads) {
        return new Response(null, {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, {
        status: 200,
        headers: { "content-range": "0-1/2" },
      });
    }

    if (url.includes("/rest/v1/engine_benchmarks?select=*&order=source_case_key.asc") && method === "GET") {
      return Response.json([supabaseDraftRow, supabaseLiveRow]);
    }

    if (url.includes("/rest/v1/engine_benchmark_publish_log?select=published_at") && method === "GET") {
      return Response.json([]);
    }

    if (url.includes("/rest/v1/engine_benchmarks?on_conflict=") && method === "POST") {
      benchmarkUpserts.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 201 });
    }

    if (url.includes("/rest/v1/engine_benchmarks?select=source_case_key") && method === "GET") {
      return Response.json([{ source_case_key: supabaseDraftRow.source_case_key }]);
    }

    if (url.includes("/rest/v1/engine_benchmark_publish_log") && method === "POST") {
      return new Response(null, { status: 201 });
    }

    throw new Error(`Unexpected fetch: ${method} ${url}`);
  };

  try {
    const store = await import(`./engineBenchmarksStore.mjs?test=${Date.now()}`);

    const initialLoad = await store.ensureBenchmarksLoaded(true);
    assert.equal(initialLoad.source, "supabase");
    assert.deepEqual(
      store.listDraftBenchmarksCached().map((entry) => entry.sourceCaseKey),
      ["supabase-only-case"],
    );

    failLoads = true;
    const result = await store.publishDraftBenchmarksToLive("admin@example.com");

    assert.equal(result.ok, true);
    assert.equal(benchmarkUpserts.length, 1);
    assert.deepEqual(
      benchmarkUpserts[0].map((row) => row.source_case_key),
      ["supabase-only-case"],
    );
    assert.equal(store.getBenchmarkStorageSource(), "supabase");
  } finally {
    console.warn = originalWarn;
    globalThis.fetch = originalFetch;
    if (previousEnv.SUPABASE_URL === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousEnv.SUPABASE_URL;
    if (previousEnv.SUPABASE_SERVICE_ROLE_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousEnv.SUPABASE_SERVICE_ROLE_KEY;
  }
});
