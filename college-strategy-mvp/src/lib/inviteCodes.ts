/** 需在 Supabase 执行 schema-invite-codes-v1.sql，且 .env 打开开关 */

export function isInviteCodesEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_INVITE_CODES === "true";
}
