import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "public/data/us-high-schools.json");

/** @type {{ name: string; city: string; state: string }[]} */
let schoolsCache = null;

function loadSchools() {
  if (schoolsCache) return schoolsCache;
  if (!existsSync(dataPath)) {
    schoolsCache = [];
    return schoolsCache;
  }
  try {
    const parsed = JSON.parse(readFileSync(dataPath, "utf8"));
    schoolsCache = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("[usHighSchools] failed to parse us-high-schools.json:", e instanceof Error ? e.message : e);
    schoolsCache = [];
  }
  return schoolsCache;
}

export function formatHighSchoolLabel(school) {
  if (school.city && school.state) return `${school.name} (${school.city}, ${school.state})`;
  if (school.state) return `${school.name} (${school.state})`;
  return school.name;
}

export function searchUsHighSchools(query, limit = 20) {
  const q = String(query ?? "").trim().toLowerCase();
  if (q.length < 2) return [];

  const schools = loadSchools();
  const tokens = q.split(/\s+/).filter(Boolean);
  const out = [];

  for (const school of schools) {
    const hay = `${school.name} ${school.city} ${school.state}`.toLowerCase();
    if (!tokens.every((t) => hay.includes(t))) continue;
    out.push({ ...school, label: formatHighSchoolLabel(school) });
    if (out.length >= limit) break;
  }

  return out;
}

export function registerUsHighSchoolRoutes(app) {
  app.get("/api/high-schools/search", (req, res) => {
    const q = String(req.query.q ?? "");
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    if (loadSchools().length === 0) {
      return res.status(503).json({
        error: "high_schools_unavailable",
        schools: [],
      });
    }
    res.json({ schools: searchUsHighSchools(q, limit) });
  });
}
