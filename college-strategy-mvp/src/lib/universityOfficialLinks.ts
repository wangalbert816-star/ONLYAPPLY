export type OfficialSchoolLink = {
  id: string;
  labelZh: string;
  labelEn: string;
  href: string;
};

type SchoolEntry = {
  patterns: RegExp[];
  links: Array<{ id: string; labelZh: string; labelEn: string; path: string }>;
};

/** Curated official paths; unknown schools fall back to College Navigator search */
const ENTRIES: SchoolEntry[] = [
  {
    patterns: [/berkeley|伯克利/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.berkeley.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.berkeley.edu/" },
      { id: "majors", labelZh: "专业探索", labelEn: "Majors", path: "https://www.berkeley.edu/atoz/" },
    ],
  },
  {
    patterns: [/\bucla\b|洛杉矶分校/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.ucla.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.ucla.edu/" },
      { id: "majors", labelZh: "专业目录", labelEn: "Majors & degrees", path: "https://catalog.registrar.ucla.edu/" },
    ],
  },
  {
    patterns: [/stanford/i, /斯坦福/],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.stanford.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.stanford.edu/" },
    ],
  },
  {
    patterns: [/harvard/i, /哈佛/],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "College admissions", path: "https://college.harvard.edu/admissions" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://college.harvard.edu/financial-aid" },
    ],
  },
  {
    patterns: [/mit\b|massachusetts institute/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://mitadmissions.org/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Student financial services", path: "https://sfs.mit.edu/" },
    ],
  },
  {
    patterns: [/yale/i, /耶鲁/],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.yale.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://finaid.yale.edu/" },
    ],
  },
  {
    patterns: [/princeton/i, /普林斯顿/],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.princeton.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://finaid.princeton.edu/" },
    ],
  },
  {
    patterns: [/columbia/i, /哥伦比亚/],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://undergrad.admissions.columbia.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://cc-seas.financialaid.columbia.edu/" },
    ],
  },
  {
    patterns: [/upenn|penn\b|university of pennsylvania/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.upenn.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://srfs.upenn.edu/financial-aid" },
    ],
  },
  {
    patterns: [/duke/i, /杜克/],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.duke.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.duke.edu/" },
    ],
  },
  {
    patterns: [/northwestern/i, /西北大学/],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admissions.northwestern.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.northwestern.edu/financial-aid/" },
    ],
  },
  {
    patterns: [/cornell/i, /康奈尔/],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.cornell.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://finaid.cornell.edu/" },
    ],
  },
  {
    patterns: [/brown/i, /布朗/],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.brown.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.brown.edu/" },
    ],
  },
  {
    patterns: [/dartmouth/i, /达特茅斯/],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.dartmouth.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.dartmouth.edu/" },
    ],
  },
  {
    patterns: [/uchicago|university of chicago/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "College admissions", path: "https://collegeadmissions.uchicago.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.uchicago.edu/" },
    ],
  },
  {
    patterns: [/uc san diego|ucsd/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "UCSD admissions", path: "https://admissions.ucsd.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://fas.ucsd.edu/" },
    ],
  },
  {
    patterns: [/uc irvine|uci\b/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "UCI admissions", path: "https://admissions.uci.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.ofas.uci.edu/" },
    ],
  },
  {
    patterns: [/uc davis/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "UC Davis admissions", path: "https://admissions.ucdavis.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.ucdavis.edu/" },
    ],
  },
  {
    patterns: [/uc santa barbara|ucsb/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "UCSB admissions", path: "https://admissions.sa.ucsb.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.finaid.ucsb.edu/" },
    ],
  },
  {
    patterns: [/uc riverside|ucr\b/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "UCR admissions", path: "https://admissions.ucr.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.ucr.edu/" },
    ],
  },
  {
    patterns: [/university of michigan|umich|\bu m\b/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.umich.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://finaid.umich.edu/" },
    ],
  },
  {
    patterns: [/nyu|new york university/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://www.nyu.edu/admissions/undergraduate-admissions.html" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.nyu.edu/admissions/financial-aid-and-scholarships.html" },
    ],
  },
  {
    patterns: [/usc\b|southern california/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.usc.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.usc.edu/" },
    ],
  },
  {
    patterns: [/texas at austin|\but austin\b/i, /德州奥斯汀/],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.utexas.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://onestop.utexas.edu/financial-aid/" },
      { id: "applytexas", labelZh: "ApplyTexas 申请", labelEn: "ApplyTexas", path: "https://www.applytexas.org/" },
    ],
  },
  {
    patterns: [/georgia tech|georgia institute of technology/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.gatech.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://finaid.gatech.edu/" },
    ],
  },
  {
    patterns: [/university of illinois|uiuc\b/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.illinois.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://osfa.illinois.edu/" },
    ],
  },
  {
    patterns: [/university of washington|\buw\b(?!\s*madison)/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admit.washington.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.washington.edu/financialaid/" },
    ],
  },
  {
    patterns: [/purdue/i],
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.purdue.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.purdue.edu/dfa/" },
    ],
  },
];

const UC_CAMPUS_RE =
  /\buniversity of california\b|\buc\s+(berkeley|los angeles|san diego|irvine|davis|santa barbara|riverside|merced|santa cruz|san francisco)\b/i;

const TEXAS_PUBLIC_RE =
  /\buniversity of texas\b|texas a\s*&\s*m|texas tech|university of houston|\but\s+(dallas|arlington|san antonio)\b|texas state/i;

function isUcCampus(school: string): boolean {
  const name = school.trim();
  if (/\btexas\b/i.test(name) && !/california/i.test(name)) return false;
  return UC_CAMPUS_RE.test(name);
}

function isTexasPublic(school: string): boolean {
  return TEXAS_PUBLIC_RE.test(school.trim());
}

function fallbackLinks(school: string): OfficialSchoolLink[] {
  const q = encodeURIComponent(school.trim());
  const links: OfficialSchoolLink[] = [
    {
      id: "nav",
      labelZh: "College Navigator 检索",
      labelEn: "College Navigator lookup",
      href: `https://nces.ed.gov/collegenavigator/?s=all&search=${q}`,
    },
  ];

  if (isUcCampus(school)) {
    links.push({
      id: "ucapp",
      labelZh: "UC 申请系统",
      labelEn: "UC Application",
      href: "https://apply.universityofcalifornia.edu/",
    });
  } else if (isTexasPublic(school)) {
    links.push({
      id: "applytexas",
      labelZh: "ApplyTexas 申请",
      labelEn: "ApplyTexas",
      href: "https://www.applytexas.org/",
    });
  } else {
    links.push({
      id: "commonapp",
      labelZh: "Common App 院校查询",
      labelEn: "Common App college search",
      href: "https://www.commonapp.org/explore/",
    });
  }

  return links;
}

export function getOfficialLinksForSchool(school: string, _locale: "zh" | "en"): OfficialSchoolLink[] {
  const name = school.trim();
  for (const entry of ENTRIES) {
    if (entry.patterns.some((re) => re.test(name))) {
      return entry.links.map((l) => ({
        id: l.id,
        labelZh: l.labelZh,
        labelEn: l.labelEn,
        href: l.path,
      }));
    }
  }
  return fallbackLinks(name).map((l) => ({
    ...l,
    labelZh: l.labelZh,
    labelEn: l.labelEn,
  }));
}

export function officialLinkLabel(link: OfficialSchoolLink, locale: "zh" | "en"): string {
  return locale === "en" ? link.labelEn : link.labelZh;
}
