import type { Locale } from "../i18n/strings";
import { schoolNameLookupVariants } from "./schoolNameResolve";

export type SchoolSnippet = {
  campusVibeZh: string;
  campusVibeEn: string;
  contextNoteZh: string;
  contextNoteEn: string;
};

type SnippetEntry = { patterns: RegExp[]; snippet: SchoolSnippet };

const SNIPPETS: SnippetEntry[] = [
  {
    patterns: [/berkeley|伯克利/i],
    snippet: {
      campusVibeZh: "学术导向 · 研究/公共议题氛围强，湾区实习与创业密度高",
      campusVibeEn: "Academic · research-heavy, Bay Area internships and startup density",
      contextNoteZh: "请用官网 CDS/录取页核对国际生奖助与 CS 等容量受限专业政策；勿依赖第三方录取率。",
      contextNoteEn: "Verify intl aid and capacity majors (e.g. CS) on the official CDS/admissions pages—do not rely on third-party admit rates.",
    },
  },
  {
    patterns: [/\bucla\b|洛杉矶分校/i],
    snippet: {
      campusVibeZh: "城市校园 · 社交/社团活跃，体育文化强，LA 实习机会多",
      campusVibeEn: "Urban campus · active social life, strong athletics, LA internship access",
      contextNoteZh: "加州居民/外州/国际生在费用与奖助口径不同，需分别核对 net price calculator。",
      contextNoteEn: "In-state, out-of-state, and international cost/aid rules differ—check each net price calculator.",
    },
  },
  {
    patterns: [/texas at austin|\but austin\b/i],
    snippet: {
      campusVibeZh: "大型公立 · 体育与社团文化强，McCombs/工程资源集中",
      campusVibeEn: "Large public · strong athletics and clubs; McCombs/engineering hubs",
      contextNoteZh: "德州居民通过 ApplyTexas 有独立政策口径；国际生/外州费用与自动奖助规则需在官网核对。",
      contextNoteEn: "Texas residents use ApplyTexas with distinct rules; intl/out-of-state cost and auto-merit aid need official verification.",
    },
  },
  {
    patterns: [/michigan|umich/i],
    snippet: {
      campusVibeZh: "研究型大校 · 体育文化+学术并重，安娜堡小城社区感",
      campusVibeEn: "Research university · athletics plus academics; college-town community in Ann Arbor",
      contextNoteZh: "工程/商等学院可能有额外申请或容量限制；国际生奖助政策以官网当年为准。",
      contextNoteEn: "Engineering/business may have extra requirements or capacity limits; intl aid per official site for the cycle.",
    },
  },
  {
    patterns: [/usc\b|southern california/i],
    snippet: {
      campusVibeZh: "私立城市校 · 校友网络与实习强，社团/传媒氛围活跃",
      campusVibeEn: "Private urban · strong alumni/internships; active media and club culture",
      contextNoteZh: "费用与 merit 奖助需用官网 net price/merit 页核对；勿引用未注明来源的录取率。",
      contextNoteEn: "Confirm cost and merit aid via official net price pages—no unsourced admit-rate claims.",
    },
  },
];

export function lookupSchoolSnippet(school: string): SchoolSnippet | null {
  const variants = schoolNameLookupVariants(school);
  for (const name of variants) {
    for (const entry of SNIPPETS) {
      if (entry.patterns.some((re) => re.test(name))) return entry.snippet;
    }
  }
  return null;
}

export function snippetCampusVibe(school: string, locale: Locale): string | null {
  const s = lookupSchoolSnippet(school);
  if (!s) return null;
  return locale === "en" ? s.campusVibeEn : s.campusVibeZh;
}

export function snippetContextNote(school: string, locale: Locale): string | null {
  const s = lookupSchoolSnippet(school);
  if (!s) return null;
  return locale === "en" ? s.contextNoteEn : s.contextNoteZh;
}
