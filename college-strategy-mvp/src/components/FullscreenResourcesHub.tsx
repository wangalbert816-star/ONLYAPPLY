import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { APPLICATION_LINK_CATEGORIES, type ApplicationLinkCategoryId, type ApplicationRoadmapPost } from "./applicationLinks";
import {
  fetchPublishedRoadmapPosts,
  flattenRoadmapPosts,
  type RoadmapPostsByCategory,
} from "../lib/applicationRoadmapApi";
import { useLanguage } from "../i18n/LanguageContext";
import { ResourcePostDetail } from "./ResourcePostDetail";
import { ResourcePostCard } from "./ResourcePostCard";
import { ROADMAP_CATEGORY_LABEL_KEY } from "./roadmapCategories";
import { excerptText, type ResourcesFilter } from "../lib/resourcePostPresentation";
import "./FullscreenLogoMarquee.css";
import "./FullscreenResourcesHub.css";

function postTitle(post: ApplicationRoadmapPost, locale: "zh" | "en"): string {
  return locale === "zh" ? post.titleZh : post.titleEn;
}

function postExcerpt(post: ApplicationRoadmapPost, locale: "zh" | "en"): string {
  const raw = locale === "zh" ? post.descriptionZh : post.descriptionEn || post.descriptionZh;
  return excerptText(raw);
}

export interface FullscreenResourcesHubProps {
  open: boolean;
  onClose: () => void;
}

export function FullscreenResourcesHub({ open, onClose }: FullscreenResourcesHubProps) {
  const { t, locale } = useLanguage();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [postsByCategory, setPostsByCategory] = useState<RoadmapPostsByCategory>({});
  const [filter, setFilter] = useState<ResourcesFilter>("all");
  const [selectedPost, setSelectedPost] = useState<ApplicationRoadmapPost | null>(null);

  const allPosts = useMemo(() => flattenRoadmapPosts(postsByCategory), [postsByCategory]);

  const visiblePosts = useMemo(() => {
    if (filter === "all") return allPosts;
    return postsByCategory[filter] ?? [];
  }, [allPosts, filter, postsByCategory]);

  const categoryLabel = useCallback(
    (categoryId: ApplicationLinkCategoryId) => t(ROADMAP_CATEGORY_LABEL_KEY[categoryId]),
    [t],
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedPost) setSelectedPost(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, selectedPost]);

  useEffect(() => {
    if (!open) {
      setSelectedPost(null);
      setFilter("all");
      return;
    }
    let cancelled = false;
    void fetchPublishedRoadmapPosts()
      .then((grouped) => {
        if (cancelled) return;
        setPostsByCategory(grouped);
      })
      .catch(() => {
        if (!cancelled) setPostsByCategory({});
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const node = (
    <div className="fs-root fs-root--resources" id="resources-hub-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="fs-scrim" onClick={onClose} />
      <div className="fs-panel">
        <p id={titleId} className="fs-sr-only">
          {t("resources.sr")}
        </p>
        <header className="fs-chrome">
          <span className="fs-chrome-title" aria-hidden>
            {t("resources.chrome")}
          </span>
          <button ref={closeRef} type="button" className="fs-close" onClick={onClose}>
            {t("fullscreen.close")} <kbd className="fs-kbd">{t("fullscreen.esc")}</kbd>
          </button>
        </header>

        <div className="fs-links-scroll">
          <div className="fs-hub-hero">
            <h2 className="fs-resources-page-title">{t("resources.pageTitle")}</h2>
            <p className="fs-hub-intro">{t("resources.intro")}</p>
          </div>

          {allPosts.length === 0 ? (
            <p className="fs-link-empty fs-resources-empty-all">{t("resources.emptyAll")}</p>
          ) : (
            <div className="res-hub__layout">
              <nav className="res-hub__sidebar" aria-label={t("resources.navAria")}>
                <button
                  type="button"
                  className={`res-hub__nav-btn${filter === "all" ? " is-active" : ""}`}
                  aria-current={filter === "all" ? "true" : undefined}
                  onClick={() => setFilter("all")}
                >
                  {t("resources.filterAll")}
                </button>
                {APPLICATION_LINK_CATEGORIES.map((cat) => {
                  const count = postsByCategory[cat.categoryId]?.length ?? 0;
                  if (count === 0) return null;
                  const isActive = filter === cat.categoryId;
                  return (
                    <button
                      key={cat.categoryId}
                      type="button"
                      className={`res-hub__nav-btn${isActive ? " is-active" : ""}`}
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => setFilter(cat.categoryId)}
                    >
                      {categoryLabel(cat.categoryId)}
                    </button>
                  );
                })}
              </nav>

              <div className="res-hub__main">
                <div className="res-hub__grid" role="list">
                  {visiblePosts.length === 0 ? (
                    <p className="res-hub__empty">{t("resources.emptySection")}</p>
                  ) : (
                    visiblePosts.map((post) => (
                      <ResourcePostCard
                        key={post.id}
                        post={post}
                        categoryLabel={categoryLabel(post.categoryId)}
                        title={postTitle(post, locale)}
                        excerpt={postExcerpt(post, locale)}
                        authorLabel={t("resources.author")}
                        onOpen={() => setSelectedPost(post)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedPost ? <ResourcePostDetail post={selectedPost} onClose={() => setSelectedPost(null)} /> : null}

        <footer className="fs-foot">
          <div className="fs-foot-actions">
            <button type="button" className="fs-btn fs-btn--primary" onClick={onClose}>
              {t("resources.ctaClose")}
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
