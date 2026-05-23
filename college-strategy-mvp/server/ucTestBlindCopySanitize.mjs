/** UC 本科 test-blind：清洗误把 SAT/ACT 写成风险/信息缺口的文案 */

const UC_SAT_GAP_PHRASE_RES = [
  {
    pattern: /[^。；;]*?(无|缺少|未提交|未递交|没有)\s*(SAT|ACT)[^。；;]*(视为|可能被视作|可能被看作)?\s*信息缺口[^。；;]*/gi,
    zh: "",
    en: "",
  },
  {
    pattern: /[^。；;]*?标化\s*optional[^。；;]*(信息缺口|缺口|不利)[^。；;]*/gi,
    zh: "",
    en: "",
  },
  {
    pattern: /[^。；;]*?test[- ]?optional[^。；;]*(information\s+gap|gap|disadvantage)[^。；;]*/gi,
    zh: "",
    en: "",
  },
  {
    pattern: /[^。；;]*?(SAT|ACT|标化)[^。；;]*(信息缺口|缺口|视为劣势)[^。；;]*/gi,
    zh: "",
    en: "",
  },
  {
    pattern: /标化\s*optional\s*[（(][^）)]*[）)]?/gi,
    zh: "",
    en: "",
  },
];

function isSingleClauseSatGap(clause) {
  const s = clause.trim();
  if (!s) return false;
  if (/^标化\s*optional/i.test(s)) return true;
  if (/(无|缺少|未提交|未递交|没有|lack of|missing|no)\s*(SAT|ACT|标化)/i.test(s) && /(信息缺口|缺口|optional)/i.test(s)) {
    return !/(GPA|活动|PIQ|专业|课程|competition|activities)/i.test(s);
  }
  if (/(SAT|ACT|标化).*(信息缺口|缺口)/i.test(s) && !/(GPA|活动|PIQ|专业|课程)/i.test(s)) return true;
  if (/信息缺口.*(SAT|ACT|标化)/i.test(s)) return true;
  return false;
}

export function isUcTestBlindSatGapBullet(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  const clauses = s.split(/[；;]/).map((c) => c.trim()).filter(Boolean);
  if (clauses.length === 0) return false;
  if (clauses.length === 1) return isSingleClauseSatGap(clauses[0]);
  return clauses.every(isSingleClauseSatGap);
}

export function sanitizeUcTestBlindCopy(text, locale = "zh") {
  let s = String(text || "").trim();
  if (!s) return s;
  if (isUcTestBlindSatGapBullet(s)) return "";

  for (const rule of UC_SAT_GAP_PHRASE_RES) {
    s = s.replace(rule.pattern, locale === "en" ? rule.en : rule.zh);
  }

  s = s
    .replace(/^[；;,.]\s*/g, "")
    .replace(/\s*[；;,.]\s*[；;,.]+/g, "；")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (isUcTestBlindSatGapBullet(s)) return "";
  return s;
}

export function filterUcTestBlindBullets(items, locale = "zh") {
  return (items ?? []).map((x) => sanitizeUcTestBlindCopy(x, locale)).filter(Boolean);
}
