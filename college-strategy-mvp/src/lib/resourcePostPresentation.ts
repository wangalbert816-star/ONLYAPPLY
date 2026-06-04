import type { ApplicationLinkCategoryId } from "../components/applicationLinks";

export type ResourcesFilter = "all" | ApplicationLinkCategoryId;

export const CATEGORY_COVER_THEME: Record<
  ApplicationLinkCategoryId,
  { gradient: string; pattern: string }
> = {
  submission: {
    gradient: "linear-gradient(145deg, #0f3d5c 0%, #1d6fa8 55%, #3b9edd 100%)",
    pattern: "radial-gradient(circle at 82% 18%, rgba(255,255,255,0.22) 0%, transparent 42%)",
  },
  testing: {
    gradient: "linear-gradient(145deg, #1a3d2f 0%, #2d6b4f 55%, #4caf82 100%)",
    pattern: "radial-gradient(circle at 18% 78%, rgba(255,255,255,0.18) 0%, transparent 45%)",
  },
  essays: {
    gradient: "linear-gradient(145deg, #3d2a14 0%, #8b5a2b 55%, #c49a6c 100%)",
    pattern: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.2) 0%, transparent 40%)",
  },
  financial: {
    gradient: "linear-gradient(145deg, #1f2937 0%, #374151 50%, #6b7280 100%)",
    pattern: "radial-gradient(circle at 30% 40%, rgba(255,255,255,0.15) 0%, transparent 50%)",
  },
  majors: {
    gradient: "linear-gradient(145deg, #312e81 0%, #4f46e5 55%, #818cf8 100%)",
    pattern: "radial-gradient(circle at 75% 65%, rgba(255,255,255,0.2) 0%, transparent 42%)",
  },
  research: {
    gradient: "linear-gradient(145deg, #134e4a 0%, #0f766e 55%, #2dd4bf 100%)",
    pattern: "radial-gradient(circle at 20% 25%, rgba(255,255,255,0.18) 0%, transparent 48%)",
  },
  summer: {
    gradient: "linear-gradient(145deg, #9a3412 0%, #ea580c 55%, #fdba74 100%)",
    pattern: "radial-gradient(circle at 60% 80%, rgba(255,255,255,0.22) 0%, transparent 45%)",
  },
  scholarships: {
    gradient: "linear-gradient(145deg, #713f12 0%, #ca8a04 55%, #fde047 100%)",
    pattern: "radial-gradient(circle at 40% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)",
  },
  researchPrograms: {
    gradient: "linear-gradient(145deg, #1e1b4b 0%, #4338ca 55%, #a78bfa 100%)",
    pattern: "radial-gradient(circle at 85% 50%, rgba(255,255,255,0.18) 0%, transparent 46%)",
  },
  official: {
    gradient: "linear-gradient(145deg, #1e3a5f 0%, #2563eb 55%, #60a5fa 100%)",
    pattern: "radial-gradient(circle at 15% 60%, rgba(255,255,255,0.2) 0%, transparent 44%)",
  },
};

export function excerptText(text: string, max = 140): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}
