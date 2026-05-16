/** Map Supabase Auth API errors to localized copy. */
export function mapAuthError(message: string, t: (key: string) => string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("over_email_send_rate_limit")) {
    return t("auth.errRateLimit");
  }
  if (m.includes("invalid") && m.includes("email")) {
    return t("auth.errInvalidEmail");
  }
  if (m.includes("signup") && m.includes("disabled")) {
    return t("auth.errSignupDisabled");
  }
  if (m.includes("provider") && (m.includes("not enabled") || m.includes("disabled"))) {
    return t("auth.errGoogleNotEnabled");
  }
  if (m.includes("redirect") && m.includes("url")) {
    return t("auth.errRedirectUrl");
  }
  return message;
}
