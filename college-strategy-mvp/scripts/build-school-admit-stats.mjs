/**
 * Build school-admit-stats-2026.json from CSV.
 * Run: node scripts/build-school-admit-stats.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAdmitStatsRow } from "../server/schoolAdmitStatsParse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.join(__dirname, "..", "data", "engine", "school-admit-stats-2026.csv");
const OUT = path.join(__dirname, "..", "data", "engine", "school-admit-stats-2026.json");

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  let i = 1;
  while (i < lines.length) {
    let line = lines[i];
    while ((line.match(/"/g) ?? []).length % 2 === 1 && i + 1 < lines.length) {
      i += 1;
      line += `\n${lines[i]}`;
    }
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let j = 0; j < line.length; j += 1) {
      const ch = line[j];
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === "," && !inQ) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    rows.push(row);
    i += 1;
  }
  return rows;
}

const raw = fs.readFileSync(CSV, "utf8");
const parsed = parseCsv(raw).map(parseAdmitStatsRow).filter(Boolean);
fs.writeFileSync(OUT, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
console.log(`Wrote ${parsed.length} schools → ${OUT}`);
