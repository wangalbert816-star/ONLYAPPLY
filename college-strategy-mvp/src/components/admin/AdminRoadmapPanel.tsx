import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  APPLICATION_LINK_CATEGORIES,
  type ApplicationLinkCategoryId,
  type ApplicationLinkBadge,
} from "../applicationLinks";
import {
  createAdminRoadmapPost,
  deleteAdminRoadmapPost,
  listAdminRoadmapPosts,
  patchAdminRoadmapPost,
  type AdminRoadmapPost,
} from "../../lib/admin/crmAdminApi";
import { AdminRoadmapCoverField } from "./AdminRoadmapCoverField";

const CATEGORY_IDS = APPLICATION_LINK_CATEGORIES.map((c) => c.categoryId);

function formatWhen(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roadmapErrorMessage(code: string | undefined, t: (key: string) => string) {
  if (!code) return t("admin.errors.generic");
  if (code === "api_route_missing") return t("admin.errors.roadmap_api_missing");
  if (/application_roadmap_posts|relation.*does not exist/i.test(code)) return t("admin.errors.roadmap_table_missing");
  const key = `admin.errors.${code}`;
  const msg = t(key);
  return msg === key ? t("admin.errors.generic") : msg;
}

type Props = {
  token: string;
  busy: boolean;
  onRun: (fn: () => Promise<void>) => Promise<void>;
};

export function AdminRoadmapPanel({ token, busy, onRun }: Props) {
  const { t, locale } = useLanguage();
  const [posts, setPosts] = useState<AdminRoadmapPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [categoryId, setCategoryId] = useState<ApplicationLinkCategoryId>("financial");
  const [href, setHref] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [titleZh, setTitleZh] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descriptionZh, setDescriptionZh] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [badge, setBadge] = useState<ApplicationLinkBadge | "">("");
  const [published, setPublished] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  const [editId, setEditId] = useState<string | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<ApplicationLinkCategoryId>("financial");
  const [editHref, setEditHref] = useState("");
  const [editCoverImageUrl, setEditCoverImageUrl] = useState<string | null>(null);
  const [editTitleZh, setEditTitleZh] = useState("");
  const [editTitleEn, setEditTitleEn] = useState("");
  const [editDescriptionZh, setEditDescriptionZh] = useState("");
  const [editDescriptionEn, setEditDescriptionEn] = useState("");
  const [editBadge, setEditBadge] = useState<ApplicationLinkBadge | "">("");
  const [editPublished, setEditPublished] = useState(true);
  const [editSortOrder, setEditSortOrder] = useState(0);

  const categoryLabel = (id: ApplicationLinkCategoryId) => {
    const map: Record<ApplicationLinkCategoryId, string> = {
      submission: "appLinks.catSubmission",
      testing: "appLinks.catTesting",
      essays: "appLinks.catEssays",
      financial: "appLinks.catFinancial",
      majors: "appLinks.catMajors",
      research: "appLinks.catResearch",
      summer: "appLinks.catSummer",
      scholarships: "appLinks.catScholarships",
      researchPrograms: "appLinks.catResearchPrograms",
      official: "appLinks.catOfficial",
    };
    const label = t(map[id]);
    return label;
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setPanelError(null);
    try {
      const { posts: next } = await listAdminRoadmapPosts(token);
      setPosts(next);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const code = (e as Error & { code?: string }).code ?? raw;
      setPanelError(roadmapErrorMessage(code, t));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resetForm = () => {
    setHref("");
    setCoverImageUrl(null);
    setTitleZh("");
    setTitleEn("");
    setDescriptionZh("");
    setDescriptionEn("");
    setBadge("");
    setPublished(true);
    setSortOrder(0);
  };

  const submitCreate = async () => {
    if (submitting || busy) return;
    setPanelError(null);
    if (!titleZh.trim() || !titleEn.trim()) {
      setPanelError(roadmapErrorMessage("roadmap_title_required", t));
      return;
    }
    setSubmitting(true);
    try {
      const { post } = await createAdminRoadmapPost(token, {
        categoryId,
        href: href.trim() || null,
        coverImageUrl,
        titleZh: titleZh.trim(),
        titleEn: titleEn.trim(),
        descriptionZh: descriptionZh.trim(),
        descriptionEn: descriptionEn.trim(),
        badge: badge || null,
        published,
        sortOrder,
      });
      setPosts((prev) => [post, ...prev]);
      resetForm();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const code = (e as Error & { code?: string }).code ?? raw;
      setPanelError(roadmapErrorMessage(code, t));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (post: AdminRoadmapPost) => {
    setEditId(post.id);
    setEditCategoryId(post.categoryId);
    setEditHref(post.href ?? "");
    setEditCoverImageUrl(post.coverImageUrl ?? null);
    setEditTitleZh(post.titleZh);
    setEditTitleEn(post.titleEn);
    setEditDescriptionZh(post.descriptionZh);
    setEditDescriptionEn(post.descriptionEn);
    setEditBadge(post.badge ?? "");
    setEditPublished(post.published);
    setEditSortOrder(post.sortOrder);
  };

  const saveEdit = () =>
    onRun(async () => {
      if (!editId) return;
      const { post } = await patchAdminRoadmapPost(token, editId, {
        categoryId: editCategoryId,
        href: editHref.trim() || null,
        coverImageUrl: editCoverImageUrl,
        titleZh: editTitleZh.trim(),
        titleEn: editTitleEn.trim(),
        descriptionZh: editDescriptionZh.trim(),
        descriptionEn: editDescriptionEn.trim(),
        badge: editBadge || null,
        published: editPublished,
        sortOrder: editSortOrder,
      });
      setPosts((prev) => prev.map((row) => (row.id === post.id ? post : row)));
      setEditId(null);
    });

  const togglePublished = (post: AdminRoadmapPost) =>
    onRun(async () => {
      const { post: next } = await patchAdminRoadmapPost(token, post.id, { published: !post.published });
      setPosts((prev) => prev.map((row) => (row.id === next.id ? next : row)));
    });

  const removePost = (post: AdminRoadmapPost) =>
    onRun(async () => {
      await deleteAdminRoadmapPost(token, post.id);
      setPosts((prev) => prev.filter((row) => row.id !== post.id));
      if (editId === post.id) setEditId(null);
    });

  const postSummary = (post: AdminRoadmapPost) => {
    const title = locale === "en" ? post.titleEn : post.titleZh;
    return [
      categoryLabel(post.categoryId),
      title,
      post.published ? t("admin.roadmap.published") : t("admin.roadmap.draft"),
      formatWhen(post.updatedAt, locale),
    ].join(" · ");
  };

  return (
    <div className="admin-portal__library">
      <section className="admin-portal__card">
        <h2>{t("admin.roadmap.publishTitle")}</h2>
        <p className="admin-portal__muted">{t("admin.roadmap.publishLead")}</p>
        <div className="admin-portal__form-grid">
          <label>
            <span>{t("admin.roadmap.category")}</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value as ApplicationLinkCategoryId)}
              disabled={submitting || busy}
            >
              {CATEGORY_IDS.map((id) => (
                <option key={id} value={id}>
                  {categoryLabel(id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("admin.roadmap.badge")}</span>
            <select
              value={badge}
              onChange={(e) => setBadge(e.target.value as ApplicationLinkBadge | "")}
              disabled={submitting || busy}
            >
              <option value="">{t("admin.roadmap.badgeNone")}</option>
              <option value="first">{t("appLinks.badgeFirst")}</option>
              <option value="recommended">{t("appLinks.badgeRecommended")}</option>
            </select>
          </label>
          <label className="admin-portal__form-span">
            <span>{t("admin.roadmap.href")}</span>
            <input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder={t("admin.roadmap.hrefPlaceholder")}
              disabled={submitting || busy}
            />
            <span className="admin-portal__hint">{t("admin.roadmap.hrefHint")}</span>
          </label>
          <div className="admin-portal__form-span">
            <AdminRoadmapCoverField
              token={token}
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              disabled={submitting || busy}
              onError={setPanelError}
            />
          </div>
          <label>
            <span>{t("admin.roadmap.titleZh")}</span>
            <input value={titleZh} onChange={(e) => setTitleZh(e.target.value)} disabled={submitting || busy} />
          </label>
          <label>
            <span>{t("admin.roadmap.titleEn")}</span>
            <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} disabled={submitting || busy} />
          </label>
          <label className="admin-portal__form-span">
            <span>{t("admin.roadmap.descriptionZh")}</span>
            <textarea
              value={descriptionZh}
              onChange={(e) => setDescriptionZh(e.target.value)}
              rows={2}
              disabled={submitting || busy}
            />
          </label>
          <label className="admin-portal__form-span">
            <span>{t("admin.roadmap.descriptionEn")}</span>
            <textarea
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              rows={2}
              disabled={submitting || busy}
            />
          </label>
          <label>
            <span>{t("admin.roadmap.sortOrder")}</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              disabled={submitting || busy}
            />
          </label>
          <label className="admin-portal__check">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              disabled={submitting || busy}
            />
            <span>{t("admin.roadmap.publishNow")}</span>
          </label>
        </div>
        <div className="admin-portal__library-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={submitting || busy || !titleZh.trim() || !titleEn.trim()}
            onClick={() => void submitCreate()}
          >
            {submitting ? t("admin.roadmap.publishing") : t("admin.roadmap.publish")}
          </button>
        </div>
        {panelError ? <p className="admin-portal__notice">{panelError}</p> : null}
      </section>

      <section className="admin-portal__card">
        <div className="admin-portal__card-head">
          <h2>{t("admin.roadmap.listTitle")}</h2>
          <button type="button" className="btn btn-secondary" disabled={loading || busy} onClick={() => void refresh()}>
            {t("admin.refresh")}
          </button>
        </div>
        {loading ? (
          <p className="admin-portal__muted">{t("admin.loading")}</p>
        ) : posts.length === 0 ? (
          <p className="admin-portal__muted">{t("admin.roadmap.empty")}</p>
        ) : (
          <ul className="admin-portal__library-list">
            {posts.map((post) => (
              <li key={post.id} className={post.published ? undefined : "is-inactive"}>
                {editId === post.id ? (
                  <div className="admin-portal__library-edit">
                    <div className="admin-portal__library-edit-row">
                      <select
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value as ApplicationLinkCategoryId)}
                      >
                        {CATEGORY_IDS.map((id) => (
                          <option key={id} value={id}>
                            {categoryLabel(id)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editBadge}
                        onChange={(e) => setEditBadge(e.target.value as ApplicationLinkBadge | "")}
                      >
                        <option value="">{t("admin.roadmap.badgeNone")}</option>
                        <option value="first">{t("appLinks.badgeFirst")}</option>
                        <option value="recommended">{t("appLinks.badgeRecommended")}</option>
                      </select>
                    </div>
                    <input
                      value={editHref}
                      onChange={(e) => setEditHref(e.target.value)}
                      placeholder="https://…"
                      aria-label={t("admin.roadmap.href")}
                    />
                    <AdminRoadmapCoverField
                      token={token}
                      value={editCoverImageUrl}
                      onChange={setEditCoverImageUrl}
                      disabled={busy}
                      onError={setPanelError}
                    />
                    <input value={editTitleZh} onChange={(e) => setEditTitleZh(e.target.value)} aria-label={t("admin.roadmap.titleZh")} />
                    <input value={editTitleEn} onChange={(e) => setEditTitleEn(e.target.value)} aria-label={t("admin.roadmap.titleEn")} />
                    <textarea
                      value={editDescriptionZh}
                      onChange={(e) => setEditDescriptionZh(e.target.value)}
                      rows={2}
                      aria-label={t("admin.roadmap.descriptionZh")}
                    />
                    <textarea
                      value={editDescriptionEn}
                      onChange={(e) => setEditDescriptionEn(e.target.value)}
                      rows={2}
                      aria-label={t("admin.roadmap.descriptionEn")}
                    />
                    <label className="admin-portal__check">
                      <input
                        type="checkbox"
                        checked={editPublished}
                        onChange={(e) => setEditPublished(e.target.checked)}
                      />
                      <span>{t("admin.roadmap.publishNow")}</span>
                    </label>
                    <div className="admin-portal__library-actions">
                      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveEdit()}>
                        {t("admin.library.save")}
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditId(null)}>
                        {t("admin.counselors.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="admin-portal__library-row">
                      <strong>{locale === "en" ? post.titleEn : post.titleZh}</strong>
                      {!post.published ? <span className="admin-portal__badge">{t("admin.roadmap.draft")}</span> : null}
                    </div>
                    <p className="admin-portal__muted">{postSummary(post)}</p>
                    {post.href ? <p className="admin-portal__muted">{post.href}</p> : <p className="admin-portal__muted">{t("admin.roadmap.noLink")}</p>}
                    <div className="admin-portal__library-actions">
                      {post.href ? (
                        <a className="btn btn-secondary" href={post.href} target="_blank" rel="noopener noreferrer">
                          {t("admin.library.testLink")}
                        </a>
                      ) : null}
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => startEdit(post)}>
                        {t("admin.library.edit")}
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void togglePublished(post)}>
                        {post.published ? t("admin.roadmap.unpublish") : t("admin.roadmap.publishNow")}
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void removePost(post)}>
                        {t("admin.library.delete")}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
