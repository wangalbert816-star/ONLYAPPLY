import type { ActivityItem } from "../types";

const MAX_ACTIVITIES = 20;

export function activityHasDraftContent(item: ActivityItem): boolean {
  return [
    item.name,
    item.description,
    item.role,
    item.outcome,
    item.award,
    item.proof,
    item.grades,
    item.hours,
    item.kind,
    item.scope,
    item.majorRelated,
  ].some((v) => String(v || "").trim().length > 0);
}

/** Append imported rows to existing activities instead of replacing the list. */
export function mergeImportedActivities(
  existing: ActivityItem[],
  imported: ActivityItem[],
  createEmpty: () => ActivityItem,
): ActivityItem[] {
  const base = existing.filter(activityHasDraftContent);
  const toAdd = imported.map((item) => ({
    ...item,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  }));
  const merged = [...base, ...toAdd].slice(0, MAX_ACTIVITIES);
  return merged.length > 0 ? merged : [createEmpty()];
}
