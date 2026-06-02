import { getCalendlyBookingUrl, openCalendlyBooking } from "../expertConsultBooking";
import type { CrmCounselor, CrmEngagement } from "./types";

export type CounselorBookingKind = "meeting" | "calendly";

export type CounselorBookingLink = {
  url: string;
  kind: CounselorBookingKind;
};

/** Normalize https meeting link (Google Meet, Zoom, Teams, etc.). */
export function normalizeMeetingUrl(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function meetingUrlFromCounselor(c: CrmCounselor | null | undefined): string | null {
  return normalizeMeetingUrl(c?.meetingUrl);
}

function calendlyUrlFromCounselor(c: CrmCounselor | null | undefined): string | null {
  return getCalendlyBookingUrl(c?.calendlyUrl);
}

function firstMeetingLink(
  engagement: CrmEngagement,
  acting: CrmCounselor | null | undefined,
  getCounselorById: (id: string) => CrmCounselor | null,
): CounselorBookingLink | null {
  const fromActing = meetingUrlFromCounselor(acting);
  if (fromActing) return { url: fromActing, kind: "meeting" };

  const fromPrimary = meetingUrlFromCounselor(getCounselorById(engagement.counselorId));
  if (fromPrimary) return { url: fromPrimary, kind: "meeting" };

  const teamIds = engagement.counselorIds?.length ? engagement.counselorIds : [engagement.counselorId];
  for (const id of teamIds) {
    const url = meetingUrlFromCounselor(getCounselorById(id));
    if (url) return { url, kind: "meeting" };
  }
  return null;
}

function firstCalendlyLink(
  engagement: CrmEngagement,
  acting: CrmCounselor | null | undefined,
  getCounselorById: (id: string) => CrmCounselor | null,
): CounselorBookingLink | null {
  const fromActing = calendlyUrlFromCounselor(acting);
  if (fromActing) return { url: fromActing, kind: "calendly" };

  const fromPrimary = calendlyUrlFromCounselor(getCounselorById(engagement.counselorId));
  if (fromPrimary) return { url: fromPrimary, kind: "calendly" };

  const teamIds = engagement.counselorIds?.length ? engagement.counselorIds : [engagement.counselorId];
  for (const id of teamIds) {
    const url = calendlyUrlFromCounselor(getCounselorById(id));
    if (url) return { url, kind: "calendly" };
  }

  const fallback = getCalendlyBookingUrl(null);
  if (fallback) return { url: fallback, kind: "calendly" };
  return null;
}

/** Prefer Google Meet (meeting_url), then Calendly from team or site default. */
export function resolveBookingLinkForEngagement(
  engagement: CrmEngagement,
  acting: CrmCounselor | null | undefined,
  getCounselorById: (id: string) => CrmCounselor | null,
): CounselorBookingLink | null {
  return (
    firstMeetingLink(engagement, acting, getCounselorById) ??
    firstCalendlyLink(engagement, acting, getCounselorById)
  );
}

export function openBookingLinkForEngagement(
  engagement: CrmEngagement,
  acting: CrmCounselor | null | undefined,
  getCounselorById: (id: string) => CrmCounselor | null,
  options: { email?: string | null; source?: string; onFallback: () => void },
): boolean {
  const link = resolveBookingLinkForEngagement(engagement, acting, getCounselorById);
  if (!link) {
    options.onFallback();
    return false;
  }
  if (link.kind === "meeting") {
    if (typeof window !== "undefined") {
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
    return true;
  }
  if (openCalendlyBooking({ url: link.url, email: options.email, source: options.source })) {
    return true;
  }
  options.onFallback();
  return false;
}
