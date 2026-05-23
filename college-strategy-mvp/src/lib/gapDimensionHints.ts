import type { ProfileDimensionKey } from "./fiveDimensionProfile";
import type { Locale } from "../i18n/strings";

const RULES: { re: RegExp; key: ProfileDimensionKey }[] = [
  { re: /gpa|成绩|课程|选课|academic/i, key: "academic" },
  { re: /sat|act|标化|test|toefl|ielts|duolingo|语言/i, key: "testing" },
  { re: /活动|竞赛|实习|科研|activity|extracurricular/i, key: "activities" },
  { re: /文书|essay|piq|personal statement/i, key: "essays" },
  { re: /预算|奖助|aid|budget|名单|选校|strategy/i, key: "strategy" },
];

export function gapDimensionKey(gapText: string): ProfileDimensionKey | null {
  for (const rule of RULES) {
    if (rule.re.test(gapText)) return rule.key;
  }
  return null;
}

export function gapDimensionHint(gapText: string, locale: Locale): string | null {
  const key = gapDimensionKey(gapText);
  if (!key) return null;
  const zh: Record<ProfileDimensionKey, string> = {
    academic: "补全后通常有助于「学术」维度的判断更准确。",
    testing: "补全后通常有助于「标化」维度的判断更准确。",
    activities: "补全后通常有助于「活动」维度的判断与提升建议更具体。",
    essays: "补全后通常有助于「文书」维度的策略更贴合。",
    strategy: "补全后通常有助于「策略/名单」维度的风险判断更稳。",
  };
  const en: Record<ProfileDimensionKey, string> = {
    academic: "Filling this in usually sharpens the Academic dimension.",
    testing: "Filling this in usually sharpens the Testing dimension.",
    activities: "Filling this in usually sharpens Activities and concrete build suggestions.",
    essays: "Filling this in usually sharpens Essay strategy.",
    strategy: "Filling this in usually sharpens Strategy/list risk calls.",
  };
  return locale === "en" ? en[key] : zh[key];
}
