import type { Locale } from "../i18n/strings";

export type GapTaskMeta = {
  id: string;
  title: string;
  rawLine: string;
  whyNeeded: string;
  impactIfMissing: string;
};

type Rule = {
  test: (s: string) => boolean;
  zh: { title: string; why: string; impact: string };
  en: { title: string; why: string; impact: string };
};

const RULES: Rule[] = [
  {
    test: (s) => /SAT|ACT|标化|分数|托福|TOEFL|雅思|IELTS|测试成绩|test score/i.test(s),
    zh: {
      title: "标化成绩",
      why: "标化策略与分数决定招生官如何把你放进成绩区间与奖学金/奖助评估的参考带里。",
      impact: "缺失时，冲/稳/保更容易拍脑袋：同一 GPA 下，是否提交分数、分数高低会显著改变名单与风险提示的可靠度。",
    },
    en: {
      title: "Test scores",
      why: "Testing policy and scores anchor how admissions may bucket you academically and how aid merit screens are interpreted.",
      impact: "Without it, Reach/Match/Safety and risk notes are more generic—submit vs hide and score bands materially change the list.",
    },
  },
  {
    test: (s) => /GPA|绩点|成绩区间|未加权|加权|成绩单/i.test(s),
    zh: {
      title: "GPA 与课程体系",
      why: "不同课程体系（美高 / IB / A-Level / 国内体系）下，GPA 口径不同；顾问需要用它对齐录取画像与学校区间。",
      impact: "不补充时，档位边界会变模糊：同一活动叙事下，学校匹配度可能被高估或低估。",
    },
    en: {
      title: "GPA & curriculum",
      why: "Curriculum context matters—unweighted/weighted scales differ, and that changes how competitive bands are read.",
      impact: "Without it, tier boundaries get fuzzy and fit signals may be overstated or understated.",
    },
  },
  {
    test: (s) => /专业|major|意向|方向|转专业/i.test(s),
    zh: {
      title: "专业意向",
      why: "专业决定院系资源、先修课、作品集/补充材料与不同学校的强弱项对照方式。",
      impact: "不补充时，名单更偏综合大学泛匹配，对理工/艺术/商科等特色路径的针对性会下降。",
    },
    en: {
      title: "Major intent",
      why: "Major drives departmental fit, prerequisites, and whether certain schools are realistic anchors.",
      impact: "Without it, the list skews more generic and may miss major-specific constraints.",
    },
  },
  {
    test: (s) => /活动|奖项|科研|竞赛|志愿|领导力|简历|经历/i.test(s),
    zh: {
      title: "活动与奖项",
      why: "活动叙事用来解释为什么这所学校在某一档：把抽象偏好变成可核对的个人证据链。",
      impact: "不补充时，理由更像模板句，难以判断你是否需要补强故事线或调整冲校激进程度。",
    },
    en: {
      title: "Activities & honors",
      why: "Activities explain “why this school, why this tier” beyond stats—evidence for fit and risk tradeoffs.",
      impact: "Without it, rationales read more templated and aggressiveness of Reach may be mis-calibrated.",
    },
  },
  {
    test: (s) => /预算|学费|助学金|奖学金|经济|全自费|need|aid|financial/i.test(s),
    zh: {
      title: "预算与经济约束",
      why: "国际生奖助政策差异极大；预算决定哪些学校从匹配变成风险项或反之。",
      impact: "不补充时，财务相关风险会被弱化，可能低估读得起/奖助难带来的选校约束。",
    },
    en: {
      title: "Budget & aid posture",
      why: "Aid policies differ sharply by school and profile; budget changes which schools are true matches vs risks.",
      impact: "Without it, financial risks are under-specified and the list may look safer than reality.",
    },
  },
  {
    test: (s) => /身份|国际生|绿卡|美籍|签证|intl|citizen/i.test(s),
    zh: {
      title: "申请身份",
      why: "身份影响国际生名额池、奖助可得性、以及部分公立体系的录取逻辑。",
      impact: "不补充时，对公立/私立与国际生政策的提醒可能不够落到你身上。",
    },
    en: {
      title: "Applicant identity",
      why: "Identity changes intl pools, aid eligibility, and some public-system dynamics.",
      impact: "Without it, policy callouts may not map cleanly to your actual constraints.",
    },
  },
  {
    test: (s) => /推荐信|文书|主文书|补充文书|portfolio|作品集/i.test(s),
    zh: {
      title: "材料与叙事准备度",
      why: "材料进度决定你能否在关键轮次把故事讲完整，也会影响是否该把某些冲校后移。",
      impact: "不补充时，时间线类建议会偏保守或偏乐观，缺少与你真实进度的对齐。",
    },
    en: {
      title: "Materials readiness",
      why: "Essays/rec letters/portfolios affect timeline realism and whether some Reach schools are timely.",
      impact: "Without it, timeline guidance may misalign with your actual bottlenecks.",
    },
  },
  {
    test: (s) => /面试|校友面试|initialview/i.test(s),
    zh: {
      title: "面试与展示环节",
      why: "部分学校/项目把面试作为信号；是否准备充分会影响可冲性与风险描述。",
      impact: "不补充时，对需要强展示环节的学校，风险提示可能不完整。",
    },
    en: {
      title: "Interviews",
      why: "Some schools weight interviews heavily; readiness changes Reach realism.",
      impact: "Without it, interview-heavy programs may be under-risked.",
    },
  },
  {
    test: (s) => /夏校|科研|实习|项目经历/i.test(s),
    zh: {
      title: "项目经历（夏校/科研/实习）",
      why: "项目经历常用来对齐学术兴趣证据与特定院系的偏好信号。",
      impact: "不补充时，对偏研究/职业导向项目的匹配判断会偏弱。",
    },
    en: {
      title: "Programs (summer/research/internship)",
      why: "Structured programs provide evidence for academic interest and certain college-specific fits.",
      impact: "Without it, research/professional tracks may be under-fit.",
    },
  },
  {
    test: (s) => /选校名单|list|学校名单|范围|数量/i.test(s),
    zh: {
      title: "选校范围与偏好",
      why: "明确范围能减少重复类型学校与地理/规模偏好冲突导致的无效扩张。",
      impact: "不补充时，更容易出现看起来多但不互补的名单结构风险。",
    },
    en: {
      title: "List scope & preferences",
      why: "Clear scope reduces redundant archetypes and conflicting geo/size preferences.",
      impact: "Without it, portfolios may look broad but not complementary.",
    },
  },
  {
    test: (s) => /家长|顾问|家庭|期望|分歧/i.test(s),
    zh: {
      title: "家庭/顾问协同",
      why: "决策链上的约束（预算拍板人、风险偏好）会改变可执行策略而不是纸面名单。",
      impact: "不补充时，行动表可能对谁能拍板假设过多，落地性下降。",
    },
    en: {
      title: "Family / counselor alignment",
      why: "Decision-makers change what’s executable—not just what’s desirable on paper.",
      impact: "Without it, action items may assume buy-in that isn’t there yet.",
    },
  },
];

function fallbackTitle(raw: string, index: number, locale: Locale): string {
  const t = raw.trim();
  const cut = t.split(/[：:—\-–]/)[0]?.trim() || t;
  const short = cut.length > 36 ? `${cut.slice(0, 34)}…` : cut;
  if (short.length >= 4) return short;
  return locale === "zh" ? `补全项 ${index + 1}` : `Item ${index + 1}`;
}

export function stableGapsSignature(gaps: string[]): string {
  const s = gaps.join("\u0000");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function buildGapTask(rawLine: string, index: number, locale: Locale): GapTaskMeta {
  const raw = rawLine.trim();
  const id = `${index}_${stableGapsSignature([raw])}`;
  const pack = locale === "en" ? "en" : "zh";

  for (const rule of RULES) {
    if (rule.test(raw)) {
      const m = rule[pack];
      return { id, title: m.title, rawLine: raw, whyNeeded: m.why, impactIfMissing: m.impact };
    }
  }

  const title = fallbackTitle(raw, index, locale);
  if (locale === "en") {
    return {
      id,
      title,
      rawLine: raw,
      whyNeeded:
        "This item came from your report’s gap list—the model flagged it because it changes how confidently we can tailor tiers, risks, and verification priorities.",
      impactIfMissing:
        "If you skip it, the strategy stays readable but less anchored to your real constraints; Reach/Match/Safety tradeoffs may be less precise.",
    };
  }
  return {
    id,
    title,
    rawLine: raw,
    whyNeeded:
      "这条来自模型在报告里标注的信息缺口：它通常会影响档位划分、风险强弱或官网核对重点的排序。",
    impactIfMissing:
      "若不补充，报告仍可读，但对你的真实约束贴脸度会下降：冲/稳/保的边界与建议可能偏保守或偏乐观。",
  };
}

export function buildGapTasks(gaps: string[], locale: Locale): GapTaskMeta[] {
  return gaps.map((line, i) => buildGapTask(line, i, locale));
}
