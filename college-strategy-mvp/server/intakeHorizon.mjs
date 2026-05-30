/** @typedef {"urgent" | "mid" | "long" | "unknown"} IntakeHorizon */

import {
  assessActivityStrength,
  structuredActivityNameSummary,
} from "./activityEvidence.mjs";

const FALL_APP_SEASON_START_MONTH = 8;

export function parseIntakeEnrollmentYear(intake) {
  const m = String(intake || "").match(/\b(20\d{2})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 2020 && y <= 2040 ? y : null;
}

export function monthsUntilApplicationSeason(intake, now = new Date()) {
  const enrollYear = parseIntakeEnrollmentYear(intake);
  if (!enrollYear) return null;
  const seasonStart = new Date(enrollYear - 1, FALL_APP_SEASON_START_MONTH, 1);
  return (
    (seasonStart.getFullYear() - now.getFullYear()) * 12 + (seasonStart.getMonth() - now.getMonth())
  );
}

/** @returns {IntakeHorizon} */
export function getIntakeHorizon(intake, now = new Date()) {
  const months = monthsUntilApplicationSeason(intake, now);
  if (months === null) return "unknown";
  if (months <= 12) return "urgent";
  if (months <= 30) return "mid";
  return "long";
}

/** @param {IntakeHorizon} horizon @param {"zh"|"en"} locale */
export function improvementPlanUserContextLine(horizon, intakeTerm, locale) {
  const intake = String(intakeTerm || "").trim() || (locale === "en" ? "not provided" : "未填");
  const months = monthsUntilApplicationSeason(intake);
  const monthsStr = months === null ? "" : locale === "en" ? `~${months} months` : `约 ${months} 个月`;

  if (locale === "en") {
    if (horizon === "urgent") {
      return `[Planning horizon] Target intake: ${intake}. Application season is near (${monthsStr} to typical Sep–Jan cycle). improvement_plan must be an execution checklist (materials, testing, rec letters, verification)—use this_week / this_month / before_submitting in that sense.`;
    }
    if (horizon === "mid") {
      return `[Planning horizon] Target intake: ${intake}. Application season is ${monthsStr} away—use mid-term prep, NOT final submission week. Map JSON fields to: this_week = next 4–8 weeks; this_month = this school year; before_submitting = milestones in the year before application season. Do NOT assign final PS submission, payment, or deadline-week tasks to this_week.`;
    }
    if (horizon === "long") {
      return `[Planning horizon] Target intake: ${intake}. Application season is ${monthsStr} away—long-range planning only. Map JSON fields to: this_week = next 3–6 months (explore, foundations); this_month = within 1–2 years (activity spine, coursework); before_submitting = application-year milestones only (still not "submit this week"). Forbidden in improvement_plan: finalize personal statement, contact recommenders for deadlines, upload transcripts for submission, or other imminent-application tasks.`;
    }
    return `[Planning horizon] Target intake: ${intake}. Intake timing unclear—avoid imminent-application tasks unless user context clearly shows they are already in senior year / applying now.`;
  }

  if (horizon === "urgent") {
    return `【规划时间轴】目标入学季：${intake}。主申请窗口临近（距典型 9–1 月申请季约 ${monthsStr}）。improvement_plan 须为可立即执行清单（材料、标化、推荐信、官网核对等）；this_week / this_month / before_submitting 均按「临近申请」理解。`;
  }
  if (horizon === "mid") {
    return `【规划时间轴】目标入学季：${intake}。距主申请季约 ${monthsStr}——写中期准备，不要写「本周交申请」。JSON 语义：this_week=未来 4–8 周；this_month=本学期/本学年；before_submitting=申请季开始前一年内的里程碑。禁止把 PS 定稿、缴费、轮次截止周任务放进 this_week。`;
  }
  if (horizon === "long") {
    return `【规划时间轴】目标入学季：${intake}。距主申请季约 ${monthsStr}——仅写长线规划。JSON 语义：this_week=近 3–6 个月（探索与基础）；this_month=1–2 年内（活动主线、课程）；before_submitting=申请年当年重点（仍非「本周递交」）。improvement_plan 严禁：本周完成 PS、联系推荐人截止、上传成绩单递交、参加院校说明会赶截止等临近申请动作。`;
  }
  return `【规划时间轴】目标入学季：${intake}。入学时间不明确——除非问卷显示已在申请年级，否则避免写临近递交类任务。`;
}

const PERSONALIZATION_BLOCK_ZH = `
【improvement_plan · 必须个性化（禁止通用留学清单）】
- 每一条建议都要像「只写给这位学生」的顾问备忘：先点明依据（问卷里的专业/GPA/标化策略/预算/活动/地理偏好/底线/结构化活动/补充说明），再写具体动作。
- 全表（三段合计）至少 4 条明确引用问卷事实（可含原文关键词，如主申专业名、活动名、GPA 描述、标化选择）；至少 2 条在定稿 9 校名单后点名 1 所你推荐的学校并写清「要核对什么」（奖助、国际生政策、标化要求等）。
- 若 information_gaps 非空：至少 2 条 improvement_plan 要直接回应缺口（用「补齐…」的行动，不要重复成问句）。
- 若结构化活动为空或极短：必须有一条写「先定 1 条可验证的活动主线」并挂钩主申专业，禁止只写「列出所有活动」。
- 活动/竞赛/项目建议须服从下文「竞争力建设」规则（见用户消息中的活动证据厚度）。
- 若标化为 optional/不递交：不要安排「报名 SAT/ACT」除非用户已表示将考；若 will_submit 且填了分数，建议要围绕其分数与课程是否一致。
- 若预算为 need_aid / budget_cap：财力相关建议要体现资助/性价比，不要只写「准备财力证明模板」。
- 禁止无依据的套话（不得原样出现或同义照搬）：「列出所有课外活动和奖项，建立完整清单」「参加线上或线下院校说明会了解校园文化」「请老师或专业顾问审阅所有申请材料」「备份所有电子文件防止技术问题丢失」——除非加上该学生的专业/学校/缺口等限定语并说明为何现在做。
- 禁止 3 条以上连续使用相同句式开头；语气克制、可执行，每条尽量 ≤80 字。`;

const PERSONALIZATION_BLOCK_EN = `
【improvement_plan — must be personalized (no generic study-abroad checklist)】
- Every bullet is a counselor note for THIS student: cite a questionnaire fact (major, GPA notes, testing strategy, budget, activities, geography, dealbreakers, structured activities, supplementary notes), then the action.
- Across all three buckets: at least 4 bullets must quote concrete intake facts; at least 2 must name a school from your recommended list and what to verify (aid, intl policy, testing, etc.).
- If information_gaps is non-empty: at least 2 improvement_plan bullets must address gaps as actions (not repeat them as questions).
- If structured activities are empty or very thin: include one bullet to define one verifiable activity thread tied to the stated major—do not only say "list all activities."
- Activity/competition/project suggestions must follow the "competitiveness building" rules below (use activity-evidence thickness from the user message).
- If testing is optional / not submitting: do not schedule SAT/ACT signup unless the user plans to test; if scores are provided, align advice with score–transcript consistency.
- If budget is need_aid or budget_cap: aid/value must shape financial steps—not a generic "prepare financial statement template" alone.
- Forbidden generic copy (do not paste or paraphrase blindly): "list all extracurriculars and awards," "attend info sessions to learn campus culture," "have teachers review all materials," "back up all files"—unless tied to this student's major, schools, or gaps and why now.
- Do not start 3+ bullets in a row with the same opener; keep each bullet <= ~80 words, restrained and actionable.`;

/** @returns {"thin"|"moderate"|"strong"} — re-exported via activityEvidence.mjs */
export { assessActivityStrength };

/** @param {IntakeHorizon} horizon @param {"zh"|"en"} locale */
function activityCompetitivenessBlock(horizon, locale) {
  if (locale === "en") {
    const longMid =
      horizon === "long" || horizon === "mid"
        ? `- Across improvement_plan (all buckets): include at least 2 bullets on activities, competitions, or projects that build verifiable evidence for the stated major and your recommended school tiers—not a laundry list of famous contests.
- Each activity bullet must include: (1) type/path (e.g. deepen existing club, local research, skills-based project, appropriate academic competition), (2) measurable outcome (role, hours, artifact, award tier if any), (3) why it helps close a gap vs your Reach/Match schools (no "guaranteed admit").
- Match suggestions to primary major & HS system: STEM → project/research/coding artifact; Business → quantified leadership, case competition, small venture; Humanities → writing/debate/community narrative depth. Offer at most 1–2 named competition types only when grade/time/budget plausibly fit; otherwise describe the category.
- If activity evidence is thin: prioritize ONE spine (12–18 month depth) over joining many clubs; say what NOT to do (e.g. do not stack unrelated contests this semester).
- If activity evidence is strong: at least 1 bullet on how to present existing activities in the application; at most 1 optional stretch item tied to a named Reach school verification need.
- Budget need_aid/budget_cap: prefer low-cost, school-based, or merit-visible paths; flag paid programs only with cost awareness.
- Forbidden: generic "join Model UN / volunteer abroad / AMC" without linking to this student's major, existing activities, or a school on the list.`
        : "";
    const urgent = horizon === "urgent"
      ? `- Urgent cycle: do NOT recommend starting major new competitions unless activity evidence is thin AND grade/time still allows; otherwise focus on deepening, documenting, and aligning existing activities with essay/list narrative.
- If thin: max 1 new activity path with a 4–8 week starter step; if strong: 0 new contests, focus on Common App activity descriptions + recommender alignment.`
      : "";
    const unknown = horizon === "unknown" ? `- If activity thickness unknown: include 1–2 evidence-building bullets tied to major, avoid contest shopping lists.` : "";
    return `

【Competitiveness — activities & contests】${longMid}${urgent}${unknown}`;
  }

  const longMid =
    horizon === "long" || horizon === "mid"
      ? `
- 全表至少 2 条须为「活动/竞赛/项目」竞争力建设（挂钩主申专业 + 你推荐的冲/稳/保中至少一所学校的证据期待），禁止堆砌知名赛事名清单。
- 每条须含：①类型/路径（深化现有社团、本地科研、技能型项目、与年级匹配的学术竞赛等）②可验证产出（角色、时长、作品/数据、奖项层级如有）③为何有助于拉近与该校档位的证据差距（禁止「保证录取」）。
- 结合主申专业与高中体系给方向：理工→项目/科研/代码产出；商科→可量化领导、商赛/案例赛、小型创业；人文→写作/辩论/社区叙事深度。最多点名 1–2 类竞赛，且须说明年级/时间/预算是否现实；否则只写类别。
- 活动证据薄：优先 1 条主线（12–18 个月做深），并写明「不建议本学期再堆多个无关竞赛」；活动证据足：至少 1 条写如何把现有活动写进申请，新开竞赛最多 1 条且须挂钩某所 Reach 的核对项。
- 预算偏紧（need_aid/budget_cap）：优先校内、低成本、merit 可见路径；若提付费项目须点明成本考量。`
      : "";
  const urgent =
    horizon === "urgent"
      ? `
- 临近申请：除非活动证据薄且年级仍允许，否则不建议新启动大型竞赛；以深化、建档、与文书/名单叙事对齐为主。
- 证据薄：最多 1 条新活动路径 + 4–8 周可完成的第一步；证据足：不建议新竞赛，写活动描述、推荐人视角与材料一致性。`
      : "";
  const unknown =
    horizon === "unknown"
      ? `
- 活动厚度不明：至少 1–2 条证据建设建议，挂钩专业，避免竞赛导购清单。`
      : "";

  return `

【竞争力建设 · 活动/竞赛/项目】${longMid}${urgent}${unknown}`;
}

function personalizationPromptSuffix(locale, horizon) {
  const base = locale === "en" ? PERSONALIZATION_BLOCK_EN : PERSONALIZATION_BLOCK_ZH;
  return base + activityCompetitivenessBlock(horizon, locale);
}

/** @param {string} pref @param {"zh"|"en"} locale */
function campusCulturePrefShortLabel(pref, locale) {
  const key = String(pref || "").trim();
  if (!key) return "";
  const en = {
    academic: "Academic / research-oriented",
    balanced: "Balanced academic & social",
    social: "Active social / party-friendly",
    any: "No strong preference",
  };
  const zh = {
    academic: "学术 / 研究导向",
    balanced: "学业与社交平衡",
    social: "社交 / 派对氛围活跃",
    any: "没有强烈偏好",
  };
  const table = locale === "en" ? en : zh;
  return table[key] || key;
}

/** @param {Record<string, unknown>} body @param {"zh"|"en"} locale */
export function buildImprovementPersonalizationHints(body, locale) {
  const isEn = locale === "en";
  const na = isEn ? "(not provided)" : "（未提供）";
  const lines = [];

  const push = (label, val) => {
    const s = String(val ?? "").trim();
    if (s) lines.push(`${label}${s}`);
  };

  push(isEn ? "- Primary major: " : "- 主申专业：", body.majorPrimary);
  push(isEn ? "- Alternate major: " : "- 备选专业：", body.majorSecondary);
  push(isEn ? "- GPA / transcript: " : "- GPA/成绩：", body.gpa);
  push(isEn ? "- GPA trend: " : "- GPA 趋势：", body.gpaTrend);
  push(isEn ? "- Language scores: " : "- 语言成绩：", body.languageScores);
  {
    const flags = Array.isArray(body?.academicSpecialFlags) ? body.academicSpecialFlags.filter(Boolean) : [];
    const notes = String(body?.academicSpecialNotes || "").trim();
    const specialParts = [...flags];
    if (notes) specialParts.push(notes);
    push(isEn ? "- Transcript special notes: " : "- 学业特殊情况：", specialParts.join("; "));
  }
  push(isEn ? "- Testing strategy: " : "- 标化策略：", body.testing);
  if (body.testing === "will_submit") {
    push("SAT: ", body.satScore);
    push("ACT: ", body.actScore);
  }
  push(isEn ? "- Budget posture: " : "- 预算/经济：", body.budget);
  push(isEn ? "- HS system: " : "- 高中体系：", body.highSchoolSystem);
  push(isEn ? "- Current high school: " : "- 就读学校：", body.currentHighSchool);
  const actNames = structuredActivityNameSummary(body, 4);
  if (actNames.length) {
    push(
      isEn ? "- Structured activities (names): " : "- 结构化活动（名称）：",
      actNames.join(isEn ? "; " : "；"),
    );
  }
  push(isEn ? "- List posture: " : "- 选校风格：", body.riskStyle);
  push(isEn ? "- Dealbreakers: " : "- 底线：", body.dealbreakers);
  push(isEn ? "- Campus community vibe: " : "- 社区气质偏好：", campusCulturePrefShortLabel(String(body.campusCulturePref || ""), locale));
  const geo = Array.isArray(body.geoPrefs) ? body.geoPrefs.join(isEn ? ", " : "、") : body.geoPrefs;
  push(isEn ? "- Geography prefs: " : "- 地理偏好：", geo);

  const supp = Array.isArray(body.supplementary_notes) ? body.supplementary_notes : [];
  if (supp.length) {
    const suppLine = supp
      .slice(0, 3)
      .map((x) => (x && typeof x === "object" ? `【${x.topic}】${String(x.text || "").slice(0, 120)}` : ""))
      .filter(Boolean)
      .join(isEn ? " | " : " ");
    push(isEn ? "- Confirmed supplementary notes: " : "- 已确认补充说明：", suppLine);
  }

  const strength = assessActivityStrength(body);
  const strengthGuide = isEn
    ? {
        thin: "thin — include ≥2 activity/competition/project bullets (build ONE major-linked spine; see competitiveness rules).",
        moderate:
          "moderate — include ≥1 deepen-existing bullet + optionally 1 targeted new path (category or 1 contest type max).",
        strong:
          "strong — include ≥1 bullet on packaging existing activities; at most 1 optional stretch; avoid new contest shopping.",
      }
    : {
        thin: "薄 — improvement_plan 中至少 2 条活动/竞赛/项目建议（先定 1 条与主申专业挂钩的主线，见竞争力建设规则）。",
        moderate:
          "中等 — 至少 1 条深化现有活动 + 可选 1 条针对性补强（最多点名 1 类竞赛或项目形态）。",
        strong:
          "较足 — 至少 1 条写如何呈现现有活动；最多 1 条可选拉伸项；避免竞赛导购。",
      };
  lines.push(
    (isEn ? "- Activity evidence thickness (system): " : "- 活动证据厚度（系统判断）：") + strengthGuide[strength],
  );

  const major = String(body.majorPrimary || "").trim();
  if (major) {
    lines.push(
      isEn
        ? `- Major-linked activity lens: tailor contest/project TYPES to "${major}" (not generic clubs).`
        : `- 专业挂钩：活动/竞赛建议须围绕主申「${major}」选类型，避免与专业无关的堆叠。`,
    );
  }

  if (!lines.length) return "";

  const header = isEn
    ? "\n\n[Personalization anchors — improvement_plan must use at least 4 of these facts, not generic checklists]\n"
    : "\n\n【improvement_plan 个性化锚点 — 至少引用其中 4 处事实，禁止写成通用清单】\n";
  return header + lines.join("\n");
}

/** @param {IntakeHorizon} horizon @param {"zh"|"en"} locale */
export function improvementPlanPromptBlock(horizon, locale) {
  if (locale === "en") {
    if (horizon === "urgent") {
      return `

【improvement_plan — urgent cycle】
- JSON keys remain this_week, this_month, before_submitting (3–5 / 4–7 / 4–7 items).
- User is within ~12 months of the main application window: focus on executable tasks (testing, activities list, rec timeline, essay drafting, financial docs, official-site checks).
- before_submitting = final submission-phase checks only when appropriate.${personalizationPromptSuffix(locale, horizon)}`;
    }
    if (horizon === "mid") {
      return `

【improvement_plan — mid-term (NOT submission sprint)】
- Keep JSON keys this_week, this_month, before_submitting but change meaning:
  - this_week: doable in the next 4–8 weeks (concrete, small steps).
  - this_month: this school year (course rigor, one activity depth, summer planning).
  - before_submitting: milestones in the year before application season (testing plan, activity narrative, school list research)—NOT "submit application this month."
- Do NOT include: finalize PS, pay application fees, deadline-week uploads, or "confirm all deadlines this week" unless user is clearly already in application year.${personalizationPromptSuffix(locale, horizon)}`;
    }
    if (horizon === "long") {
      return `

【improvement_plan — long-range】
- Keep JSON keys this_week, this_month, before_submitting but change meaning:
  - this_week: next 3–6 months (major exploration, baseline activities, reading/list building).
  - this_month: within 1–2 years (sustained activity spine, GPA/course strategy, early testing plan).
  - before_submitting: application-year focus only (essay themes, school list refinement)—still not immediate submission tasks.
- FORBIDDEN: complete personal statement, request rec letters for imminent deadlines, submit financial statements, backup all application PDFs for upload, or any task implying applications are due soon.${personalizationPromptSuffix(locale, horizon)}`;
    }
    return `

【improvement_plan — intake unclear】
- Avoid imminent-application tasks unless questionnaire clearly shows senior/application year.
- Prefer exploratory and buildable steps in all three buckets.${personalizationPromptSuffix(locale, horizon)}`;
  }

  if (horizon === "urgent") {
    return `

【improvement_plan · 临近申请】
- JSON 键名仍为 this_week、this_month、before_submitting（条数 3–5 / 4–7 / 4–7）。
- 用户距主申请季约 12 个月内：写可立即执行项（标化、活动清单、推荐信节奏、文书起草、财务材料、官网核对）。
- before_submitting 仅在合适时写递交前核对项。${personalizationPromptSuffix(locale, horizon)}`;
  }
  if (horizon === "mid") {
    return `

【improvement_plan · 中期准备（非递交冲刺）】
- 键名不变，语义调整为：
  - this_week：未来 4–8 周可完成的具体小步；
  - this_month：本学期/本学年（课程、活动深化、暑期规划）；
  - before_submitting：申请季开始前一年内的里程碑（标化规划、活动叙事、选校调研）——禁止写「本月递交申请」。
- 禁止：PS 定稿、缴费、截止周上传、除非用户明显已在申请年级。${personalizationPromptSuffix(locale, horizon)}`;
  }
  if (horizon === "long") {
    return `

【improvement_plan · 长线规划】
- 键名不变，语义调整为：
  - this_week：近 3–6 个月（专业/方向探索、活动打底、阅读与信息收集）；
  - this_month：1–2 年内（活动主线、GPA/选课策略、标化早期规划）；
  - before_submitting：申请年当年重点（文书主题、名单收敛）——仍非「本周递交」。
- 严禁：本周完成 PS、联系推荐人赶截止、上传成绩单递交、备份申请 PDF、参加说明会赶轮次等临近申请表述。${personalizationPromptSuffix(locale, horizon)}`;
  }
  return `

【improvement_plan · 入学季不明确】
- 除非问卷显示已在申请年级，否则避免临近递交类任务；三段均偏探索与可积累事项。${personalizationPromptSuffix(locale, horizon)}`;
}
