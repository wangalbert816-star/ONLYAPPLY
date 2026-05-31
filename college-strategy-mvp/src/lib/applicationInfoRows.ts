import type { Locale } from "../i18n/strings";
import { formatStructuredActivitiesSummary } from "./activityEvidence";
import type { FormState } from "../types";

export type ApplicationInfoRow = { label: string; value: string };

function compactText(value: string, max = 96) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function optionLabel(
  kind: "identity" | "budget" | "testing" | "size" | "culture" | "risk" | "geo",
  value: string,
  locale: Locale,
) {
  const zh = {
    identity: { intl: "国际生", us_citizen: "美国身份", other: "其他身份" },
    budget: {
      full_pay: "可全自费",
      high_budget: "较高预算，仍控成本",
      budget_cap: "有明确预算上限",
      need_aid: "需要奖助",
      unsure: "暂不确定",
    },
    testing: { test_optional: "Test-Optional / 暂不提交", will_submit: "计划提交 SAT / ACT" },
    size: { small: "小型校园", medium: "中等规模", large: "大型校园", any: "都可以" },
    culture: {
      academic: "学术 / 研究导向",
      balanced: "学业与社交平衡",
      social: "社交 / 派对氛围活跃",
      any: "没有强烈偏好",
    },
    risk: { conservative: "偏保守", balanced: "平衡", aggressive: "偏进取" },
    geo: { west: "西海岸", east: "东海岸", south: "南部", midwest: "中西部", great_lakes: "五大湖", any: "不限地区" },
  };
  const en = {
    identity: { intl: "International", us_citizen: "U.S. citizen / resident", other: "Other identity" },
    budget: {
      full_pay: "Full-pay possible",
      high_budget: "High budget, cost matters",
      budget_cap: "Clear budget cap",
      need_aid: "Needs aid",
      unsure: "Not sure yet",
    },
    testing: { test_optional: "Test-optional / not submitting", will_submit: "Planning to submit SAT / ACT" },
    size: { small: "Small campus", medium: "Medium campus", large: "Large campus", any: "Any size" },
    culture: {
      academic: "Academic / research-oriented",
      balanced: "Balanced academic & social",
      social: "Active social / party-friendly",
      any: "No strong preference",
    },
    risk: { conservative: "Conservative", balanced: "Balanced", aggressive: "Aggressive" },
    geo: { west: "West", east: "East", south: "South", midwest: "Midwest", great_lakes: "Great Lakes", any: "Any region" },
  };
  const table = locale === "en" ? en : zh;
  return (table[kind] as Record<string, string>)[value] ?? value;
}

/** Rows shown in 我的申请 / CRM Student info — mirrors questionnaire + report inputs. */
export function buildApplicationInfoRows(
  form: FormState,
  locale: Locale,
  t: (key: string) => string,
): ApplicationInfoRow[] {
  const intake = form.intakeTerm === "other" ? form.intakeOtherDetail : form.intakeTerm;
  const testScores = [form.satScore ? `SAT ${form.satScore}` : "", form.actScore ? `ACT ${form.actScore}` : ""]
    .filter(Boolean)
    .join(" / ");
  const testing = [form.testing ? optionLabel("testing", form.testing, locale) : "", testScores].filter(Boolean).join(" · ");
  const geo = form.geoPrefs.map((x) => optionLabel("geo", x, locale)).join(locale === "en" ? ", " : "、");

  return [
    { label: t("auth.accountInfoIntake"), value: compactText(intake) },
    { label: t("auth.accountInfoGpa"), value: compactText(form.gpa) },
    { label: t("auth.accountInfoTesting"), value: compactText(testing) },
    { label: t("auth.accountInfoSchoolSystem"), value: compactText(form.highSchoolSystem) },
    { label: t("auth.accountInfoCurrentSchool"), value: compactText(form.currentHighSchool) },
    { label: t("auth.accountInfoMajor"), value: compactText([form.majorPrimary, form.majorSecondary].filter(Boolean).join(" / ")) },
    { label: t("auth.accountInfoIdentity"), value: form.applicantIdentity ? optionLabel("identity", form.applicantIdentity, locale) : "" },
    {
      label: t("auth.accountInfoEnvironment"),
      value: compactText([form.citizenship ?? "", form.residenceRegion ?? ""].filter(Boolean).join(" / ")),
    },
    { label: t("auth.accountInfoBudget"), value: form.budget ? optionLabel("budget", form.budget, locale) : "" },
    { label: t("auth.accountInfoActivities"), value: compactText(formatStructuredActivitiesSummary(form)) },
    {
      label: t("auth.accountInfoPreferences"),
      value: compactText(
        [
          form.schoolSize ? optionLabel("size", form.schoolSize, locale) : "",
          form.campusCulturePref ? optionLabel("culture", form.campusCulturePref, locale) : "",
          geo,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
    },
    { label: t("auth.accountInfoRisk"), value: form.riskStyle ? optionLabel("risk", form.riskStyle, locale) : "" },
    { label: t("auth.accountInfoDealbreakers"), value: compactText(form.dealbreakers) },
  ].filter((item) => item.value);
}
