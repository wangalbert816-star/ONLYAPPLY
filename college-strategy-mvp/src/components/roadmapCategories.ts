import type { ApplicationLinkCategoryId } from "./applicationLinks";

export const ROADMAP_CATEGORY_LABEL_KEY: Record<ApplicationLinkCategoryId, string> = {
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

export function roadmapSectionDomId(categoryId: ApplicationLinkCategoryId): string {
  return `fs-cat-${categoryId}`;
}
