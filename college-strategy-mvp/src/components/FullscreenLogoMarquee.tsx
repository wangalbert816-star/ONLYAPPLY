import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MarqueeSchool } from "./UniversityLogoMarquee";
import { BrandLogo } from "./BrandLogo";
import { RoadmapCategoryIcon } from "./RoadmapCategoryIcon";
import {
  APPLICATION_LINK_CATEGORIES,
  applicationLinkHost,
  type ApplicationLinkCategoryId,
  type ApplicationLinkBadge,
  type CuratedApplicationLinkId,
} from "./applicationLinks";
import { useLanguage } from "../i18n/LanguageContext";
import { ROADMAP_CATEGORY_LABEL_KEY, roadmapSectionDomId } from "./roadmapCategories";
import "./FullscreenLogoMarquee.css";
import "./ApplicationRoadmap.css";

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

const BADGE_LABEL_KEY: Record<ApplicationLinkBadge, string> = {
  first: "appLinks.badgeFirst",
  recommended: "appLinks.badgeRecommended",
  international: "appLinks.badgeInternational",
};

export interface FullscreenLogoMarqueeProps {
  open: boolean;
  onClose: () => void;
  onBookStrategyCall?: () => void;
  schools?: MarqueeSchool[];
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function matchesSearch(
  query: string,
  linkId: CuratedApplicationLinkId,
  title: string,
  desc: string,
  href: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const host = applicationLinkHost(href).toLowerCase();
  return (
    title.toLowerCase().includes(q) ||
    desc.toLowerCase().includes(q) ||
    host.includes(q) ||
    linkId.toLowerCase().includes(q)
  );
}

export function FullscreenLogoMarquee({ open, onClose, onBookStrategyCall }: FullscreenLogoMarqueeProps) {
  const { t } = useLanguage();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<ApplicationLinkCategoryId>(
    APPLICATION_LINK_CATEGORIES[0].categoryId,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  const scrollToCategory = useCallback((categoryId: ApplicationLinkCategoryId) => {
    const root = scrollRef.current;
    if (!root) return;
    const sectionId = roadmapSectionDomId(categoryId);
    const el = root.querySelector<HTMLElement>(`#${sectionId}`);
    if (!el) return;
    setActiveCategory(categoryId);
    setVisibleSections((prev) => {
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return APPLICATION_LINK_CATEGORIES;
    return APPLICATION_LINK_CATEGORIES.map((cat) => ({
      ...cat,
      links: cat.links.filter((item) => {
        const linkId = item.id as CuratedApplicationLinkId;
        return matchesSearch(q, linkId, t(`appLinks.${linkId}`), t(LINK_DESC_KEY[linkId]), item.href);
      }),
    })).filter((cat) => cat.links.length > 0 || !q);
  }, [searchQuery, t]);

  const showEmptySearch =
    searchQuery.trim().length > 0 &&
    filteredCategories.every((cat) => cat.links.length === 0);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setVisibleSections(new Set());
      return;
    }
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

    const sections = root.querySelectorAll<HTMLElement>(".fs-roadmap-section");

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        setVisibleSections((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            if (entry.isIntersecting) next.add(entry.target.id);
          }
          return next;
        });
      },
      { root, rootMargin: "0px 0px -10% 0px", threshold: 0.01 },
    );

    const navObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id;
        if (!top) return;
        const match = APPLICATION_LINK_CATEGORIES.find((c) => roadmapSectionDomId(c.categoryId) === top);
        if (match) setActiveCategory(match.categoryId);
      },
      { root, rootMargin: "-8% 0px -50% 0px", threshold: [0, 0.12, 0.3] },
    );

    sections.forEach((section) => {
      visibilityObserver.observe(section);
      navObserver.observe(section);
    });
    return () => {
      visibilityObserver.disconnect();
      navObserver.disconnect();
    };
  }, [open, searchQuery]);

  if (!open) return null;

  const renderNavButton = (cat: (typeof APPLICATION_LINK_CATEGORIES)[number], mobile = false) => {
    const isActive = activeCategory === cat.categoryId;
    const isEmpty = cat.links.length === 0;
    const label = t(ROADMAP_CATEGORY_LABEL_KEY[cat.categoryId]);
    if (mobile) {
      return (
        <button
          key={cat.categoryId}
          type="button"
          className={isActive ? "is-active" : undefined}
          onClick={() => scrollToCategory(cat.categoryId)}
        >
          {label}
        </button>
      );
    }
    return (
      <li key={cat.categoryId}>
        <button
          type="button"
          className={`fs-roadmap-nav-btn${isActive ? " is-active" : ""}`}
          aria-current={isActive ? "true" : undefined}
          onClick={() => scrollToCategory(cat.categoryId)}
        >
          <RoadmapCategoryIcon categoryId={cat.categoryId} className="fs-roadmap-nav-btn__icon" />
          <span className="fs-roadmap-nav-btn__text">{label}</span>
          {isEmpty ? <span className="fs-roadmap-nav-btn__soon">{t("appLinks.soon")}</span> : null}
        </button>
      </li>
    );
  };

  const node = (
    <div
      className="fs-root fs-root--roadmap"
      id="application-hub-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="fs-scrim" onClick={onClose} />
      <div className="fs-panel">
        <p id={titleId} className="fs-sr-only">
          {t("fullscreen.sr")}
        </p>
        <div className="fs-roadmap-shell">
        <aside className="fs-roadmap-sidebar" aria-label={t("appLinks.navAria")}>
          <div className="fs-roadmap-sidebar__brand">
            <BrandLogo />
          </div>
          <p className="fs-roadmap-sidebar__label">{t("appLinks.sidebarRoadmapLabel")}</p>
          <ul className="fs-roadmap-sidebar__nav">
            {APPLICATION_LINK_CATEGORIES.map((cat) => renderNavButton(cat))}
          </ul>
          {onBookStrategyCall ? (
            <button type="button" className="fs-roadmap-sidebar__cta" onClick={onBookStrategyCall}>
              <IconCalendar />
              {t("appLinks.bookStrategyCall")}
            </button>
          ) : null}
        </aside>

        <div className="fs-roadmap-main">
          <button
            ref={closeRef}
            type="button"
            className="fs-roadmap-close"
            onClick={onClose}
            aria-label={t("fullscreen.close")}
          >
            <span aria-hidden>×</span>
          </button>

          <div className="fs-roadmap-top">
            <div className="fs-roadmap-top__row">
              <div className="fs-roadmap-top__intro">
                <h2 className="fs-roadmap-top__title">{t("appLinks.roadmapTitle")}</h2>
                <p className="fs-roadmap-top__sub">{t("appLinks.roadmapSub")}</p>
              </div>
              <label className="fs-roadmap-search">
                <span className="fs-sr-only">{t("appLinks.searchPlaceholder")}</span>
                <span className="fs-roadmap-search__icon" aria-hidden>
                  <IconSearch />
                </span>
                <input
                  className="fs-roadmap-search__input"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("appLinks.searchPlaceholder")}
                />
              </label>
            </div>

            <div className="fs-roadmap-mobile-nav" aria-label={t("appLinks.navAria")}>
              {APPLICATION_LINK_CATEGORIES.map((cat) => renderNavButton(cat, true))}
            </div>

            <div className="fs-roadmap-banner" role="note">
              <IconClock />
              <p className="m-0">{t("appLinks.flowNote")}</p>
            </div>
          </div>

          <div ref={scrollRef} className="fs-roadmap-scroll">
            {showEmptySearch ? (
              <p className="fs-roadmap-empty-search">{t("appLinks.searchEmpty")}</p>
            ) : (
              filteredCategories.map((cat) => {
                const sectionId = roadmapSectionDomId(cat.categoryId);
                const isVisible = visibleSections.has(sectionId);
                const isEmpty = cat.links.length === 0;
                const linksToShow = cat.links;

                return (
                  <section
                    key={cat.categoryId}
                    id={sectionId}
                    className={`fs-roadmap-section${isVisible ? " is-visible" : ""}`}
                    aria-labelledby={`${sectionId}-label`}
                  >
                    <div className="fs-roadmap-section__head">
                      <div className="fs-roadmap-section__icon-wrap">
                        <RoadmapCategoryIcon categoryId={cat.categoryId} />
                      </div>
                      <h3 id={`${sectionId}-label`} className="fs-roadmap-section__title">
                        {t(ROADMAP_CATEGORY_LABEL_KEY[cat.categoryId])}
                        {isEmpty ? (
                          <span className="fs-roadmap-section__soon">{t("appLinks.sectionComingSoon")}</span>
                        ) : null}
                      </h3>
                    </div>

                    <ul className="fs-roadmap-grid">
                      {isEmpty ? (
                        <li
                          className="fs-roadmap-card fs-roadmap-card--placeholder"
                          style={{ ["--card-delay" as string]: "0ms" }}
                        >
                          <IconClock />
                          <span>{t("appLinks.placeholderCard")}</span>
                        </li>
                      ) : (
                        linksToShow.map((item, index) => {
                          const linkId = item.id as CuratedApplicationLinkId;
                          return (
                            <li key={item.id}>
                              <a
                                className="fs-roadmap-card"
                                style={{ ["--card-delay" as string]: `${index * 70}ms` }}
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`${t(`appLinks.${linkId}`)} — ${item.href}`}
                              >
                                <div className="fs-roadmap-card__head">
                                  <p className="fs-roadmap-card__title">{t(`appLinks.${linkId}`)}</p>
                                  {item.badge ? (
                                    <span className={`fs-roadmap-badge fs-roadmap-badge--${item.badge}`}>
                                      {t(BADGE_LABEL_KEY[item.badge])}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="fs-roadmap-card__desc">{t(LINK_DESC_KEY[linkId])}</p>
                                <div className="fs-roadmap-card__url">
                                  <span className="fs-roadmap-card__url-label">{t("appLinks.officialUrl")}</span>
                                  <span className="fs-roadmap-card__url-host" lang="en">
                                    {applicationLinkHost(item.href)}
                                  </span>
                                  <span className="fs-roadmap-card__external" aria-hidden>
                                    →
                                  </span>
                                </div>
                              </a>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
