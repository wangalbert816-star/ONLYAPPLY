/** @typedef {{ id: string; majors: RegExp[]; labelZh: string; labelEn: string; competitionsZh: string[]; competitionsEn: string[]; projectsZh: string[]; projectsEn: string[]; avoidZh: string; avoidEn: string }} MajorGuide */

/** @type {MajorGuide[]} */
export const MAJOR_ACTIVITY_GUIDES = [
  {
    id: "cs_stem",
    majors: [/computer|cs\b|software|data sci|人工智能|计算机|软件|数据科学/i],
    labelZh: "计算机 / 数据",
    labelEn: "CS / data",
    competitionsZh: ["USACO / 编程竞赛（按当前水平选级）", "Kaggle / 数据类小项目（可公开 repo）", "校内外 hackathon（产出可演示作品）"],
    competitionsEn: ["USACO or graded coding contests", "Kaggle-style data project with public repo", "Hackathon with a demoable artifact"],
    projectsZh: ["GitHub 开源或课程外小工具", "为社团/本地组织做自动化或数据分析"],
    projectsEn: ["GitHub project beyond coursework", "Automation/analytics for a club or local org"],
    avoidZh: "不建议同时新启动 3+ 个无关竞赛；优先 1 条可验证技术主线。",
    avoidEn: "Avoid starting 3+ unrelated contests; prioritize one verifiable technical thread.",
  },
  {
    id: "engineering",
    majors: [/engineer|机械|电子|土木|化工|engineering/i],
    labelZh: "工程",
    labelEn: "Engineering",
    competitionsZh: ["FIRST / VEX / 机器人（若已有基础）", "Physics Bowl / Science Olympiad（按年级）"],
    competitionsEn: ["FIRST / VEX / robotics if already involved", "Physics Bowl or Science Olympiad by grade"],
    projectsZh: ["设计-制作-测试类项目（记录过程与数据）", "本地 maker / 实验室助理经历"],
    projectsEn: ["Design-build-test project with documented data", "Local maker lab or lab assistant role"],
    avoidZh: "无基础时勿堆叠多个硬件竞赛；先完成 1 个可展示原型。",
    avoidEn: "Without prior base, do not stack hardware contests—finish one demonstrable prototype first.",
  },
  {
    id: "business",
    majors: [/business|finance|account|marketing|经济|商|金融/i],
    labelZh: "商科 / 经济",
    labelEn: "Business / econ",
    competitionsZh: ["DECA / FBLA / 商业案例赛（校内选拔）", "投资/商赛类模拟（强调角色与结论）"],
    competitionsEn: ["DECA / FBLA / case competition via school", "Investment or business simulation with clear role"],
    projectsZh: ["量化社团成果（筹款额、参与人数、增长率）", "为本地组织做调研或运营改进"],
    projectsEn: ["Quantified club outcomes", "Research or ops improvement for a local org"],
    avoidZh: "避免空泛「创业想法」；每条须有可核对数字或第三方证明。",
    avoidEn: "Avoid vague startup ideas—each item needs verifiable numbers or third-party proof.",
  },
  {
    id: "entrepreneurship",
    majors: [/entrepreneur|创业|startup|founder/i],
    labelZh: "创业 / Entrepreneurship",
    labelEn: "Entrepreneurship",
    competitionsZh: ["Rotary / 商业 pitch 赛 / 校内创业赛（强调可展示成果）", "DECA / FBLA entrepreneurship 相关项目"],
    competitionsEn: ["Pitch competitions with demonstrable outcomes", "DECA / FBLA entrepreneurship-aligned projects"],
    projectsZh: ["可验证的 micro-startup 或 incubator 项目（用户数/营收/里程碑）", "将竞赛 pitch deck 整理为 portfolio"],
    projectsEn: ["Verifiable micro-startup or incubator project with metrics", "Portfolio of pitch decks from competitions"],
    avoidZh: "9 校勿全选综合名气私校；至少 1 所须因创业/商科项目资源入选（如 Babson 等创业导向校）。",
    avoidEn: "Do not fill all 9 slots with generic prestige schools; include at least one entrepreneurship-program fit (e.g. Babson).",
  },
  {
    id: "architecture_design",
    majors: [/architect|interior design|industrial design|graphic design|fashion|fine art|studio art|film production|建筑|设计|室内|服装|纯艺|艺术/i],
    labelZh: "建筑 / 设计 / 作品集",
    labelEn: "Architecture / design / portfolio",
    competitionsZh: ["Scholastic Art / 区域艺术或建筑类竞赛", "AIA / 建筑或设计类青年项目（若有作品记录）", "校内外 studio 展览或 portfolio review"],
    competitionsEn: ["Scholastic Art or regional design/architecture awards", "AIA-style youth design project with documented work", "Studio show or portfolio review with archived work"],
    projectsZh: ["Portfolio 网站或公开作品集（3+ 件系列作品）", "Studio 项目记录：概念—制作—展示全链路"],
    projectsEn: ["Portfolio site or public collection (3+ piece series)", "Studio project log: concept → build → exhibit"],
    avoidZh: "9 校勿全是 US News 综合排名 flagship；至少 1–2 所须为作品集/studio 路径（如 RISD、Pratt、Syracuse Architecture、Virginia Tech architecture、SCAD 等）。",
    avoidEn: "Do not fill all 9 with generic prestige flagships; include 1–2 portfolio/studio paths (e.g. RISD, Pratt, Syracuse Architecture, Virginia Tech architecture, SCAD).",
  },
  {
    id: "environmental_policy",
    majors: [/environment|sustain|ecolog|climate|policy|public health|环科|环境|生态|气候|政策/i],
    labelZh: "环科 / 政策 / 公共",
    labelEn: "Environmental / policy / public",
    competitionsZh: ["Envirothon / 环境科学类竞赛（按现有基础）", "政策/调研类独立项目（可公开报告）"],
    competitionsEn: ["Envirothon or regional environmental science contest", "Policy/research project with a public write-up"],
    projectsZh: ["本地环境/政策调研（数据+结论）", "与社区组织合作的可持续项目（量化影响）"],
    projectsEn: ["Local environmental/policy research with data", "Community sustainability project with measured impact"],
    avoidZh: "Reach 三校须处于相近 selective band；勿把 USC 级与 regional public 混在同一 Reach 档。",
    avoidEn: "Keep all 3 Reach schools in a similar selectivity band; do not mix USC-tier with regional publics in Reach.",
  },
  {
    id: "humanities",
    majors: [/history|english|literature|philosophy|politic|law|journal|历史|英语|文学|哲学|政治|法律|新闻/i],
    labelZh: "人文 / 社科",
    labelEn: "Humanities / social sciences",
    competitionsZh: ["写作/辩论赛（校际或区域）", "Model UN（仅当与现有活动/专业一致）"],
    competitionsEn: ["Writing or debate at school/regional level", "Model UN only if aligned with existing thread"],
    projectsZh: ["深度社区叙事项目（持续 6+ 个月）", "校刊/媒体/播客持续产出（链接存档）"],
    projectsEn: ["Sustained community narrative project (6+ months)", "School media/podcast with archived links"],
    avoidZh: "不建议为了申请临时参加海外志愿；优先深化已有叙事。",
    avoidEn: "Skip last-minute abroad volunteering; deepen an existing narrative instead.",
  },
];

/** @param {string} majorPrimary @param {string} [majorSecondary] */
export function lookupMajorActivityGuide(majorPrimary, majorSecondary = "") {
  const blob = `${majorPrimary} ${majorSecondary}`.trim();
  if (!blob) return null;
  for (const guide of MAJOR_ACTIVITY_GUIDES) {
    if (guide.majors.some((re) => re.test(blob))) return guide;
  }
  return null;
}

/** @param {Record<string, unknown>} body @param {"zh"|"en"} locale */
export function formatMajorGuideForPrompt(body, locale) {
  const guide = lookupMajorActivityGuide(String(body.majorPrimary || ""), String(body.majorSecondary || ""));
  if (!guide) return "";
  const isEn = locale === "en";
  const label = isEn ? guide.labelEn : guide.labelZh;
  const comps = (isEn ? guide.competitionsEn : guide.competitionsZh).slice(0, 3);
  const projs = (isEn ? guide.projectsEn : guide.projectsZh).slice(0, 2);
  const avoid = isEn ? guide.avoidEn : guide.avoidZh;
  const header = isEn
    ? `\n\n[Curated major activity reference — ${label}; cite categories in activity_build/improvement_plan; do NOT promise outcomes]\n`
    : `\n\n【专业活动参考库 — ${label}；可在 activity_build/improvement_plan 引用类别；禁止承诺结果】\n`;
  const lines = [...comps, ...projs, avoid].map((x) => `- ${x}`).join("\n");
  return header + lines;
}

export const CURATED_OFFICIAL_LINK_SCHOOL_COUNT = 32;
