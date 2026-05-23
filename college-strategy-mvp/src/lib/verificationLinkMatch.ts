import type { OfficialSchoolLink } from "./universityOfficialLinks";

const TOPIC_RULES: Array<{ id: string; patterns: RegExp[] }> = [
  { id: "cds", patterns: [/cds|common data set|录取数据|admit rate|acceptance rate|statistics|数据/i] },
  { id: "aid", patterns: [/financial aid|奖助|scholarship|merit|net price|fafsa|资助|费用/i] },
  { id: "majors", patterns: [/major|专业|direct.?admit|capacity|工程|engineering|\bcs\b|computer/i] },
  { id: "campus", patterns: [/campus life|学生生活|housing|住宿|campus/i] },
  { id: "applytexas", patterns: [/applytexas|德州申请/i] },
  { id: "ucapp", patterns: [/uc application|加州大学申请|apply\.universityofcalifornia/i] },
  { id: "adm", patterns: [/admission|招生|application requirement|申请要求|deadline|截止/i] },
];

/** 核对项 → 官方链接（第三期 #28） */
export function linkForVerificationItem(text: string, links: OfficialSchoolLink[]): OfficialSchoolLink | null {
  const t = text.trim();
  if (!t || links.length === 0) return null;
  for (const rule of TOPIC_RULES) {
    if (!rule.patterns.some((re) => re.test(t))) continue;
    const hit = links.find((l) => l.id === rule.id);
    if (hit) return hit;
  }
  return links.find((l) => l.id === "adm") ?? links[0] ?? null;
}
