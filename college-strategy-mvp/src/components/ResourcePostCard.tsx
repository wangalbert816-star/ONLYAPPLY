import { useState } from "react";
import type { ApplicationRoadmapPost } from "./applicationLinks";
import { CATEGORY_COVER_THEME } from "../lib/resourcePostPresentation";

type Props = {
  post: ApplicationRoadmapPost;
  categoryLabel: string;
  title: string;
  excerpt: string;
  authorLabel: string;
  onOpen: () => void;
};

export function ResourcePostCard({ post, categoryLabel, title, excerpt, authorLabel, onOpen }: Props) {
  const [coverFailed, setCoverFailed] = useState(false);
  const theme = CATEGORY_COVER_THEME[post.categoryId];
  const showImage = Boolean(post.coverImageUrl) && !coverFailed;

  return (
    <article className="res-card">
      <button type="button" className="res-card__hit" onClick={onOpen}>
        <div className="res-card__media" style={{ background: theme.gradient }}>
          <div className="res-card__media-pattern" style={{ background: theme.pattern }} aria-hidden />
          {showImage ? (
            <img
              className="res-card__img"
              src={post.coverImageUrl!}
              alt=""
              loading="lazy"
              onError={() => setCoverFailed(true)}
            />
          ) : null}
          <div className="res-card__media-overlay">
            <span className="res-card__media-brand" aria-hidden>
              OA
            </span>
            <p className="res-card__media-title">{post.titleZh || title}</p>
          </div>
        </div>
        <div className="res-card__body">
          <div className="res-card__tags">
            <span className="res-card__tag">{categoryLabel}</span>
          </div>
          <h3 className="res-card__title">{title}</h3>
          {excerpt ? <p className="res-card__excerpt">{excerpt}</p> : null}
          <footer className="res-card__foot">
            <span className="res-card__avatar" aria-hidden>
              O
            </span>
            <span className="res-card__author">{authorLabel}</span>
          </footer>
        </div>
      </button>
    </article>
  );
}
