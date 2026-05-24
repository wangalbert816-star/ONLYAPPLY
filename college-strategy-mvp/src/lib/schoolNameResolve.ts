/** LLM 常输出法定校名 / 中文校名；映射到链接库 / snippet 可识别的别名 */

export function normalizeSchoolNameInput(name: string): string {
  return String(name || "")
    .trim()
    .replace(/^the\s+/i, "")
    .replace(/[—–\-_,]/g, " ")
    .replace(/\(\s*[^\)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_RULES: Array<{ re: RegExp; aliases: string[] }> = [
  // UC system — full legal names lack campus abbreviations
  { re: /university of california,?\s*los angeles|uc\s*los\s*angeles|洛杉矶分校/i, aliases: ["UCLA"] },
  { re: /university of california,?\s*berkeley|uc\s*berkeley|伯克利/i, aliases: ["Berkeley", "UC Berkeley"] },
  { re: /university of california,?\s*san\s*diego|uc\s*san\s*diego/i, aliases: ["UCSD", "UC San Diego"] },
  { re: /university of california,?\s*irvine|uc\s*irvine/i, aliases: ["UCI", "UC Irvine"] },
  { re: /university of california,?\s*davis|uc\s*davis/i, aliases: ["UC Davis"] },
  { re: /university of california,?\s*santa\s*barbara|uc\s*santa\s*barbara/i, aliases: ["UCSB", "UC Santa Barbara"] },
  { re: /university of california,?\s*riverside|uc\s*riverside/i, aliases: ["UCR", "UC Riverside"] },
  { re: /university of california,?\s*santa\s*cruz|uc\s*santa\s*cruz/i, aliases: ["UCSC", "UC Santa Cruz"] },
  { re: /university of california,?\s*merced|uc\s*merced/i, aliases: ["UC Merced"] },
  // Ivy+ & top private
  { re: /stanford university|^stanford$|斯坦福/i, aliases: ["Stanford"] },
  { re: /harvard university|^harvard$|哈佛/i, aliases: ["Harvard"] },
  { re: /massachusetts institute of technology|^mit$|麻省理工/i, aliases: ["MIT"] },
  { re: /yale university|^yale$|耶鲁/i, aliases: ["Yale"] },
  { re: /princeton university|^princeton$|普林斯顿/i, aliases: ["Princeton"] },
  { re: /columbia university|^columbia$|哥伦比亚/i, aliases: ["Columbia"] },
  {
    re: /university of pennsylvania|^upenn$|^penn$|宾夕法尼亚|宾大/i,
    aliases: ["UPenn", "Penn", "University of Pennsylvania"],
  },
  { re: /duke university|^duke$|杜克/i, aliases: ["Duke"] },
  { re: /northwestern university|^northwestern$|西北大学/i, aliases: ["Northwestern"] },
  { re: /cornell university|^cornell$|康奈尔/i, aliases: ["Cornell"] },
  { re: /brown university|^brown$|布朗/i, aliases: ["Brown"] },
  { re: /dartmouth college|^dartmouth$|达特茅斯/i, aliases: ["Dartmouth"] },
  { re: /university of chicago|^uchicago$|芝加哥大学/i, aliases: ["UChicago", "University of Chicago"] },
  // Major publics & tech
  { re: /university of michigan(?:\s*-\s*ann\s*arbor)?|\bumich\b|密歇根/i, aliases: ["University of Michigan", "UMich"] },
  { re: /new york university|^nyu$|纽约大学/i, aliases: ["NYU", "New York University"] },
  { re: /university of southern california|^usc$|南加州大学/i, aliases: ["USC", "Southern California"] },
  { re: /university of texas at austin|\but\s*austin\b|德州奥斯汀/i, aliases: ["UT Austin", "Texas at Austin"] },
  {
    re: /university of north carolina(?:\s+at\s+)?chapel\s*hill|\bunc\b|北卡罗来纳|教堂山/i,
    aliases: ["UNC", "UNC Chapel Hill", "North Carolina Chapel Hill"],
  },
  {
    re: /georgia institute of technology|^georgia tech$|\bgt\b|佐治亚理工/i,
    aliases: ["Georgia Tech", "Georgia Institute of Technology"],
  },
  {
    re: /university of illinois(?:\s*-\s*|\s+at\s+)urbana|uiuc|伊利诺伊/i,
    aliases: ["UIUC", "University of Illinois"],
  },
  {
    re: /university of washington(?!.*st\.?\s*louis)|^uw$|华盛顿大学/i,
    aliases: ["University of Washington", "UW"],
  },
  { re: /purdue university|^purdue$|普渡/i, aliases: ["Purdue"] },
  { re: /carnegie mellon university|^cmu$|卡内基梅隆/i, aliases: ["CMU", "Carnegie Mellon"] },
  { re: /vanderbilt university|^vanderbilt$|范德堡/i, aliases: ["Vanderbilt"] },
  { re: /rice university|^rice$|莱斯/i, aliases: ["Rice", "Rice University"] },
  { re: /emory university|^emory$|埃默里/i, aliases: ["Emory"] },
];

/** 返回用于 pattern 匹配的校名变体（规范化原串 + 别名） */
export function schoolNameLookupVariants(school: string): string[] {
  const base = normalizeSchoolNameInput(school);
  if (!base) return [];
  const out = new Set<string>([base, school.trim()]);
  for (const rule of ALIAS_RULES) {
    if (rule.re.test(base) || rule.re.test(school)) {
      for (const alias of rule.aliases) out.add(alias);
    }
  }
  return [...out];
}

export function schoolNameMatchesAny(school: string, patterns: RegExp[]): boolean {
  const variants = schoolNameLookupVariants(school);
  return variants.some((v) => patterns.some((re) => re.test(v)));
}

/** 运营/测试：curated 校库应能解析的常见 LLM 法定校名 */
export const CANONICAL_SCHOOL_NAME_FIXTURES: Array<{ input: string; mustMatch: RegExp }> = [
  { input: "University of California, Los Angeles", mustMatch: /\bucla\b/i },
  { input: "University of California, Berkeley", mustMatch: /berkeley/i },
  { input: "University of California, San Diego", mustMatch: /ucsd|uc san diego/i },
  { input: "University of California, Irvine", mustMatch: /uci|uc irvine/i },
  { input: "University of California, Davis", mustMatch: /uc davis/i },
  { input: "University of California, Santa Barbara", mustMatch: /ucsb|uc santa barbara/i },
  { input: "University of California, Riverside", mustMatch: /ucr|uc riverside/i },
  { input: "Stanford University", mustMatch: /stanford/i },
  { input: "Harvard University", mustMatch: /harvard/i },
  { input: "Massachusetts Institute of Technology", mustMatch: /mit/i },
  { input: "University of Pennsylvania", mustMatch: /upenn|penn|pennsylvania/i },
  { input: "University of Southern California", mustMatch: /usc|southern california/i },
  { input: "University of Texas at Austin", mustMatch: /texas at austin|ut austin/i },
  { input: "Georgia Institute of Technology", mustMatch: /georgia tech|georgia institute/i },
  { input: "University of Illinois Urbana-Champaign", mustMatch: /university of illinois|uiuc/i },
  { input: "Carnegie Mellon University", mustMatch: /carnegie mellon|cmu/i },
  { input: "University of Michigan—Ann Arbor", mustMatch: /michigan|umich/i },
  { input: "New York University", mustMatch: /nyu|new york university/i },
  { input: "University of Chicago", mustMatch: /uchicago|university of chicago/i },
  { input: "University of Washington", mustMatch: /university of washington|\buw\b/i },
];
