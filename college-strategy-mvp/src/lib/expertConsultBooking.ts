type CalendlyWidget = {
  initPopupWidget: (options: {
    url: string;
    prefill?: { email?: string; name?: string };
    utm?: Record<string, string>;
  }) => void;
};

declare global {
  interface Window {
    Calendly?: CalendlyWidget;
  }
}

const CALENDLY_SCRIPT = "https://assets.calendly.com/assets/external/widget.js";
const CALENDLY_STYLE = "https://assets.calendly.com/assets/external/widget.css";

let widgetLoadPromise: Promise<void> | null = null;

function isCalendlyUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "calendly.com";
  } catch {
    return false;
  }
}

/** Global booking page from Calendly → Event types → copy link */
export function getCalendlyBookingUrl(override?: string | null): string | null {
  const candidate = (override ?? import.meta.env.VITE_CALENDLY_URL ?? "").trim();
  if (!candidate || !isCalendlyUrl(candidate)) return null;
  return candidate;
}

export function isCalendlyBookingEnabled(override?: string | null) {
  return getCalendlyBookingUrl(override) != null;
}

function usePopupWidget() {
  const raw = import.meta.env.VITE_CALENDLY_USE_POPUP;
  return raw !== "false" && raw !== "0";
}

function loadCalendlyAssets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Calendly?.initPopupWidget) return Promise.resolve();

  if (!widgetLoadPromise) {
    widgetLoadPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-calendly-widget="true"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = CALENDLY_STYLE;
        link.setAttribute("data-calendly-widget", "true");
        document.head.appendChild(link);
      }

      const existing = document.querySelector('script[data-calendly-widget="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("calendly script failed")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = CALENDLY_SCRIPT;
      script.async = true;
      script.setAttribute("data-calendly-widget", "true");
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("calendly script failed"));
      document.head.appendChild(script);
    });
  }

  return widgetLoadPromise;
}

function openCalendlyInNewTab(url: string, email?: string) {
  const target = new URL(url);
  if (email) target.searchParams.set("email", email);
  window.open(target.toString(), "_blank", "noopener,noreferrer");
}

export type OpenCalendlyOptions = {
  url?: string | null;
  email?: string | null;
  name?: string | null;
  /** e.g. account_advisor_panel, report_advisor_support, landing */
  source?: string;
};

/**
 * Opens Calendly when configured. Returns true if handled; false → caller should show lead form / email fallback.
 */
export function openCalendlyBooking(options: OpenCalendlyOptions = {}): boolean {
  const url = getCalendlyBookingUrl(options.url);
  if (!url) return false;

  const email = options.email?.trim() || undefined;
  const name = options.name?.trim() || undefined;
  const utm = {
    utm_source: "onlyapply",
    utm_medium: "expert_consult",
    utm_campaign: options.source || "app",
  };

  if (!usePopupWidget()) {
    openCalendlyInNewTab(url, email);
    return true;
  }

  void loadCalendlyAssets()
    .then(() => {
      if (window.Calendly?.initPopupWidget) {
        window.Calendly.initPopupWidget({
          url,
          prefill: { email, name },
          utm,
        });
        return;
      }
      openCalendlyInNewTab(url, email);
    })
    .catch(() => {
      openCalendlyInNewTab(url, email);
    });

  return true;
}

export function requestExpertConsult(options: OpenCalendlyOptions & { onFallback: () => void }) {
  const { onFallback, ...booking } = options;
  if (openCalendlyBooking(booking)) return;
  onFallback();
}
