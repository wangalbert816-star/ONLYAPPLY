import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { MarqueeSchool } from "./UniversityLogoMarquee";
import { APPLICATION_LINKS, displayHost } from "./applicationLinks";
import { useLanguage } from "../i18n/LanguageContext";
import "./FullscreenLogoMarquee.css";

export interface FullscreenLogoMarqueeProps {
  open: boolean;
  onClose: () => void;
  /** 保留与调用方一致；全屏内已改为申请外链，不再展示 logo */
  schools?: MarqueeSchool[];
}

export function FullscreenLogoMarquee({ open, onClose }: FullscreenLogoMarqueeProps) {
  const { t } = useLanguage();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const node = (
    <div className="fs-root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="fs-scrim" onClick={onClose} />
      <div className="fs-panel">
        <p id={titleId} className="fs-sr-only">
          {t("fullscreen.sr")}
        </p>
        <header className="fs-chrome">
          <span className="fs-chrome-title" aria-hidden>
            {t("fullscreen.chrome")}
          </span>
          <button ref={closeRef} type="button" className="fs-close" onClick={onClose}>
            {t("fullscreen.close")} <kbd className="fs-kbd">{t("fullscreen.esc")}</kbd>
          </button>
        </header>
        <div className="fs-links-scroll">
          <p className="fs-links-lead">{t("appLinks.hint")}</p>
          <ul className="fs-links-grid">
            {APPLICATION_LINKS.map((item) => (
              <li key={item.id} className="fs-link-item">
                <a
                  className="fs-link-card"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${t(`appLinks.${item.id}`)} — ${item.href}`}
                >
                  <span className="fs-link-title">{t(`appLinks.${item.id}`)}</span>
                  <span className="fs-link-host">{displayHost(item.href)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <p className="fs-hint">{t("fullscreen.hint")}</p>
        <div className="fs-vignette" aria-hidden />
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
