import type { FormState } from "../types";

/** 与问卷下拉 value 一致；选「其他」时配合 intakeOtherDetail */
export const INTAKE_PRESETS = ["2027 Fall", "2028 Fall", "2029 Fall", "2030 Fall"] as const;

export const INTAKE_OTHER_VALUE = "其他";

export function isIntakePreset(term: string): boolean {
  return (INTAKE_PRESETS as readonly string[]).includes(term);
}

/** 提交报告与摘要展示用：预设取 intakeTerm，「其他」取自定义说明 */
export function getEffectiveIntake(form: FormState): string {
  if (form.intakeTerm === INTAKE_OTHER_VALUE) return form.intakeOtherDetail.trim();
  return form.intakeTerm.trim();
}

export function isIntakeComplete(form: FormState): boolean {
  return isIntakePreset(form.intakeTerm) || (form.intakeTerm === INTAKE_OTHER_VALUE && form.intakeOtherDetail.trim().length > 0);
}
