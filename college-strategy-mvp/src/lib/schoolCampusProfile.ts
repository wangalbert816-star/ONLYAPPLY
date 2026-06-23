import profileMap from "../data/school-campus-profile.json";
import { normalizeSchoolNameInput, schoolNameLookupVariants } from "./schoolNameResolve";

type CampusProfile = { campusSize: string; community: string; school: string; aliases?: string[] };

const INDEX = new Map<string, CampusProfile>();

function normalizeKey(name: string): string {
  return normalizeSchoolNameInput(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

for (const row of profileMap as CampusProfile[]) {
  const keys = new Set<string>([normalizeKey(row.school)]);
  for (const alias of row.aliases ?? []) keys.add(normalizeKey(alias));
  for (const k of keys) {
    if (k) INDEX.set(k, row);
  }
}

export function resolveSchoolCampusProfile(schoolName: string): CampusProfile | null {
  for (const variant of schoolNameLookupVariants(schoolName)) {
    const hit = INDEX.get(normalizeKey(variant));
    if (hit) return hit;
  }
  return INDEX.get(normalizeKey(schoolName)) ?? null;
}

export type { CampusProfile };
