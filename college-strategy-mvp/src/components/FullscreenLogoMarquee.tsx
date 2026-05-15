import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { MarqueeSchool } from "./UniversityLogoMarquee";
import { APPLICATION_LINK_CATEGORIES, type ApplicationLinkCategoryId, type ApplicationLinkId } from "./applicationLinks";
import { useLanguage } from "../i18n/LanguageContext";
import "./FullscreenLogoMarquee.css";

const CATEGORY_LABEL_KEY: Record<ApplicationLinkCategoryId, string> = {
  submission: "appLinks.catSubmission",
  testing: "appLinks.catTesting",
  research: "appLinks.catResearch",
  essays: "appLinks.catEssays",
  official: "appLinks.catOfficial",
};

const LINK_DESC_KEY: Record<ApplicationLinkId, string> = {
  commonApp: "appLinks.descCommonApp",
  uc: "appLinks.descUc",
  collegeBoard: "appLinks.descCollegeBoard",
  toefl: "appLinks.descToefl",
  usNews: "appLinks.descUsNews",
  qs: "appLinks.descQs",
  niche: "appLinks.descNiche",
  collegeNavigator: "appLinks.descCollegeNavigator",
  commonAppEssayPrompts: "appLinks.descCommonAppEssayPrompts",
  collegeEssayGuy: "appLinks.descCollegeEssayGuy",
  educationUsa: "appLinks.descEducationUsa",
};

const BADGE_LABEL_KEY = {
  first: "appLinks.badgeFirst",
  recommended: "appLinks.badgeRecommended",
} as const;

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
    <div className="fs-root" id="application-hub-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
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
          <p className="fs-hub-intro">{t("appLinks.intro")}</p>
          <p className="fs-hub-hint">{t("appLinks.hint")}</p>
          <p className="fs-hub-flow">{t("appLinks.flowNote")}</p>
          <div className="fs-links-groups">
            {APPLICATION_LINK_CATEGORIES.map((cat) => (
              <section key={cat.categoryId} className="fs-link-section" aria-labelledby={`fs-cat-${cat.categoryId}`}>
                <h3 id={`fs-cat-${cat.categoryId}`} className="fs-link-cat">
                  {t(CATEGORY_LABEL_KEY[cat.categoryId])}
                </h3>
                <ul className="fs-links-grid">
                  {cat.links.map((item) => (
                    <li key={item.id} className="fs-link-item">
                      <a
                        className="fs-link-card"
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${t(`appLinks.${item.id}`)} — ${item.href}`}
                      >
                        <div className="fs-link-card-head">
                          <span className="fs-link-title">{t(`appLinks.${item.id}`)}</span>
                          {"badge" in item && item.badge ? (
                            <span className={`fs-badge fs-badge--${item.badge}`}>{t(BADGE_LABEL_KEY[item.badge])}</span>
                          ) : null}
                        </div>
                        <p className="fs-link-desc">{t(LINK_DESC_KEY[item.id])}</p>
                        <div className="fs-link-url-block">
                          <span className="fs-link-url-label">{t("appLinks.officialUrl")}</span>
                          <span className="fs-link-url" lang="en">
                            {item.href}
                          </span>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
        <footer className="fs-foot">
          <div className="fs-foot-actions">
            <button type="button" className="fs-btn fs-btn--primary" onClick={onClose}>
              {t("appLinks.ctaContinue")}
            </button>
            <button type="button" className="fs-btn fs-btn--ghost" onClick={onClose}>
              {t("appLinks.ctaLater")}
            </button>
          </div>
          <p className="fs-foot-hint">{t("fullscreen.hint")}</p>
        </footer>
        <div className="fs-vignette" aria-hidden />
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
