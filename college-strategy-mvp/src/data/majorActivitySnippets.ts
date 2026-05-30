import type { Locale } from "../i18n/strings";

export type MajorActivityGuide = {
  id: string;
  majors: RegExp[];
  labelZh: string;
  labelEn: string;
  competitionsZh: string[];
  competitionsEn: string[];
  projectsZh: string[];
  projectsEn: string[];
  avoidZh: string;
  avoidEn: string;
};

/** 专业 → 常见竞赛/项目类型（第三期 #59；供 prompt 与 UI 参考，非录取承诺） */
export const MAJOR_ACTIVITY_GUIDES: MajorActivityGuide[] = [
  {
    id: "cs_stem",
    majors: [/computer|cs\b|software|data sci|人工智能|计算机|软件|数据科学/i],
    labelZh: "计算机 / 数据",
    labelEn: "CS / data",
    competitionsZh: ["USACO / 编程竞赛（按当前水平选级）", "Kaggle / 数据类小项目（可公开 repo）", "校内外 hackathon（产出可演示作品）"],
    competitionsEn: ["USACO or graded coding contests", "Kaggle-style data project with public repo", "Hackathon with a demoable artifact"],
    projectsZh: ["GitHub 开源或课程外小工具", "为社团/本地组织做自动化或数据分析", "与现有活动挂钩的技术产出（角色+时长+链接）"],
    projectsEn: ["GitHub project or utility beyond coursework", "Automation/analytics for a club or local org", "Technical deliverable tied to an existing activity (role, hours, link)"],
    avoidZh: "不建议同时新启动 3+ 个无关竞赛；优先 1 条可验证技术主线。",
    avoidEn: "Avoid starting 3+ unrelated contests at once; prioritize one verifiable technical thread.",
  },
  {
    id: "engineering",
    majors: [/engineer|机械|电子|土木|化工|材料|航空航天|engineering/i],
    labelZh: "工程",
    labelEn: "Engineering",
    competitionsZh: ["FIRST / VEX / 机器人（若已有基础）", "Physics Bowl / Science Olympiad（按年级）", "校工程类社团项目赛"],
    competitionsEn: ["FIRST / VEX / robotics if already involved", "Physics Bowl or Science Olympiad by grade", "School engineering club competition project"],
    projectsZh: ["设计-制作-测试类项目（记录过程与数据）", "本地 maker / 实验室助理经历", "与物理/数学课程联动的工程笔记或原型"],
    projectsEn: ["Design-build-test project with documented data", "Local maker lab or lab assistant role", "Prototype linked to physics/math coursework"],
    avoidZh: "无基础时勿堆叠多个硬件竞赛；先完成 1 个可展示原型。",
    avoidEn: "Without prior base, do not stack hardware contests—finish one demonstrable prototype first.",
  },
  {
    id: "business",
    majors: [/business|finance|account|marketing|经济|商|金融|会计|市场/i],
    labelZh: "商科 / 经济",
    labelEn: "Business / econ",
    competitionsZh: ["DECA / FBLA / 商业案例赛（校内选拔）", "投资/商赛类模拟（强调角色与结论）", "小型创业或社团财务/运营项目"],
    competitionsEn: ["DECA / FBLA / case competition via school", "Investment or business simulation with clear role", "Small venture or club ops/finance project"],
    projectsZh: ["量化社团成果（筹款额、参与人数、增长率）", "为本地组织做调研或运营改进", "与主申专业相关的实习/影子经历（可验证）"],
    projectsEn: ["Quantified club outcomes (funds raised, growth)", "Research or ops improvement for a local org", "Major-linked internship or shadowing with verification"],
    avoidZh: "避免空泛创业想法；每条须有可核对数字或第三方证明。",
    avoidEn: "Avoid vague startup ideas—each item needs verifiable numbers or third-party proof.",
  },
  {
    id: "humanities",
    majors: [/history|english|literature|philosophy|politic|law|journal|历史|英语|文学|哲学|政治|法律|新闻/i],
    labelZh: "人文 / 社科",
    labelEn: "Humanities / social sciences",
    competitionsZh: ["写作/辩论赛（校际或区域）", "Model UN（仅当与现有活动/专业一致）", "历史/哲学/社科类论文或期刊投稿（校内亦可）"],
    competitionsEn: ["Writing or debate at school/regional level", "Model UN only if aligned with existing thread", "History/philosophy/social-science essay or journal submission"],
    projectsZh: ["深度社区叙事项目（持续 6+ 个月）", "独立研究或 oral history 小课题", "校刊/媒体/播客持续产出（链接存档）"],
    projectsEn: ["Sustained community narrative project (6+ months)", "Independent research or oral-history mini study", "School media/podcast with archived links"],
    avoidZh: "不建议为了申请临时参加海外志愿；优先深化已有叙事。",
    avoidEn: "Skip last-minute abroad volunteering; deepen an existing narrative instead.",
  },
  {
    id: "bio_premed",
    majors: [/biology|biomed|pre-?med|medic|nurs|chem|生物|医学|护理|化学|生化/i],
    labelZh: "生物 / 预医",
    labelEn: "Biology / pre-med",
    competitionsZh: ["USABO / Brain Bee（按基础选级）", "Science Olympiad 生物/化学项", "校科学社团实验或数据竞赛"],
    competitionsEn: ["USABO / Brain Bee by level", "Science Olympiad bio/chem events", "School science club experiment or data contest"],
    projectsZh: ["实验室助理或本地科研（小时+导师+产出）", "公共卫生/社区健康可量化项目", "与课程联动的独立实验记录"],
    projectsEn: ["Lab assistant or local research (hours, mentor, output)", "Public-health project with measurable impact", "Course-linked independent lab notebook"],
    avoidZh: "付费科研营需核对成本与可验证性；优先本地可持续经历。",
    avoidEn: "Paid research camps need cost/verification check—prefer local sustained experience.",
  },
  {
    id: "arts",
    majors: [/art|design|music|theater|film|dance|architect|艺术|设计|音乐|戏剧|电影|建筑/i],
    labelZh: "艺术 / 设计",
    labelEn: "Arts / design",
    competitionsZh: ["Scholastic Art / 区域艺术奖", "校际音乐/戏剧节（角色明确）", "设计类 hackathon 或 portfolio review"],
    competitionsEn: ["Scholastic Art or regional awards", "Music/theater festival with named role", "Design hackathon or portfolio review"],
    projectsZh: ["Portfolio 网站或公开作品集", "社区演出/展览（时间线+作品链接）", "与主申方向一致的系列创作（3+ 件）"],
    projectsEn: ["Portfolio site or public collection", "Community show/exhibit with timeline + links", "Series of 3+ works aligned to intended major"],
    avoidZh: "避免仅列兴趣爱好；须展示持续产出与外部反馈。",
    avoidEn: "Do not list hobbies only—show sustained output and external feedback.",
  },
];

export function lookupMajorActivityGuide(majorPrimary: string, majorSecondary = ""): MajorActivityGuide | null {
  const blob = `${majorPrimary} ${majorSecondary}`.trim();
  if (!blob) return null;
  for (const guide of MAJOR_ACTIVITY_GUIDES) {
    if (guide.majors.some((re) => re.test(blob))) return guide;
  }
  return null;
}

export function majorActivityHintBullets(majorPrimary: string, majorSecondary: string, locale: Locale): string[] {
  const guide = lookupMajorActivityGuide(majorPrimary, majorSecondary);
  if (!guide) return [];
  const comps = locale === "en" ? guide.competitionsEn : guide.competitionsZh;
  const projs = locale === "en" ? guide.projectsEn : guide.projectsZh;
  const avoid = locale === "en" ? guide.avoidEn : guide.avoidZh;
  const prefix = locale === "en" ? "Reference paths" : "参考方向";
  return [`${prefix}（${locale === "en" ? guide.labelEn : guide.labelZh}）`, ...comps.slice(0, 2), ...projs.slice(0, 1), avoid];
}
