import { apiUrl } from "./apiBase";
import type { ApplicationLinkCategoryId, ApplicationRoadmapPost } from "../components/applicationLinks";

export type RoadmapPostRecord = ApplicationRoadmapPost & {
  categoryId: ApplicationLinkCategoryId;
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type RoadmapPostsByCategory = Partial<Record<ApplicationLinkCategoryId, ApplicationRoadmapPost[]>>;

function mapPublicPost(row: {
  id: string;
  category_id: string;
  href: string | null;
  cover_image_url?: string | null;
  title_zh: string;
  title_en: string;
  description_zh: string;
  description_en: string;
  badge: string | null;
  sort_order?: number;
  published_at?: string;
  created_at: string;
}): ApplicationRoadmapPost {
  return {
    id: row.id,
    categoryId: row.category_id as ApplicationLinkCategoryId,
    href: row.href ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    titleZh: row.title_zh,
    titleEn: row.title_en,
    descriptionZh: row.description_zh ?? "",
    descriptionEn: row.description_en ?? "",
    badge: row.badge === "first" || row.badge === "recommended" ? row.badge : undefined,
    publishedAt: row.created_at,
  };
}

export function groupRoadmapPosts(rows: ApplicationRoadmapPost[]): RoadmapPostsByCategory {
  const out: RoadmapPostsByCategory = {};
  for (const row of rows) {
    if (!out[row.categoryId]) out[row.categoryId] = [];
    out[row.categoryId]!.push(row);
  }
  return out;
}

export function flattenRoadmapPosts(byCategory: RoadmapPostsByCategory): ApplicationRoadmapPost[] {
  const rows: ApplicationRoadmapPost[] = [];
  for (const posts of Object.values(byCategory)) {
    if (posts) rows.push(...posts);
  }
  return rows.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export async function fetchPublishedRoadmapPosts(): Promise<RoadmapPostsByCategory> {
  const res = await fetch(apiUrl("/api/application-roadmap/posts"));
  const raw = await res.text();
  let body: { posts?: unknown[]; error?: string } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { error: "request_failed" };
  }
  if (!res.ok) {
    throw new Error(body.error || res.statusText || "request_failed");
  }
  const posts = Array.isArray(body.posts) ? body.posts : [];
  const mapped = posts.map((row) => mapPublicPost(row as Parameters<typeof mapPublicPost>[0]));
  return groupRoadmapPosts(mapped);
}
