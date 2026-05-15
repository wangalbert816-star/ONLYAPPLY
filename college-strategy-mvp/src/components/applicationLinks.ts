/** 全屏「常用申请站」外链（与界面语言无关的 URL） */
export const APPLICATION_LINKS = [
  { id: "commonApp" as const, href: "https://www.commonapp.org/" },
  { id: "uc" as const, href: "https://apply.universityofcalifornia.edu/" },
  {
    id: "usNews" as const,
    href: "https://www.usnews.com/best-colleges/rankings/national-universities",
  },
  {
    id: "qs" as const,
    href: "https://www.topuniversities.com/university-rankings/world-university-rankings",
  },
  { id: "collegeBoard" as const, href: "https://www.collegeboard.org/" },
] as const;

export type ApplicationLinkId = (typeof APPLICATION_LINKS)[number]["id"];

export function displayHost(href: string): string {
  try {
    const u = new URL(href);
    return u.host + (u.pathname === "/" ? "" : u.pathname.replace(/\/$/, ""));
  } catch {
    return href.replace(/^https?:\/\//i, "");
  }
}
