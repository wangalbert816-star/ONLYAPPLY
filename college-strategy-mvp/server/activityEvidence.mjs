/** Structured activity evidence only — legacy free-text `activities` is ignored. */

export function meaningfulStructuredActivities(body) {
  const structured = Array.isArray(body?.structuredActivities) ? body.structuredActivities : [];
  return structured.filter((item) => {
    if (!item || typeof item !== "object") return false;
    return [item.name, item.role, item.description, item.outcome, item.award, item.proof].some(
      (value) => String(value ?? "").trim().length > 0,
    );
  });
}

export function isActivityThinFromBody(body) {
  const items = meaningfulStructuredActivities(body);
  const rich = items.filter((item) => {
    const name = String(item.name || "").trim();
    const desc = String(item.description || "").trim();
    return name.length > 0 && desc.length >= 20;
  });
  if (rich.length >= 1) return false;

  const named = items.filter((item) => String(item.name || "").trim().length > 0);
  const withDetail = named.filter(
    (item) => String(item.description || item.outcome || item.role || "").trim().length >= 12,
  );
  return withDetail.length < 2;
}

/** @returns {"thin"|"moderate"|"strong"} */
export function assessActivityStrength(body) {
  const items = meaningfulStructuredActivities(body);
  const named = items.filter((a) => String(a.name || "").trim()).length;
  const richStructured = items.filter(
    (a) => String(a.description || a.outcome || "").trim().length > 20,
  ).length;
  if (named === 0) return "thin";
  if (named < 2 && richStructured === 0) return "moderate";
  if (richStructured >= 2 || (named >= 2 && richStructured >= 1)) return "strong";
  return "moderate";
}

export function structuredActivityBlob(body) {
  return meaningfulStructuredActivities(body)
    .map((item) =>
      [item.name, item.description, item.outcome, item.award, item.role, item.proof]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
}

export function structuredActivityNameSummary(body, max = 3) {
  return meaningfulStructuredActivities(body)
    .map((a) => String(a.name || "").trim())
    .filter(Boolean)
    .slice(0, max);
}
