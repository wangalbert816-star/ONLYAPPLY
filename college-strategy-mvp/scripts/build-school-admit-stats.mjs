/**
 * Build school-admit-stats-2026.json from CSV.
 * Also writes slim client lookup: src/data/school-campus-profile.json
 * Run: node scripts/build-school-admit-stats.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAdmitStatsCsv, parseAdmitStatsRow } from "../server/schoolAdmitStatsParse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.join(__dirname, "..", "data", "engine", "school-admit-stats-2026.csv");
const OUT = path.join(__dirname, "..", "data", "engine", "school-admit-stats-2026.json");
const CLIENT_OUT = path.join(__dirname, "..", "src", "data", "school-campus-profile.json");

const raw = fs.readFileSync(CSV, "utf8");
const parsed = parseAdmitStatsCsv(raw).map(parseAdmitStatsRow).filter(Boolean);
fs.writeFileSync(OUT, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

const clientRows = parsed
  .filter((row) => row.campusSize || row.community)
  .map((row) => ({
    school: row.school,
    aliases: row.aliases ?? [],
    campusSize: row.campusSize,
    community: row.community,
  }));
fs.writeFileSync(CLIENT_OUT, `${JSON.stringify(clientRows, null, 2)}\n`, "utf8");

console.log(`Wrote ${parsed.length} schools → ${OUT}`);
console.log(`Wrote ${clientRows.length} campus profiles → ${CLIENT_OUT}`);
