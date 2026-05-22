import type { OfficialLink, SchoolRow } from "../types";

type LinkTemplate = { labelZh: string; labelEn: string; path: string };

const HOST_RULES: Array<{ test: RegExp; host: string; templates: LinkTemplate[] }> = [
  {
    test: /berkeley|伯克利/i,
    host: "https://admissions.berkeley.edu",
    templates: [
      { labelZh: "本科招生", labelEn: "Undergraduate admission", path: "/" },
      { labelZh: "专业探索", labelEn: "Majors", path: "/discover-berkeley/majors" },
      { labelZh: "奖助信息", labelEn: "Financial aid", path: "/apply-to-berkeley/financial-aid" },
    ],
  },
  {
    test: /ucla/i,
    host: "https://admission.ucla.edu",
    templates: [
      { labelZh: "本科招生", labelEn: "Admission", path: "/" },
      { labelZh: "专业方向", labelEn: "Majors", path: "/majors" },
      { labelZh: "费用与奖助", labelEn: "Costs & aid", path: "/tuition-aid" },
    ],
  },
  {
    test: /university of california|uc\s|ucsd|ucsb|uci|davis|riverside|merced|santa cruz/i,
    host: "https://admission.universityofcalifornia.edu",
    templates: [
      { labelZh: "UC 申请系统", labelEn: "UC Application", path: "/" },
      { labelZh: "校区与专业", labelEn: "Campuses & majors", path: "/campuses-majors" },
      { labelZh: "费用与奖助", labelEn: "Costs & aid", path: "/tuition-financial-aid" },
    ],
  },
  {
    test: /mit\b/i,
    host: "https://mitadmissions.org",
    templates: [
      { labelZh: "本科招生", labelEn: "Admission", path: "/" },
      { labelZh: "专业与课程", labelEn: "Majors", path: "/discover/majors-minors" },
    ],
  },
  {
    test: /stanford/i,
    host: "https://admission.stanford.edu",
    templates: [
      { labelZh: "本科招生", labelEn: "Admission", path: "/" },
      { labelZh: "专业", labelEn: "Academics", path: "/academics/" },
    ],
  },
];

const GENERIC: LinkTemplate[] = [
  { labelZh: "招生官网检索", labelEn: "Search official site", path: "" },
];

function buildLinks(school: string, locale: "zh" | "en"): OfficialLink[] {
  const name = school.trim();
  for (const rule of HOST_RULES) {
    if (!rule.test.test(name)) continue;
    return rule.templates.map((t) => ({
      label: locale === "en" ? t.labelEn : t.labelZh,
      url: `${rule.host}${t.path}`,
    }));
  }
  const q = encodeURIComponent(`${name} undergraduate admission official`);
  return [
    {
      label: locale === "en" ? GENERIC[0].labelEn : GENERIC[0].labelZh,
      url: `https://www.google.com/search?q=${q}`,
    },
  ];
}

export function enrichSchoolRow(row: SchoolRow, locale: "zh" | "en"): SchoolRow {
  const links =
    row.official_links && row.official_links.length > 0
      ? row.official_links
      : buildLinks(row.school, locale);
  return { ...row, official_links: links };
}

export function enrichReportSchoolRows<T extends { reach?: SchoolRow[]; match?: SchoolRow[]; safety?: SchoolRow[] }>(
  report: T,
  locale: "zh" | "en",
): T {
  const mapRows = (rows?: SchoolRow[]) => (rows ?? []).map((r) => enrichSchoolRow(r, locale));
  return {
    ...report,
    reach: mapRows(report.reach),
    match: mapRows(report.match),
    safety: mapRows(report.safety),
  };
}
