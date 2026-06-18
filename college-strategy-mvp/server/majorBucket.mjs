/** Map questionnaire major text → guidance/engine bucket (shared; no engine imports). */

const MAJOR_BUCKET_PATTERNS = [
  ["cs", /computer science|\bcs\b|software|data science|artificial intelligence|\bai\b|computational|informatics/i],
  ["business", /business|entrepreneurship|finance|economics|accounting|marketing|management|\bmba\b/i],
  ["bio", /biology|\bbio\b|pre-?med|medicine|public health|biomedical|neuroscience|biochem/i],
  ["engineering", /engineering|mechanical|electrical|civil|aerospace|chemical eng|industrial eng/i],
  ["arts", /film|media studies|art\b|design|music|theater|architecture|fine arts|animation/i],
  ["social", /psychology|sociology|political|history|philosophy|anthropology|international relations/i],
  ["environmental", /environmental|sustainability|ecology|climate|earth science/i],
];

export function resolveMajorBucket(body) {
  const text = [body?.majorPrimary, body?.majorSecondary, ...(body?.tags ?? [])].filter(Boolean).join(" ");
  for (const [bucket, re] of MAJOR_BUCKET_PATTERNS) {
    if (re.test(text)) return bucket;
  }
  return "general";
}
