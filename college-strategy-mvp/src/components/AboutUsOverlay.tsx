import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { BrandLogo } from "./BrandLogo";
import "./AboutUsOverlay.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenFoundersLetter: () => void;
};

export function AboutUsOverlay({ open, onClose, onOpenFoundersLetter }: Props) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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

  return createPortal(
    <div className="legal-page about-us-page" role="dialog" aria-modal="true" aria-labelledby="about-us-title">
      <div className="legal-page__scrim" onClick={onClose} />
      <div className="legal-page__panel">
        <header className="legal-page__bar">
          <span className="legal-page__chrome-title" aria-hidden>
            OnlyApply
          </span>
          <button type="button" className="legal-page__back" onClick={onClose}>
            {t("aboutUs.close")} <kbd className="legal-page__kbd">Esc</kbd>
          </button>
        </header>

        <main className="legal-page__main about-us-page__main">
          <BrandLogo />
          <p className="legal-page__eyebrow about-us-page__eyebrow">{t("aboutUs.eyebrow")}</p>
          <h1 id="about-us-title">{t("aboutUs.title")}</h1>

          <div className="legal-page__body about-us-page__body">
            <section className="legal-page__section about-us-page__section">
              <h2>{t("aboutUs.missionTitle")}</h2>
              <p>{t("aboutUs.missionBody")}</p>
            </section>

            <section className="legal-page__section about-us-page__section">
              <h2>{t("aboutUs.whyTitle")}</h2>
              <p>{t("aboutUs.whyBody")}</p>
            </section>

            <button
              type="button"
              className="about-us-page__founders-card"
              onClick={onOpenFoundersLetter}
              aria-label={`${t("aboutUs.foundersCta")} — ${t("aboutUs.foundersLink")}`}
            >
              <span className="about-us-page__founders-card-title">{t("aboutUs.foundersCta")}</span>
              <span className="about-us-page__founders-card-link">{t("aboutUs.foundersLink")}</span>
            </button>
          </div>
        </main>
      </div>
    </div>,
    document.body,
  );
}
