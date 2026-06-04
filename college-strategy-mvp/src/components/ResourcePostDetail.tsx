import { useId } from "react";
import type { ApplicationRoadmapPost } from "./applicationLinks";
import { useLanguage } from "../i18n/LanguageContext";

function postHasEnglish(post: ApplicationRoadmapPost): boolean {
  return Boolean(post.titleEn.trim() || post.descriptionEn.trim());
}

type Props = {
  post: ApplicationRoadmapPost;
  onClose: () => void;
};

export function ResourcePostDetail({ post, onClose }: Props) {
  const { t } = useLanguage();
  const titleId = useId();

  return (
    <div
      className="fs-post-detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="fs-post-detail-scrim"
        aria-label={t("appLinks.postDetailClose")}
        onClick={onClose}
      />
      <div className="fs-post-detail-panel">
        <header className="fs-post-detail-head">
          <button type="button" className="fs-post-detail-back" onClick={onClose}>
            {t("appLinks.postDetailClose")}
          </button>
        </header>
        <div className="fs-post-detail-scroll">
          <section className="fs-post-detail-lang" lang="zh-Hans">
            <p className="fs-post-detail-lang-label">{t("appLinks.postDetailZh")}</p>
            <h2 id={titleId} className="fs-post-detail-title">
              {post.titleZh}
            </h2>
            {post.descriptionZh.trim() ? <p className="fs-post-detail-body">{post.descriptionZh}</p> : null}
          </section>
          {postHasEnglish(post) ? (
            <section className="fs-post-detail-lang fs-post-detail-lang--secondary" lang="en">
              <p className="fs-post-detail-lang-label">{t("appLinks.postDetailEn")}</p>
              {post.titleEn.trim() ? (
                <h3 className="fs-post-detail-title fs-post-detail-title--sub">{post.titleEn}</h3>
              ) : null}
              {post.descriptionEn.trim() ? <p className="fs-post-detail-body">{post.descriptionEn}</p> : null}
            </section>
          ) : null}
        </div>
        {post.href ? (
          <footer className="fs-post-detail-foot">
            <a
              className="fs-btn fs-btn--primary fs-post-detail-link"
              href={post.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("appLinks.postDetailOpenLink")}
              <span aria-hidden> ↗</span>
            </a>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
