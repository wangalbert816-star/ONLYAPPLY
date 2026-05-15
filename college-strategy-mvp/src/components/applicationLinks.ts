/** 全屏「申请流程导航」外链；按申请流程分组，每类 2–4 个核心站 */

export type ApplicationLinkBadge = "first" | "recommended";

export const APPLICATION_LINK_CATEGORIES = [
  {
    categoryId: "submission" as const,
    links: [
      {
        id: "commonApp" as const,
        href: "https://www.commonapp.org/",
        badge: "first" as const,
      },
      {
        id: "uc" as const,
        href: "https://apply.universityofcalifornia.edu/",
        badge: "recommended" as const,
      },
    ],
  },
  {
    categoryId: "testing" as const,
    links: [
      { id: "collegeBoard" as const, href: "https://www.collegeboard.org/" },
      { id: "toefl" as const, href: "https://www.ets.org/toefl" },
    ],
  },
  {
    categoryId: "research" as const,
    links: [
      {
        id: "usNews" as const,
        href: "https://www.usnews.com/best-colleges/rankings/national-universities",
      },
      {
        id: "qs" as const,
        href: "https://www.topuniversities.com/university-rankings/world-university-rankings",
      },
      { id: "niche" as const, href: "https://www.niche.com/colleges" },
      { id: "collegeNavigator" as const, href: "https://nces.ed.gov/collegenavigator" },
    ],
  },
  {
    categoryId: "essays" as const,
    links: [
      {
        id: "commonAppEssayPrompts" as const,
        href: "https://www.commonapp.org/apply/essay-prompts",
      },
      { id: "collegeEssayGuy" as const, href: "https://www.collegeessayguy.com/" },
    ],
  },
  {
    categoryId: "official" as const,
    links: [{ id: "educationUsa" as const, href: "https://educationusa.state.gov/" }],
  },
] as const;

export type ApplicationLinkCategoryId = (typeof APPLICATION_LINK_CATEGORIES)[number]["categoryId"];
export type ApplicationLinkId = (typeof APPLICATION_LINK_CATEGORIES)[number]["links"][number]["id"];
