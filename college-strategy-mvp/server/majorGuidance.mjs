/** Parse Major Guidance column and apply questionnaire-aligned rules. */

const GUIDANCE_BUCKETS = new Set(["cs", "business", "engineering", "bio", "default"]);

export function guidanceBucketKey(majorBucket) {
  const key = String(majorBucket ?? "default").toLowerCase();
  if (GUIDANCE_BUCKETS.has(key)) return key;
  return "default";
}

export function normalizeStatsRegion(raw) {
  const g = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!g) return null;
  if (g === "great_lakes") return "great_lakes";
  if (g === "east" || g === "west" || g === "south" || g === "midwest") return g;
  return g;
}

export function parseMajorGuidance(raw) {
  const text = String(raw ?? "").trim();
  if (!text || /^overall pool only$/i.test(text)) {
    return { overallPoolOnly: true, segments: {} };
  }

  const segments = {};
  for (const part of text.split(";")) {
    const trimmed = part.trim();
    const m = trimmed.match(/^([a-z]+)\s*:\s*(.+)$/i);
    if (!m) continue;
    const bucket = m[1].toLowerCase();
    const body = m[2].trim();
    const lower = body.toLowerCase();
    segments[bucket] = {
      selective: /\bselective\b/.test(lower),
      direct: /\bdirect\b/.test(lower),
      strong: /\bstrong\b/.test(lower),
      indirect: /\bindirect\b/.test(lower),
      intlLimited: /\bintl-limited\b/.test(lower),
      extra: /extra:\s*(.+)/i.exec(body)?.[1]?.trim() ?? null,
      raw: body,
    };
  }

  return { overallPoolOnly: Object.keys(segments).length === 0, segments };
}

export function getMajorGuidanceSegment(guidance, majorBucket) {
  if (!guidance || guidance.overallPoolOnly) return null;
  const key = guidanceBucketKey(majorBucket);
  return guidance.segments[key] ?? null;
}

function bumpTierConservative(tier) {
  if (tier === "safety") return "match";
  if (tier === "match") return "reach";
  return tier;
}

/**
 * Apply major guidance for the student's primary major bucket (answer 1C / 3).
 * selective → tier bump; intl-limited → slight gap for intl; indirect/direct/strong → flags only here.
 */
export function applyMajorGuidanceToStatsGap(statsGap, statsEntry, student, majorBucket) {
  if (!statsGap || !statsEntry) return statsGap;

  const guidance = statsEntry.majorGuidanceParsed ?? parseMajorGuidance(statsEntry.majorGuidance);
  const seg = getMajorGuidanceSegment(guidance, majorBucket);
  if (!seg) return statsGap;

  let engineGap = statsGap.engineGap;
  let effectiveTier = statsGap.effectiveTier ?? statsGap.suggestedTier;
  let suggestedTier = statsGap.suggestedTier;
  const flags = [...(statsGap.flags ?? [])];

  if (seg.selective) {
    flags.push("major_selective");
    engineGap += 7;
    effectiveTier = bumpTierConservative(effectiveTier);
    suggestedTier = bumpTierConservative(suggestedTier);
  }

  if (seg.intlLimited && student.intl) {
    flags.push("major_intl_limited");
    engineGap += 4;
    if (!seg.selective && engineGap >= 11) {
      effectiveTier = bumpTierConservative(effectiveTier);
    }
  }

  if (seg.indirect) flags.push("major_indirect");
  if (seg.direct) flags.push("major_direct");
  if (seg.strong) flags.push("major_strong");
  if (seg.extra) flags.push("major_extra_requirement");

  return {
    ...statsGap,
    engineGap: Math.round(engineGap * 10) / 10,
    effectiveTier,
    suggestedTier,
    flags,
    majorGuidanceSegment: seg,
  };
}

/** Ranking-only adjustments (answer 1C / 2): direct+strong boost; indirect deprioritize. */
export function majorGuidanceRankAdjust(statsEntry, majorBucket) {
  if (!statsEntry) return 0;
  const guidance =
    statsEntry.majorGuidanceParsed ??
    parseMajorGuidance(statsEntry.majorGuidance ?? "");
  const seg = getMajorGuidanceSegment(guidance, majorBucket);
  if (!seg) return 0;

  let adjust = 0;
  if (seg.direct) adjust += 8;
  if (seg.strong) adjust += 10;
  if (seg.indirect) adjust -= 14;
  return adjust;
}

export function majorGuidancePromptNote(statsEntry, majorBucket, locale = "zh") {
  const isEn = locale === "en";
  const guidance = statsEntry?.majorGuidanceParsed ?? parseMajorGuidance(statsEntry?.majorGuidance);
  const seg = getMajorGuidanceSegment(guidance, majorBucket);
  if (!seg) {
    if (guidance?.overallPoolOnly) {
      return isEn ? "overall applicant pool — no major-specific selective path published" : "全校统一池 — 无专业级 selective 差异";
    }
    return null;
  }

  const bits = [];
  if (seg.selective) bits.push(isEn ? "selective major" : "selective 专业");
  if (seg.direct) bits.push(isEn ? "direct entry" : "可直申");
  if (seg.indirect) bits.push(isEn ? "indirect path only" : "仅 indirect 路径");
  if (seg.strong) bits.push(isEn ? "strong program" : "专业强校");
  if (seg.intlLimited) bits.push(isEn ? "slightly tighter for intl" : "国际生略更严");
  if (seg.extra) bits.push(isEn ? `extra: ${seg.extra}` : `额外要求：${seg.extra}`);
  return bits.join("; ") || null;
}
