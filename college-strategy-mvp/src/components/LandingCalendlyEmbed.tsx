import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getCalendlyBookingUrl, isCalendlyBookingEnabled, mountCalendlyInlineWidget } from "../lib/expertConsultBooking";
import { useLanguage } from "../i18n/LanguageContext";
import "./LandingCalendlyEmbed.css";

type Props = {
  onFallback: () => void;
};

export function LandingCalendlyEmbed({ onFallback }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const hostRef = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const calendlyUrl = getCalendlyBookingUrl();
  const enabled = isCalendlyBookingEnabled(calendlyUrl);

  useEffect(() => {
    if (!enabled) return;
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    setLoadFailed(false);

    void mountCalendlyInlineWidget({
      url: calendlyUrl,
      parentElement: host,
      email: user?.email ?? undefined,
      source: "landing",
    }).then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setLoadFailed(true);
        return;
      }
      // Calendly sometimes mounts a short iframe before resize messages arrive
      requestAnimationFrame(() => {
        if (cancelled) return;
        const widget = host.querySelector(".calendly-inline-widget");
        const iframe = host.querySelector("iframe");
        const minH = window.matchMedia("(max-width: 780px)").matches ? "1050px" : "700px";
        if (widget instanceof HTMLElement) {
          widget.style.minHeight = minH;
          if (!widget.style.height) widget.style.height = minH;
        }
        if (iframe instanceof HTMLIFrameElement) {
          iframe.style.minHeight = minH;
          iframe.style.height = "100%";
          iframe.style.width = "100%";
        }
      });
    });

    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, [calendlyUrl, enabled, user?.email]);

  if (!enabled || loadFailed) {
    return (
      <div className="landing-calendly-fallback">
        <p className="landing-calendly-fallback__lead">{t("landingReplica.bookingFallbackLead")}</p>
        <button type="button" className="landing-btn landing-btn--secondary landing-btn--md" onClick={onFallback}>
          {t("landingReplica.bookingFallbackCta")}
        </button>
      </div>
    );
  }

  return (
    <div className="landing-calendly-shell">
      <p className="landing-calendly-shell__hint">{t("landingReplica.bookingHint")}</p>
      <div ref={hostRef} className="landing-calendly-embed" aria-label={t("landingReplica.bookingTitle")} />
    </div>
  );
}
