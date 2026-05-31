import type { Locale } from "../../i18n/strings";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/** Known Chinese demo/seed strings stored in Supabase → i18n keys for English UI. */
const CRM_TEXT_KEYS: Record<string, string> = {
  "签约服务 · 我的申请": "crm.placeholderApplicationTitle",
  "标准规划 · 签约服务": "crm.demoPlanLabel",
  "标准规划 · 本地演示": "crm.demoPlanLabel",
  "标准规划 · Supabase 演示": "crm.demoPlanLabel",
  "6/12 · 已预约": "crm.demoMeetingScheduled",
  王老师: "crm.demoCounselorName",
  首席留学顾问: "crm.demoCounselorTitle",
  系统: "crm.console.systemLabel",
  "【置顶】ED 校请在 6/15 前确认；确认后我会更新 reach 校说明。":
    "crm.seed.pinnedEd",
  "欢迎加入 OnlyApply 签约服务。本周我们先定 ED 校方向，并在待办里完成 #1。":
    "crm.seed.welcome",
  "签约群公告：文书阶段每周三晚 8 点 sync，有冲突请提前在群里说。":
    "crm.seed.groupNotice",
  "签约服务已开通 · 阶段：文书准备": "crm.seed.serviceOpened",
  "补 SAT 目标分": "crm.seed.taskSat",
  "PIQ 第一稿": "crm.seed.taskPiq",
  更新夏校结果: "crm.seed.taskSummer",
  "Common App 主文书": "crm.seed.docCommonApp",
  "UC PIQ 合集": "crm.seed.docUcPiq",
  "Counselor 推荐信": "crm.seed.docRec",
  "9 年级–11 年级成绩单": "crm.seed.docTranscript",
  "活动列表.csv": "crm.seed.fileActivities",
};

export function localizeCrmText(
  text: string | null | undefined,
  locale: Locale,
  t: TranslateFn,
): string {
  if (!text) return "";
  if (locale !== "en") return text;
  const key = CRM_TEXT_KEYS[text.trim()];
  return key ? t(key) : text;
}
