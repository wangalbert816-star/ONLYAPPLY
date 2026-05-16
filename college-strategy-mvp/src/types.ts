export type ApplicantIdentity = "intl" | "us_citizen" | "other";
export type Budget = "full_pay" | "need_aid" | "unsure";
export type Testing = "test_optional" | "will_submit";
export type SchoolSize = "small" | "medium" | "large" | "any";
export type RiskStyle = "conservative" | "balanced" | "aggressive";

export type GeoPref =
  | "west"
  | "east"
  | "south"
  | "midwest"
  | "great_lakes"
  | "any";

export interface FormState {
  intakeTerm: string;
  /** 当 intakeTerm 为「其他」时，由用户自行填写的入学季说明 */
  intakeOtherDetail: string;
  applicantIdentity: ApplicantIdentity | "";
  /** 可选：仅用于申请环境/竞争密度判断，不作为报告中的直接标签 */
  citizenship: string;
  /** 可选：常驻地区/主要受教育地区，用于判断申请群体竞争密度 */
  residenceRegion: string;
  budget: Budget | "";
  testing: Testing | "";
  satScore: string;
  actScore: string;
  highSchoolSystem: string;
  gpa: string;
  majorPrimary: string;
  majorSecondary: string;
  schoolSize: SchoolSize | "";
  geoPrefs: GeoPref[];
  activities: string;
  riskStyle: RiskStyle | "";
  dealbreakers: string;
}

export interface SchoolRow {
  school: string;
  why_reach_for_you?: string;
  why_match_for_you?: string;
  why_safety_for_you?: string;
  key_fit_signals: string[];
  key_risks: string[];
  verification_focus: string[];
}

export interface PortfolioRisk {
  risk_title: string;
  what_it_means_for_you: string;
  mitigation: string;
}

export type PaywallTone = "rational" | "anxiety" | "curiosity";

export interface PaywallCopy {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  ctaPrimary: string;
  ctaHint: string;
  previewLine: string;
  hookLead: string;
  footerTitle: string;
  footerText: string;
}

export interface ReportPayload {
  executive_summary: string[];
  information_gaps: string[];
  reach: SchoolRow[];
  match: SchoolRow[];
  safety: SchoolRow[];
  portfolio_risks: PortfolioRisk[];
  improvement_plan: {
    this_week: string[];
    this_month: string[];
    before_submitting: string[];
  };
  strategy_notes: string[];
}

export type SchoolTier = "reach" | "match" | "safety";

/** 信息缺口面板保存后，随 POST 一并提交给模型 */
export interface SupplementaryNote {
  topic: string;
  text: string;
}

/** 两次报告 JSON 的结构化差异（用于 UI 摘要与行高亮） */
export interface ReportDiff {
  tierMoves: {
    school: string;
    schoolKey: string;
    fromTier: SchoolTier;
    toTier: SchoolTier;
  }[];
  addedSchools: { school: string; schoolKey: string; tier: SchoolTier }[];
  removedSchools: { school: string; schoolKey: string; tier: SchoolTier }[];
  gapsBeforeCount: number;
  gapsAfterCount: number;
  gapsAddedSamples: string[];
  gapsRemovedSamples: string[];
}
