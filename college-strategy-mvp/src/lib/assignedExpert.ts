export type AssignedExpert = {
  name: string;
  title: string;
  bio: string;
  specialties?: string[];
  email?: string;
  wechat?: string;
  calendlyUrl?: string;
};

/** Optional JSON in VITE_ASSIGNED_EXPERT for staging assigned-advisor UI. */
export function getAssignedExpert(): AssignedExpert | null {
  const raw = import.meta.env.VITE_ASSIGNED_EXPERT;
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AssignedExpert>;
    if (typeof parsed.name === "string" && parsed.name.trim() && typeof parsed.title === "string" && parsed.title.trim()) {
      return {
        name: parsed.name.trim(),
        title: parsed.title.trim(),
        bio: typeof parsed.bio === "string" ? parsed.bio.trim() : "",
        specialties: Array.isArray(parsed.specialties)
          ? parsed.specialties.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          : undefined,
        email: typeof parsed.email === "string" ? parsed.email.trim() : undefined,
        wechat: typeof parsed.wechat === "string" ? parsed.wechat.trim() : undefined,
        calendlyUrl: typeof parsed.calendlyUrl === "string" ? parsed.calendlyUrl.trim() : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
}
