/** Reject transcript OCR rows that are demographics, headers, or table junk. */

const LETTER_GRADE_RE = /^[A-F]([+-])?$/i;
const PASS_FAIL_RE = /^(P|NP|S|U|W|I|CR|NC)$/i;

const JUNK_COURSE_RES = [
  /^(grade|age|birthdate|birth\s*date|dob|gender|sex|name|student|address|phone|id|ssid|page|cumulative|credits|earned|attempted|gpa|rank|counselor|principal|school|district)\b/i,
  /\b(student\s*id|state\s*id|birth\s*date|student\s*name|parent|guardian)\b/i,
  /^ID:\s*\d/i,
  /^\d+\s+\d{4}[-/]\d{2,4}/,
  /^\d{4}[-/]\d{2,4}\s+\d/,
  /^[\d.\s|]+$/,
  /^\d{5,}\b/,
  /\d{1,2}\/\d{1,2}\/\d{2,4}/,
  /^\d\.\d{3,}(\s+\d\.\d{3,})+/,
  /^(term|semester|year|marking\s*period)\b/i,
];

const ACADEMIC_HINT_RE =
  /\b(ap|honors?|ib|hl|sl|english|math|algebra|geometry|calculus|statistics|physics|chemistry|biology|science|history|government|economics|geography|spanish|french|chinese|mandarin|language|literature|writing|computer|programming|art|music|band|choir|drama|psychology|sociology|pe|physical|health|env|studio|ceramics|theatre|theater|cs|comp)\b/i;

export function isValidTranscriptGrade(grade) {
  const g = String(grade ?? "").trim();
  if (!g) return false;
  if (LETTER_GRADE_RE.test(g) || PASS_FAIL_RE.test(g)) return true;
  if (/^0+$/.test(g)) return false;
  if (/^\d{3,}$/.test(g)) return false;
  const num = Number(g);
  if (!Number.isFinite(num)) return false;
  if (num < 0 || num > 100) return false;
  if (Number.isInteger(num) && num >= 1900 && num <= 2035) return false;
  if (num === 0) return false;
  return true;
}

export function isPlausibleCourseName(courseName) {
  const n = String(courseName ?? "").trim();
  if (n.length < 3) return false;
  if (!/[a-zA-Z]/.test(n)) return false;
  if (JUNK_COURSE_RES.some((re) => re.test(n))) return false;
  if (/^(grade|age|id|name|year|term|semester|other)$/i.test(n)) return false;
  if (/^\d{1,2}\s+\d{4}[-/]\d{4}/.test(n)) return false;
  if (ACADEMIC_HINT_RE.test(n)) return true;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && /[a-zA-Z]{3,}/.test(n)) return true;
  return false;
}

export function isPlausibleCourseRow(courseName, grade) {
  if (!isPlausibleCourseName(courseName)) return false;
  if (!isValidTranscriptGrade(grade)) return false;
  const g = String(grade).trim();
  const name = String(courseName).trim().toLowerCase();
  if (/^(9|10|11|12)$/.test(g) && /^(grade|year|level)$/.test(name)) return false;
  if (g === name) return false;
  return true;
}

export function sanitizeGpaValue(value, { min = 1.5, max = 5.5 } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const num = Number(raw);
  if (!Number.isFinite(num) || num < min || num > max) return "";
  return num.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function filterTranscriptCourses(courses) {
  if (!Array.isArray(courses)) return [];
  const seen = new Set();
  const out = [];
  for (const c of courses) {
    const courseName = String(c?.courseName ?? "").trim();
    const grade = String(c?.grade ?? "").trim();
    if (!isPlausibleCourseRow(courseName, grade)) continue;
    const key = `${courseName.toLowerCase()}|${grade}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, courseName, grade });
  }
  return out.slice(0, 40);
}
