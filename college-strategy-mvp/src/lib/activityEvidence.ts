import type { ActivityItem, FormState } from "../types";

export function meaningfulStructuredActivities(form: FormState): ActivityItem[] {
  return (form.structuredActivities ?? []).filter((item) =>
    [item.name, item.role, item.description, item.outcome, item.award, item.proof].some((value) => value.trim().length > 0),
  );
}

export function hasStructuredActivities(form: FormState): boolean {
  return meaningfulStructuredActivities(form).length > 0;
}

export function isActivityThinFromForm(form: FormState): boolean {
  const items = meaningfulStructuredActivities(form);
  const rich = items.filter((item) => item.name.trim().length > 0 && item.description.trim().length >= 20);
  if (rich.length >= 1) return false;

  const named = items.filter((item) => item.name.trim().length > 0);
  const withDetail = named.filter(
    (item) => (item.description || item.outcome || item.role).trim().length >= 12,
  );
  return withDetail.length < 2;
}

export function structuredActivityBlob(form: FormState): string {
  return meaningfulStructuredActivities(form)
    .map((item) =>
      [item.name, item.description, item.outcome, item.award, item.role, item.proof]
        .filter((value) => value.trim().length > 0)
        .join(" "),
    )
    .join(" ");
}

export function formatStructuredActivitiesSummary(form: FormState, max = 3): string {
  return meaningfulStructuredActivities(form)
    .map((item) => item.name.trim())
    .filter(Boolean)
    .slice(0, max)
    .join(" · ");
}
