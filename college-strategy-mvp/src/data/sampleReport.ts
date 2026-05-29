import type { Locale } from "../i18n/strings";
import type { FormState, ReportPayload } from "../types";

/** 产品介绍页样例问卷（脱敏） */
export function getSampleForm(locale: Locale): FormState {
  return {
    intakeTerm: locale === "en" ? "2026 Fall" : "2026 秋季",
    intakeOtherDetail: "",
    applicantIdentity: "intl",
    citizenship: locale === "en" ? "China" : "中国",
    residenceRegion: locale === "en" ? "East Asia" : "东亚",
    budget: "budget_cap",
    testing: "will_submit",
    satScore: "1480",
    actScore: "",
    highSchoolSystem: locale === "en" ? "International curriculum" : "国际课程",
    gpa: "3.85",
    gpaTrend: "upward",
    languageScores: locale === "en" ? "TOEFL 108" : "TOEFL 108",
    academicSpecialFlags: [],
    academicSpecialNotes: "",
    majorPrimary: locale === "en" ? "Computer Science" : "计算机科学",
    majorSecondary: "",
    schoolSize: "large",
    campusCulturePref: "balanced",
    geoPrefs: ["west"],
    activities: locale === "en" ? "CS club, regional hackathon" : "计算机社团、区域黑客松",
    structuredActivities: [],
    riskStyle: "balanced",
    dealbreakers: "",
  };
}

/** 脱敏样例报告：用于「产品介绍」页展示，非真实用户数据 */
export function getSampleReport(locale: Locale): ReportPayload {
  if (locale === "en") {
    return {
      executive_summary: [
        "Profile reads as a balanced STEM applicant with a clear CS thread; reach tier should stay realistic, not lottery-only.",
        "Budget and aid posture matter: several strong public options need merit or in-state logic checked early.",
        "Biggest gap: activity evidence is directionally right but needs one measurable outcome per anchor activity.",
      ],
      information_gaps: [
        "Confirm whether target majors are direct-admit or capacity-constrained (especially engineering/CS).",
        "Add GPA scale, trend, and core course rigor for academic review.",
      ],
      reach: [
        {
          school: "Sample University A (Reach)",
          why_reach_for_you:
            "Realistic stretch for CS: strong academics, but competition density is high and the major may be screened.",
          campus_vibe: "Research-heavy · large public with strong STEM labs and grad-school pipeline",
          differentiation: "Versus other reaches, this one offers more direct CS research access if you can show project depth.",
          context_note: "Confirm intl aid and direct-admit CS rules on the official CDS—do not rely on unsourced admit rates.",
          key_fit_signals: ["CS direction", "STEM coursework", "Balanced list posture"],
          key_risks: ["Major capacity constraints", "High competition density"],
          verification_focus: ["Direct-admit vs. pre-major", "International aid policy", "Application round"],
        },
      ],
      match: [
        {
          school: "Sample University B (Match)",
          why_match_for_you:
            "Main battlefield: profile aligns with mid-selective STEM publics; variance remains on essays and rigor narrative.",
          campus_vibe: "Balanced social-academic · flagship public with active clubs and regional recruiting",
          differentiation: "Compared with Match #2, stronger in-state/merit aid logic if your budget is capped.",
          context_note: "Check net price calculator for your residency status; merit rules change by cycle.",
          key_fit_signals: ["Regional fit", "CS + applied math thread"],
          key_risks: ["Essay specificity still thin"],
          verification_focus: ["College within university for CS", "Merit scholarship rules"],
        },
      ],
      safety: [
        {
          school: "Sample University C (Safety)",
          why_safety_for_you:
            "Floor logic: lowers all-reject risk while keeping CS/exploratory pathways open.",
          campus_vibe: "Teaching-focused · smaller classes, easier to stand out in activities",
          differentiation: "Unlike other safeties, keeps an exploratory CS/engineering path without ultra-selective screening.",
          context_note: "Still verify major availability and housing costs on the official site.",
          key_fit_signals: ["Higher admit bandwidth", "Clear CS pathway"],
          key_risks: ["Still verify major availability"],
          verification_focus: ["Net cost after aid", "Housing / campus fit"],
        },
      ],
      portfolio_risks: [
        {
          risk_title: "Aid vs. list mismatch",
          what_it_means_for_you:
            "If aid outcomes are weaker than expected, some match schools may become financially non-viable.",
          mitigation: "Keep at least one safety with transparent net-cost assumptions on the official site.",
        },
      ],
      improvement_plan: {
        this_week: ["Pick one activity and add a verifiable outcome (number, role, timeframe).", "Draft PIQ / essay spine in 3 bullets."],
        this_month: ["Confirm CS major policies for all match/reach schools.", "Align teacher/counselor materials with your activity thread."],
        before_submitting: ["Re-check every school's round, language score, and aid forms."],
        activity_build: [
          "Launch one CS-adjacent project with a public repo or demo you can link in activities.",
          "If contests fit your timeline: USACO bronze track or regional hackathon team role—not as a guarantee, but as verifiable depth.",
        ],
        priority_frame: "Near term: document outcomes; this year: deepen one thread; before applying: align list with aid and major policies.",
      },
      strategy_notes: [
        "Sample only — school names are illustrative.",
        "Do not treat SAT/ACT as a lever for UC campuses (test-blind).",
      ],
      uc_analysis: {
        overview:
          "You indicated West Coast / UC interest. Below is a sample campus portfolio — not a fixed “top 2 + middle 4 + bottom 3” template.",
        test_blind_note:
          "UC undergraduate admission is test-blind: SAT/ACT are not used in admission decisions.",
        application_note: "All UC campuses share one UC Application and four PIQs.",
        reach: [
          {
            school: "UC Berkeley (sample)",
            why_reach_for_you: "Reach for CS: extremely selective; fit must be argued with coursework and projects, not test scores.",
            key_fit_signals: ["CS direction"],
            key_risks: ["Capacity-constrained major"],
            verification_focus: ["College/major policy on official site"],
          },
        ],
        match: [
          {
            school: "UC San Diego (sample)",
            why_match_for_you: "More realistic STEM battlefield; pick the right college within UCSD.",
            key_fit_signals: ["STEM thread"],
            key_risks: ["College selection matters"],
            verification_focus: ["UCSD college mapping for CS"],
          },
        ],
        safety: [
          {
            school: "UC Riverside (sample)",
            why_safety_for_you: "Helps reduce all-UC-reject risk while staying related to STEM paths.",
            key_fit_signals: ["Portfolio coverage"],
            key_risks: ["Still selective"],
            verification_focus: ["Major availability"],
          },
        ],
        checklist: ["UC is test-blind — do not use SAT as a UC strategy lever.", "Plan four distinct PIQs."],
        piq_directions: ["PIQ 1: One scene that made CS specific to you.", "PIQ 2: Leadership with measurable impact."],
        information_gaps: ["List which UC campuses you are seriously considering."],
      },
    };
  }

  return {
    executive_summary: [
      "整体画像偏「平衡型 STEM」：计算机方向主线清楚，冲刺档应保留现实可解释空间，不宜堆彩票校。",
      "预算与奖助口径会显著影响最终能否入读，需在匹配/保底档提前核对净花费假设。",
      "当前最大信息缺口：活动有方向，但每条主线尚缺可核对的结果（数字、角色、时间范围）。",
    ],
    information_gaps: [
      "核对目标专业是否为 direct-admit / 名额受限（尤其工程、CS）。",
      "补全 GPA 口径、趋势与核心课强度，便于学术审核。",
    ],
    reach: [
      {
        school: "示例大学 A（冲刺）",
        why_reach_for_you:
          "作为 CS 方向的现实可冲：学术基础达标，但竞争密度高，且热门专业可能存在筛选。",
        campus_vibe: "研究导向 · 大型公立，STEM 实验室与升学通道强",
        differentiation: "与同档其它冲刺校相比，若你能展示项目深度，这所的研究资源更直接。",
        context_note: "国际生奖助与 CS 直录政策请以官网 CDS 核对，勿引用未注明来源的录取率。",
        key_fit_signals: ["CS 主线", "STEM 课程", "名单风格偏平衡"],
        key_risks: ["专业名额紧张", "竞争密度高"],
        verification_focus: ["是否 direct-admit", "国际生奖助政策", "申请轮次"],
      },
    ],
    match: [
      {
        school: "示例大学 B（匹配）",
        why_match_for_you:
          "主战场之一：与中等选择性公立 STEM 项目较匹配；方差主要在文书具体度与课程强度叙事。",
        campus_vibe: "学业与社交平衡 · 旗舰公立，社团活跃、区域招聘多",
        differentiation: "若预算有限，这所的州内/merit 逻辑通常比同档另一所更可核对。",
        context_note: "请用 net price calculator 按你的身份核对净花费；merit 规则每年可能调整。",
        key_fit_signals: ["地区偏好", "CS + 应用数学线索"],
        key_risks: ["文书仍偏泛"],
        verification_focus: ["校内学院/专业对应关系", "Merit 奖学金规则"],
      },
    ],
    safety: [
      {
        school: "示例大学 C（保底）",
        why_safety_for_you:
          "保底逻辑：降低全拒风险，同时仍保留 CS 或相关探索路径。",
        campus_vibe: "教学导向 · 班级规模较小，活动更容易做出可验证成果",
        differentiation: "与其它保底校相比，仍保留 CS/工程探索路径且筛选压力较低。",
        context_note: "仍需核对专业是否开放及住宿费用，以官网当年信息为准。",
        key_fit_signals: ["录取带宽相对更大", "CS 路径清晰"],
        key_risks: ["仍需核对专业是否开放"],
        verification_focus: ["奖助后净花费", "住宿与校园适配"],
      },
    ],
    portfolio_risks: [
      {
        risk_title: "名单与资助预期不一致",
        what_it_means_for_you: "若奖助弱于预期，部分匹配校可能在经济上不可行。",
        mitigation: "保底档至少保留一所净花费假设清晰、可在官网核对的学校。",
      },
    ],
    improvement_plan: {
      this_week: ["选一条活动补上可核对结果（数字、角色、时间）。", "用 3 条要点写出 PIQ/文书主线。"],
      this_month: ["逐校核对 CS 专业政策。", "让推荐/活动材料与主线一致。"],
      before_submitting: ["逐校复核轮次、语言成绩与奖助表格。"],
      activity_build: [
        "启动一个可公开链接的 CS 相关小项目（仓库/演示），作为活动可验证成果。",
        "若时间允许：USACO 青铜路线或区域 hackathon 团队角色——强调可验证深度，非录取保证。",
      ],
      priority_frame: "近期：补可核对成果；本学年：深化一条主线；申请年：对齐奖助与专业政策。",
    },
    strategy_notes: ["以下为脱敏样例，校名为示意。", "UC 校区录取不看 SAT/ACT（test-blind）。"],
    uc_analysis: {
      overview:
        "样例背景含西部/UC 意向。以下为示意性「校区组合」，不是固定的「前二 + 中间四 + 后三」模板。",
      test_blind_note: "加州大学（UC）本科录取为 test-blind：录取决定中不使用 SAT/ACT。",
      application_note: "所有 UC 校区共用一套 UC Application 与 4 篇 PIQ。",
      reach: [
        {
          school: "UC Berkeley（样例）",
          why_reach_for_you: "CS 方向冲刺：竞争极强；需用课程与项目证据支撑匹配，而非标化。",
          key_fit_signals: ["CS 方向"],
          key_risks: ["热门专业名额紧张"],
          verification_focus: ["官网专业/学院政策"],
        },
      ],
      match: [
        {
          school: "UC San Diego（样例）",
          why_match_for_you: "更现实的 STEM 主战场；需选对 UCSD 内学院。",
          key_fit_signals: ["STEM 主线"],
          key_risks: ["学院选择影响大"],
          verification_focus: ["UCSD 学院与专业对应"],
        },
      ],
      safety: [
        {
          school: "UC Riverside（样例）",
          why_safety_for_you: "有助于降低「UC 全军覆没」风险，仍与 STEM 相关。",
          key_fit_signals: ["组合覆盖面"],
          key_risks: ["仍有选择性"],
          verification_focus: ["专业是否开放"],
        },
      ],
      checklist: ["UC 不看 SAT/ACT，勿把提分当作冲 UC 策略。", "规划 4 篇互不重复的 PIQ。"],
      piq_directions: ["PIQ 1：一个让 CS 变得具体的场景。", "PIQ 2：一次有可核对结果的带头经历。"],
      information_gaps: ["写明你认真考虑的 UC 校区清单。"],
    },
  };
}
