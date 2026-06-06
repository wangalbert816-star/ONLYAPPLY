#!/usr/bin/env node
/**
 * Build US public high school list from NCES CCD via Urban Institute API (~23k schools).
 * Output: public/data/us-high-schools.json
 *
 * Usage: node scripts/build-us-high-schools.mjs
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "public/data/us-high-schools.json");

const BASE =
  "https://educationdata.urban.org/api/v1/schools/ccd/directory/2023/?school_level=3&school_status=1&per_page=10000";

async function fetchAll() {
  const byKey = new Map();
  let url = BASE;
  let page = 0;

  while (url) {
    page += 1;
    process.stderr.write(`Fetching page ${page}…\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
    const data = await res.json();
    for (const row of data.results ?? []) {
      const name = String(row.school_name ?? "").trim();
      const city = String(row.city_location || row.city_mailing || "").trim();
      const state = String(row.state_location || row.state_mailing || "").trim();
      if (!name) continue;
      const key = `${name.toLowerCase()}|${city.toLowerCase()}|${state}`;
      if (!byKey.has(key)) byKey.set(key, { name, city, state });
    }
    url = data.next;
  }

  return [...byKey.values()].sort((a, b) =>
    `${a.state}${a.name}`.localeCompare(`${b.state}${b.name}`, "en"),
  );
}

const schools = await fetchAll();
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(schools));
console.log(`Wrote ${schools.length} schools → ${outPath}`);
