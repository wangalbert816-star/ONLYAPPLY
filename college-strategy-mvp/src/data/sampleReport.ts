import type { Locale } from "../i18n/strings";
import type { ReportPayload } from "../types";

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
