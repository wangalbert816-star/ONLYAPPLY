/**
 * Application Roadmap resources.
 * - `links`: fixed official sites (curated in code).
 * - `posts`: team-published items (empty now; later from API / admin publish).
 */

export type ApplicationLinkBadge = "first" | "recommended";

/** Curated external link — copy lives in i18n (`appLinks.{id}` / `appLinks.desc{id}) */
export type ApplicationLinkItem = {
  id: string;
  href: string;
  badge?: ApplicationLinkBadge;
};

/** Pushed resource — copy on the record (not i18n keys). href optional for text-only tips. */
export type ApplicationRoadmapPost = {
  id: string;
  categoryId: ApplicationLinkCategoryId;
  href?: string | null;
  coverImageUrl?: string | null;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  badge?: ApplicationLinkBadge;
  publishedAt?: string;
};

export type ApplicationLinkCategoryId =
  | "submission"
  | "testing"
  | "essays"
  | "financial"
  | "majors"
  | "research"
  | "summer"
  | "scholarships"
  | "researchPrograms"
  | "official";

export type CuratedApplicationLinkId =
  | "commonApp"
  | "uc"
  | "collegeBoard"
  | "toefl"
  | "commonAppEssayPrompts"
  | "collegeEssayGuy"
  | "usNews"
  | "qs"
  | "wsj"
  | "niche"
  | "collegeNavigator"
  | "educationUsa";

export type ApplicationLinkCategory = {
  categoryId: ApplicationLinkCategoryId;
  links: readonly ApplicationLinkItem[];
};

export const APPLICATION_LINK_CATEGORIES: readonly ApplicationLinkCategory[] = [
  {
    categoryId: "submission",
    links: [
      { id: "commonApp", href: "https://www.commonapp.org/", badge: "first" },
      {
        id: "uc",
        href: "https://apply.universityofcalifornia.edu/",
        badge: "recommended",
      },
    ],
  },
  {
    categoryId: "testing",
    links: [
      { id: "collegeBoard", href: "https://www.collegeboard.org/" },
      { id: "toefl", href: "https://www.ets.org/toefl" },
    ],
  },
  {
    categoryId: "essays",
    links: [
      { id: "commonAppEssayPrompts", href: "https://www.commonapp.org/apply/essay-prompts" },
      { id: "collegeEssayGuy", href: "https://www.collegeessayguy.com/" },
    ],
  },
  {
    categoryId: "financial",
    links: [],
  },
  {
    categoryId: "majors",
    links: [],
  },
  {
    categoryId: "research",
    links: [
      {
        id: "usNews",
        href: "https://www.usnews.com/best-colleges/rankings/national-universities",
      },
      {
        id: "qs",
        href: "https://www.topuniversities.com/university-rankings/world-university-rankings",
      },
      { id: "wsj", href: "https://www.wsj.com/rankings/college-rankings" },
      { id: "niche", href: "https://www.niche.com/colleges" },
      { id: "collegeNavigator", href: "https://nces.ed.gov/collegenavigator" },
    ],
  },
  {
    categoryId: "summer",
    links: [],
  },
  {
    categoryId: "scholarships",
    links: [],
  },
  {
    categoryId: "researchPrograms",
    links: [],
  },
  {
    categoryId: "official",
    links: [{ id: "educationUsa", href: "https://educationusa.state.gov/" }],
  },
];

export function applicationLinkHost(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}
