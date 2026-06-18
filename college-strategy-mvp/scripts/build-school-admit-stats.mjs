/**
 * Build school-admit-stats-2026.json from CSV.
 * Run: node scripts/build-school-admit-stats.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAdmitStatsCsv, parseAdmitStatsRow } from "../server/schoolAdmitStatsParse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.join(__dirname, "..", "data", "engine", "school-admit-stats-2026.csv");
const OUT = path.join(__dirname, "..", "data", "engine", "school-admit-stats-2026.json");

const raw = fs.readFileSync(CSV, "utf8");
const parsed = parseAdmitStatsCsv(raw).map(parseAdmitStatsRow).filter(Boolean);
fs.writeFileSync(OUT, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
console.log(`Wrote ${parsed.length} schools → ${OUT}`);
