/** URL Supabase Auth should return to after Magic Link or OAuth (must be in Redirect URLs). */
export function getAuthRedirectUrl(): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}`;
}
