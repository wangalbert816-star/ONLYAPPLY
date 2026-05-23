import { schoolNameLookupVariants } from "./schoolNameResolve";

export type OfficialSchoolLink = {
  id: string;
  labelZh: string;
  labelEn: string;
  href: string;
};

type SchoolEntry = {
  patterns: RegExp[];
  cds?: string;
  campus?: string;
  links: Array<{ id: string; labelZh: string; labelEn: string; path: string }>;
};

const CDS_LABEL = { labelZh: "Common Data Set / 录取数据", labelEn: "Common Data Set" };
const CAMPUS_LABEL = { labelZh: "校园生活", labelEn: "Campus life" };

/** Curated official paths; unknown schools fall back to College Navigator search（第三期 #58 规模化） */
const ENTRIES: SchoolEntry[] = [
  {
    patterns: [/berkeley|伯克利/i],
    cds: "https://opa.berkeley.edu/campus-data/common-data-set",
    campus: "https://visit.berkeley.edu/",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.berkeley.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.berkeley.edu/" },
      { id: "majors", labelZh: "专业探索", labelEn: "Majors", path: "https://www.berkeley.edu/atoz/" },
    ],
  },
  {
    patterns: [/\bucla\b|洛杉矶分校/i],
    cds: "https://admission.ucla.edu/about/common-data-set",
    campus: "https://www.ucla.edu/about/campus-life",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.ucla.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.ucla.edu/" },
      { id: "majors", labelZh: "专业目录", labelEn: "Majors & degrees", path: "https://catalog.registrar.ucla.edu/" },
    ],
  },
  {
    patterns: [/stanford/i, /斯坦福/],
    cds: "https://ucomm.stanford.edu/cds/",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.stanford.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.stanford.edu/" },
    ],
  },
  {
    patterns: [/harvard/i, /哈佛/],
    cds: "https://oira.harvard.edu/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "College admissions", path: "https://college.harvard.edu/admissions" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://college.harvard.edu/financial-aid" },
    ],
  },
  {
    patterns: [/mit\b|massachusetts institute/i],
    cds: "https://ir.mit.edu/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://mitadmissions.org/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Student financial services", path: "https://sfs.mit.edu/" },
    ],
  },
  {
    patterns: [/yale/i, /耶鲁/],
    cds: "https://oir.yale.edu/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.yale.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://finaid.yale.edu/" },
    ],
  },
  {
    patterns: [/princeton/i, /普林斯顿/],
    cds: "https://registrar.princeton.edu/university-reporting/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.princeton.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://finaid.princeton.edu/" },
    ],
  },
  {
    patterns: [/columbia/i, /哥伦比亚/],
    cds: "https://opir.columbia.edu/content/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://undergrad.admissions.columbia.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://cc-seas.financialaid.columbia.edu/" },
    ],
  },
  {
    patterns: [/upenn|penn\b|university of pennsylvania/i],
    cds: "https://ira.upenn.edu/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.upenn.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://srfs.upenn.edu/financial-aid" },
    ],
  },
  {
    patterns: [/duke/i, /杜克/],
    cds: "https://provost.duke.edu/institutional-research/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.duke.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.duke.edu/" },
    ],
  },
  {
    patterns: [/northwestern/i, /西北大学/],
    cds: "https://www.northwestern.edu/provost/about/data/common-data-set.html",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admissions.northwestern.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.northwestern.edu/financial-aid/" },
    ],
  },
  {
    patterns: [/cornell/i, /康奈尔/],
    cds: "https://irp.dpb.cornell.edu/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.cornell.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://finaid.cornell.edu/" },
    ],
  },
  {
    patterns: [/brown/i, /布朗/],
    cds: "https://www.brown.edu/about/administration/institutional-research/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.brown.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.brown.edu/" },
    ],
  },
  {
    patterns: [/dartmouth/i, /达特茅斯/],
    cds: "https://www.dartmouth.edu/oir/data-reporting/common-data-set.html",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.dartmouth.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.dartmouth.edu/" },
    ],
  },
  {
    patterns: [/uchicago|university of chicago/i],
    cds: "https://data.uchicago.edu/common-data-set/",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "College admissions", path: "https://collegeadmissions.uchicago.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.uchicago.edu/" },
    ],
  },
  {
    patterns: [/uc san diego|ucsd/i],
    cds: "https://admissions.ucsd.edu/about/common-data-set.html",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "UCSD admissions", path: "https://admissions.ucsd.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://fas.ucsd.edu/" },
    ],
  },
  {
    patterns: [/uc irvine|uci\b/i],
    cds: "https://admissions.uci.edu/about/common-data-set.html",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "UCI admissions", path: "https://admissions.uci.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.ofas.uci.edu/" },
    ],
  },
  {
    patterns: [/uc davis/i],
    cds: "https://admissions.ucdavis.edu/about/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "UC Davis admissions", path: "https://admissions.ucdavis.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.ucdavis.edu/" },
    ],
  },
  {
    patterns: [/uc santa barbara|ucsb/i],
    cds: "https://admissions.sa.ucsb.edu/about/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "UCSB admissions", path: "https://admissions.sa.ucsb.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.finaid.ucsb.edu/" },
    ],
  },
  {
    patterns: [/uc riverside|ucr\b/i],
    cds: "https://admissions.ucr.edu/about/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "UCR admissions", path: "https://admissions.ucr.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.ucr.edu/" },
    ],
  },
  {
    patterns: [/university of michigan|umich|\bu m\b/i],
    cds: "https://admissions.umich.edu/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.umich.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://finaid.umich.edu/" },
    ],
  },
  {
    patterns: [/nyu|new york university/i],
    cds: "https://www.nyu.edu/about/news-publications/nyu-data.html",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://www.nyu.edu/admissions/undergraduate-admissions.html" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.nyu.edu/admissions/financial-aid-and-scholarships.html" },
    ],
  },
  {
    patterns: [/usc\b|southern california/i],
    cds: "https://oir.usc.edu/common-data-set/",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.usc.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.usc.edu/" },
    ],
  },
  {
    patterns: [/texas at austin|\but austin\b/i, /德州奥斯汀/],
    cds: "https://reports.utexas.edu/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.utexas.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://onestop.utexas.edu/financial-aid/" },
      { id: "applytexas", labelZh: "ApplyTexas 申请", labelEn: "ApplyTexas", path: "https://www.applytexas.org/" },
    ],
  },
  {
    patterns: [/georgia tech|georgia institute of technology/i],
    cds: "https://www.irp.gatech.edu/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.gatech.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://finaid.gatech.edu/" },
    ],
  },
  {
    patterns: [/university of illinois|uiuc\b/i],
    cds: "https://illinois.edu/about/ir/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.illinois.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://osfa.illinois.edu/" },
    ],
  },
  {
    patterns: [/university of washington|\buw\b(?!\s*madison)/i],
    cds: "https://www.washington.edu/data/common-data-set/",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admit.washington.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.washington.edu/financialaid/" },
    ],
  },
  {
    patterns: [/purdue/i],
    cds: "https://www.purdue.edu/data-tools/common-data-set.php",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.purdue.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.purdue.edu/dfa/" },
    ],
  },
  {
    patterns: [/carnegie mellon|\bcmu\b/i],
    cds: "https://www.cmu.edu/ira/common-data-set/",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://www.cmu.edu/admission/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.cmu.edu/sfs/" },
    ],
  },
  {
    patterns: [/vanderbilt/i],
    cds: "https://www.vanderbilt.edu/oir/common-data-set/",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admissions", path: "https://admissions.vanderbilt.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://www.vanderbilt.edu/financialaid/" },
    ],
  },
  {
    patterns: [/rice university|\brice\b/i],
    cds: "https://oir.rice.edu/common-data-set",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://admission.rice.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.rice.edu/" },
    ],
  },
  {
    patterns: [/emory/i],
    cds: "https://www.emory.edu/home/about/facts-figures/common-data-set.html",
    links: [
      { id: "adm", labelZh: "本科招生", labelEn: "Undergraduate admission", path: "https://apply.emory.edu/" },
      { id: "aid", labelZh: "奖助学金", labelEn: "Financial aid", path: "https://financialaid.emory.edu/" },
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

function entryToLinks(entry: SchoolEntry): OfficialSchoolLink[] {
  const out: OfficialSchoolLink[] = entry.links.map((l) => ({
    id: l.id,
    labelZh: l.labelZh,
    labelEn: l.labelEn,
    href: l.path,
  }));
  if (entry.cds) {
    out.push({ id: "cds", href: entry.cds, ...CDS_LABEL });
  }
  if (entry.campus) {
    out.push({ id: "campus", href: entry.campus, ...CAMPUS_LABEL });
  }
  return out;
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
    links.push(
      {
        id: "ucapp",
        labelZh: "UC 申请系统",
        labelEn: "UC Application",
        href: "https://apply.universityofcalifornia.edu/",
      },
      {
        id: "uc_cds",
        labelZh: "UC 系统数据说明",
        labelEn: "UC system data",
        href: "https://www.universityofcalifornia.edu/about-us/information-center",
      },
    );
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
  const variants = schoolNameLookupVariants(school.trim());
  for (const name of variants) {
    for (const entry of ENTRIES) {
      if (entry.patterns.some((re) => re.test(name))) {
        return entryToLinks(entry);
      }
    }
  }
  return fallbackLinks(school.trim());
}

/** 运营维护的校名库规模（供调试/展示） */
export function curatedOfficialLinkSchoolCount(): number {
  return ENTRIES.length;
}

export function officialLinkLabel(link: OfficialSchoolLink, locale: "zh" | "en"): string {
  return locale === "en" ? link.labelEn : link.labelZh;
}
