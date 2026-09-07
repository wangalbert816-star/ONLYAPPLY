/**
 * API regression tests for route-specific JSON body limits.
 * Run: node scripts/test-api-limits.mjs
 */
import assert from "node:assert/strict";
import http from "node:http";

process.env.NODE_ENV = "test";
process.env.VERCEL = "1";

const { default: app } = await import("../server/index.mjs");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address());
    });
  });
}

async function postJson(baseUrl, path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return { status: response.status, text };
}

const server = http.createServer(app);

try {
  const address = await listen(server);
  const baseUrl = `http://${address.address}:${address.port}`;

  const small = await postJson(baseUrl, "/api/chances/evaluate", {
    gpa: "3.9",
    schools: ["Penn State University"],
  });
  assert.equal(small.status, 200, small.text);
  const smallJson = JSON.parse(small.text);
  assert.equal(smallJson.schools?.[0]?.school, "Penn State University");

  const oversized = await postJson(baseUrl, "/api/chances/evaluate", {
    gpa: "3.9",
    schools: ["Penn State University"],
    padding: "x".repeat(64 * 1024),
  });
  assert.equal(oversized.status, 413, oversized.text);

  console.log("api limit tests passed");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
