import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MarqueeSchool } from "./UniversityLogoMarquee";
import {
  APPLICATION_LINK_CATEGORIES,
  applicationLinkHost,
  type ApplicationLinkCategoryId,
  type CuratedApplicationLinkId,
} from "./applicationLinks";
import { useLanguage } from "../i18n/LanguageContext";
import { ROADMAP_CATEGORY_LABEL_KEY, roadmapSectionDomId } from "./roadmapCategories";
import "./FullscreenLogoMarquee.css";

const LINK_DESC_KEY: Record<CuratedApplicationLinkId, string> = {
  commonApp: "appLinks.descCommonApp",
  uc: "appLinks.descUc",
  collegeBoard: "appLinks.descCollegeBoard",
  toefl: "appLinks.descToefl",
  usNews: "appLinks.descUsNews",
  qs: "appLinks.descQs",
  wsj: "appLinks.descWsj",
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
  /** Kept for call-site compatibility; fullscreen shows application links, not logos */
  schools?: MarqueeSchool[];
}

export function FullscreenLogoMarquee({ open, onClose }: FullscreenLogoMarqueeProps) {
  const { t } = useLanguage();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<ApplicationLinkCategoryId>(
    APPLICATION_LINK_CATEGORIES[0].categoryId,
  );

  const scrollToCategory = useCallback((categoryId: ApplicationLinkCategoryId) => {
    const root = scrollRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`#${roadmapSectionDomId(categoryId)}`);
    if (!el) return;
    setActiveCategory(categoryId);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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

  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    if (!root) return;

    const sections = APPLICATION_LINK_CATEGORIES.map((cat) =>
      root.querySelector<HTMLElement>(`#${roadmapSectionDomId(cat.categoryId)}`),
    ).filter((el): el is HTMLElement => el != null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id;
        if (!top) return;
        const match = APPLICATION_LINK_CATEGORIES.find((c) => roadmapSectionDomId(c.categoryId) === top);
        if (match) setActiveCategory(match.categoryId);
      },
      { root, rootMargin: "-12% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.6] },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [open]);

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

        <div ref={scrollRef} className="fs-links-scroll">
          <div className="fs-hub-hero">
            <p className="fs-hub-intro">{t("appLinks.intro")}</p>
            <p className="fs-hub-hint">{t("appLinks.hint")}</p>
            <p className="fs-hub-flow">{t("appLinks.flowNote")}</p>
          </div>

          <div className="fs-hub-layout">
            <nav className="fs-hub-nav" aria-label={t("appLinks.navAria")}>
              <ul className="fs-hub-nav-list">
                {APPLICATION_LINK_CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.categoryId;
                  const count = cat.links.length;
                  return (
                    <li key={cat.categoryId}>
                      <button
                        type="button"
                        className={`fs-hub-nav-btn${isActive ? " is-active" : ""}${count === 0 ? " is-empty" : ""}`}
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => scrollToCategory(cat.categoryId)}
                      >
                        {t(ROADMAP_CATEGORY_LABEL_KEY[cat.categoryId])}
                        {count > 0 ? (
                          <span className="fs-hub-nav-count" aria-hidden>
                            {count}
                          </span>
                        ) : (
                          <span className="fs-hub-nav-soon" aria-hidden>
                            {t("appLinks.soon")}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="fs-links-groups">
              {APPLICATION_LINK_CATEGORIES.map((cat) => (
                <section
                  key={cat.categoryId}
                  id={roadmapSectionDomId(cat.categoryId)}
                  className="fs-link-section"
                  aria-labelledby={`${roadmapSectionDomId(cat.categoryId)}-label`}
                >
                  <h3 id={`${roadmapSectionDomId(cat.categoryId)}-label`} className="fs-link-cat">
                    {t(ROADMAP_CATEGORY_LABEL_KEY[cat.categoryId])}
                  </h3>
                  {cat.links.length === 0 ? (
                    <p className="fs-link-empty">{t("appLinks.emptySection")}</p>
                  ) : (
                    <ul className="fs-links-grid">
                      {cat.links.map((item) => {
                        const linkId = item.id as CuratedApplicationLinkId;
                        return (
                          <li key={item.id} className="fs-link-item">
                            <a
                              className="fs-link-card"
                              href={item.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`${t(`appLinks.${linkId}`)} — ${item.href}`}
                            >
                              <div className="fs-link-card-head">
                                <span className="fs-link-title">{t(`appLinks.${linkId}`)}</span>
                                {item.badge ? (
                                  <span className={`fs-badge fs-badge--${item.badge}`}>
                                    {t(BADGE_LABEL_KEY[item.badge])}
                                  </span>
                                ) : null}
                              </div>
                              <p className="fs-link-desc">{t(LINK_DESC_KEY[linkId])}</p>
                              <div className="fs-link-url-block">
                                <span className="fs-link-url-label">{t("appLinks.officialUrl")}</span>
                                <span className="fs-link-url" lang="en">
                                  {applicationLinkHost(item.href)}
                                </span>
                                <span className="fs-link-external" aria-hidden>
                                  ↗
                                </span>
                              </div>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              ))}
            </div>
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
