import type { ActivityItem, FormState } from "../../types";
import type {
  ResumeActivity,
  ResumeEducation,
  ResumeFormData,
  ResumeHonor,
  ResumeProject,
  ResumeTemplateData,
  ResumeWork,
} from "./types";

export function emptyEducation(): ResumeEducation {
  return {
    highSchoolName: "",
    schoolCityState: "",
    graduationMonthYear: "",
    gpa: "",
    rankNumerator: "",
    rankDenominator: "",
    satTotal: "",
    satMath: "",
    satEbrw: "",
    actScore: "",
    apCoursesLine: "",
    courseworkLine: "",
  };
}

export function emptyHonor(): ResumeHonor {
  return { name: "", year: "", issuer: "", description: "" };
}

export function emptyActivity(): ResumeActivity {
  return {
    organization: "",
    dates: "",
    role: "",
    hoursPerWeek: "",
    weeksPerYear: "",
    description: "",
  };
}

export function emptyWork(): ResumeWork {
  return {
    company: "",
    location: "",
    title: "",
    dates: "",
    description: "",
  };
}

export function emptyProject(): ResumeProject {
  return {
    title: "",
    year: "",
    supervisor: "",
    description: "",
  };
}

export function createEmptyResumeForm(): ResumeFormData {
  return {
    contact: {
      fullName: "",
      cityState: "",
      phone: "",
      email: "",
      linkedIn: "",
    },
    educations: [emptyEducation()],
    honors: [],
    activities: [],
    works: [],
    projects: [],
    skills: {
      technical: "",
      languages: "",
      interests: "",
    },
  };
}

function activityDatesFromItem(item: ActivityItem): string {
  const grades = item.grades.trim();
  if (!grades) return "";
  const years = grades.match(/\d{4}/g);
  if (!years?.length) return grades;
  const start = years[0];
  const end = years[years.length - 1];
  if (start === end) return `${start} – Present`;
  return `${start} – ${end}`;
}

function mapActivityItem(item: ActivityItem): ResumeActivity {
  const lines = [item.description.trim(), item.outcome.trim()].filter(Boolean);
  return {
    organization: item.name.trim(),
    dates: activityDatesFromItem(item),
    role: item.role.trim(),
    hoursPerWeek: item.hours.trim(),
    weeksPerYear: "",
    description: lines.join("\n"),
  };
}

function honorFromActivity(item: ActivityItem): ResumeHonor {
  return {
    name: item.award.trim(),
    year: "",
    issuer: item.name.trim(),
    description: [item.outcome, item.description].filter(Boolean).join(" ").trim(),
  };
}

export function prefillResumeFromForm(
  form: FormState,
  options?: { email?: string | null; displayName?: string | null },
): ResumeFormData {
  const base = createEmptyResumeForm();
  const structured = form.structuredActivities ?? [];

  base.contact.fullName = options?.displayName?.trim() || "";
  base.contact.email = options?.email?.trim() || "";
  base.contact.cityState = form.residenceRegion.trim();

  base.educations = [
    {
      ...emptyEducation(),
      highSchoolName: form.currentHighSchool.trim(),
      schoolCityState: form.residenceRegion.trim(),
      gpa: form.gpa.trim(),
      satTotal: form.satScore.trim(),
      actScore: form.actScore.trim(),
      graduationMonthYear: form.intakeTerm.trim() || form.intakeOtherDetail.trim(),
    },
  ];

  base.honors = structured.filter((a) => a.award.trim()).map(honorFromActivity);
  base.activities = structured
    .filter((a) => a.kind !== "internship" && a.kind !== "research")
    .map(mapActivityItem)
    .filter((a) => a.organization);
  base.works = structured
    .filter((a) => a.kind === "internship")
    .map((item) => ({
      ...emptyWork(),
      company: item.name.trim(),
      title: item.role.trim(),
      dates: activityDatesFromItem(item),
      description: [item.description.trim(), item.outcome.trim()].filter(Boolean).join("\n"),
    }))
    .filter((w) => w.company);
  base.projects = structured
    .filter((a) => a.kind === "research")
    .map((item) => ({
      ...emptyProject(),
      title: item.name.trim(),
      supervisor: item.proof.trim(),
      description: [item.description.trim(), item.outcome.trim()].filter(Boolean).join("\n"),
    }))
    .filter((p) => p.title);

  base.skills.languages = form.languageScores.trim();
  base.skills.interests = [form.majorPrimary, form.majorSecondary].filter(Boolean).join(", ");

  return base;
}

export function formatActivityHours(activity: ResumeActivity): string {
  const hrs = activity.hoursPerWeek.trim();
  const weeks = activity.weeksPerYear.trim();
  if (hrs && weeks) return `${hrs} hrs/week · ${weeks} weeks/year`;
  if (hrs) return hrs.includes("hrs") ? hrs : `${hrs} hrs/week`;
  return weeks;
}

function bulletLine(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || trimmed === ".") return "";
  return trimmed.startsWith("▪") ? trimmed : `▪    ${trimmed}`;
}

function isMeaningfulText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed !== "." && trimmed.toLowerCase() !== "undefined";
}

function descriptionToBullets(text: string): { bullet1: string; bullet2: string } {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(isMeaningfulText);
  if (lines.length === 0) return { bullet1: "", bullet2: "" };
  if (lines.length === 1) return { bullet1: bulletLine(lines[0]), bullet2: "" };
  return {
    bullet1: bulletLine(lines[0]),
    bullet2: lines.slice(1).map(bulletLine).filter(Boolean).join("\n"),
  };
}

function sanitizeTemplateString(value: unknown): string {
  if (value == null) return "";
  const text = String(value).trim();
  if (!text || text === "undefined") return "";
  return text;
}

function sanitizeTemplateRecord(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = sanitizeTemplateString(value);
  }
  return out;
}

function hasAnyValue(values: string[]): boolean {
  return values.some((v) => v.trim().length > 0);
}

function formatSatLine(edu: ResumeEducation): string {
  const total = edu.satTotal.trim();
  const math = edu.satMath.trim();
  const english = edu.satEbrw.trim();
  const act = edu.actScore.trim();

  let sat = "";
  if (total) {
    sat = `SAT: ${total}`;
    if (math || english) {
      sat += ` (Math: ${math || "—"}, English: ${english || "—"})`;
    }
  } else if (math || english) {
    sat = `SAT (Math: ${math || "—"}, English: ${english || "—"})`;
  }
  if (act) {
    return sat ? `${sat}  |  ACT: ${act}` : `ACT: ${act}`;
  }
  return sat;
}

function mapEducation(edu: ResumeEducation) {
  return sanitizeTemplateRecord({
    HS_NAME: edu.highSchoolName.trim(),
    HS_CITY_STATE: edu.schoolCityState.trim(),
    GRAD_MONTH_YEAR: edu.graduationMonthYear.trim(),
    GPA: edu.gpa.trim(),
    RANK_NUM: edu.rankNumerator.trim(),
    RANK_DEN: edu.rankDenominator.trim(),
    SAT_LINE: formatSatLine(edu),
    AP_COURSES_LINE: edu.apCoursesLine.trim(),
    COURSEWORK_LINE: edu.courseworkLine.trim(),
  });
}

export function resumeFormToTemplateData(form: ResumeFormData): ResumeTemplateData {
  const contactParts = [
    form.contact.cityState.trim(),
    form.contact.phone.trim(),
    form.contact.email.trim(),
    form.contact.linkedIn.trim(),
  ].filter(Boolean);

  return {
    FULL_NAME: form.contact.fullName.trim(),
    CONTACT_LINE: contactParts.join("  |  "),
    educations: form.educations
      .filter((edu) =>
        hasAnyValue([
          edu.highSchoolName,
          edu.schoolCityState,
          edu.graduationMonthYear,
          edu.gpa,
          edu.rankNumerator,
          edu.rankDenominator,
          edu.satTotal,
          edu.satMath,
          edu.satEbrw,
          edu.actScore,
          edu.apCoursesLine,
          edu.courseworkLine,
        ]),
      )
      .map(mapEducation),
    honors: form.honors
      .filter((h) => hasAnyValue([h.name, h.year, h.issuer, h.description]))
      .map((h) =>
        sanitizeTemplateRecord({
          AWARD_NAME: h.name.trim(),
          AWARD_YEAR: h.year.trim(),
          AWARD_ISSUER: h.issuer.trim(),
          AWARD_DESC: bulletLine(h.description),
        }),
      ),
    activities: form.activities
      .filter((a) => hasAnyValue([a.organization, a.dates, a.role, a.description, a.hoursPerWeek, a.weeksPerYear]))
      .map((a) => {
        const bullets = descriptionToBullets(a.description);
        return sanitizeTemplateRecord({
          ACTIVITY_ORG: a.organization.trim(),
          ACTIVITY_DATES: a.dates.trim(),
          ACTIVITY_ROLE: a.role.trim(),
          ACTIVITY_HOURS: formatActivityHours(a),
          ACTIVITY_BULLET_1: bullets.bullet1,
          ACTIVITY_BULLET_2: bullets.bullet2,
        });
      }),
    works: form.works
      .filter((w) => hasAnyValue([w.company, w.title, w.dates, w.location, w.description]))
      .map((w) => {
        const bullets = descriptionToBullets(w.description);
        return sanitizeTemplateRecord({
          WORK_COMPANY: w.company.trim(),
          WORK_LOCATION: w.location.trim(),
          WORK_TITLE: w.title.trim(),
          WORK_DATES: w.dates.trim(),
          WORK_BULLET_1: bullets.bullet1,
          WORK_BULLET_2: bullets.bullet2,
        });
      }),
    projects: form.projects
      .filter((p) => hasAnyValue([p.title, p.year, p.supervisor, p.description]))
      .map((p) => {
        const bullets = descriptionToBullets(p.description);
        return sanitizeTemplateRecord({
          PROJECT_TITLE: p.title.trim(),
          PROJECT_YEAR: p.year.trim(),
          PROJECT_SUPERVISOR: p.supervisor.trim(),
          PROJECT_BULLET_1: bullets.bullet1,
          PROJECT_BULLET_2: bullets.bullet2,
        });
      }),
    SKILLS_TECHNICAL: sanitizeTemplateString(form.skills.technical),
    SKILLS_LANGUAGES: sanitizeTemplateString(form.skills.languages),
    SKILLS_INTERESTS: sanitizeTemplateString(form.skills.interests),
  };
}

const STORAGE_PREFIX = "onlyapply_resume_draft_v2:";

export function resumeDraftStorageKey(storageKey: string): string {
  return `${STORAGE_PREFIX}${storageKey}`;
}

export function loadResumeDraftFromStorage(storageKey: string): ResumeFormData | null {
  const persistKey = resumeDraftStorageKey(storageKey);
  try {
    for (const key of [persistKey, persistKey.replace("_v2:", "_v1:")]) {
      const raw = localStorage.getItem(key);
      if (raw) return migrateResumeDraft(JSON.parse(raw));
    }
  } catch {
    /* ignore corrupt drafts */
  }
  return null;
}

export function saveResumeDraftToStorage(storageKey: string, draft: ResumeFormData): void {
  try {
    localStorage.setItem(resumeDraftStorageKey(storageKey), JSON.stringify(draft));
  } catch {
    /* ignore quota / private mode */
  }
}

export function hasResumeDraftContent(draft: ResumeFormData): boolean {
  if (draft.contact.fullName.trim() || draft.contact.email.trim() || draft.contact.phone.trim()) return true;
  if (draft.honors.length > 0 || draft.activities.length > 0 || draft.works.length > 0 || draft.projects.length > 0) {
    return true;
  }
  if (draft.skills.technical.trim() || draft.skills.languages.trim() || draft.skills.interests.trim()) return true;
  return draft.educations.some(
    (edu) =>
      edu.highSchoolName.trim() ||
      edu.schoolCityState.trim() ||
      edu.gpa.trim() ||
      edu.satTotal.trim() ||
      edu.actScore.trim() ||
      edu.apCoursesLine.trim() ||
      edu.courseworkLine.trim(),
  );
}

/** Migrate v1 fixed-slot drafts saved before dynamic lists. */
function mergeEntryDescription(row: Record<string, unknown>): string {
  if (typeof row.description === "string") return row.description;
  return [row.bullet1, row.bullet2]
    .filter((v) => typeof v === "string" && v.trim())
    .join("\n");
}

function migrateActivityRow(row: Record<string, unknown>): ResumeActivity {
  return { ...emptyActivity(), ...row, description: mergeEntryDescription(row) } as ResumeActivity;
}

function migrateWorkRow(row: Record<string, unknown>): ResumeWork {
  return { ...emptyWork(), ...row, description: mergeEntryDescription(row) } as ResumeWork;
}

function migrateProjectRow(row: Record<string, unknown>): ResumeProject {
  return { ...emptyProject(), ...row, description: mergeEntryDescription(row) } as ResumeProject;
}

export function migrateResumeDraft(raw: unknown): ResumeFormData {
  if (!raw || typeof raw !== "object") return createEmptyResumeForm();
  const data = raw as Record<string, unknown>;
  if (Array.isArray(data.educations)) {
    const base = createEmptyResumeForm();
    return {
      ...base,
      contact: {
        ...base.contact,
        ...(typeof data.contact === "object" && data.contact ? (data.contact as ResumeFormData["contact"]) : {}),
      },
      educations: data.educations.length > 0 ? (data.educations as ResumeEducation[]) : base.educations,
      honors: Array.isArray(data.honors) ? (data.honors as ResumeHonor[]) : [],
      activities: Array.isArray(data.activities)
        ? (data.activities as Array<Record<string, unknown>>).map(migrateActivityRow)
        : [],
      works: Array.isArray(data.works)
        ? (data.works as Array<Record<string, unknown>>).map(migrateWorkRow)
        : [],
      projects: Array.isArray(data.projects)
        ? (data.projects as Array<Record<string, unknown>>).map(migrateProjectRow)
        : [],
      skills: {
        ...base.skills,
        ...(typeof data.skills === "object" && data.skills ? (data.skills as ResumeFormData["skills"]) : {}),
      },
    };
  }
  const base = createEmptyResumeForm();
  if (data.contact && typeof data.contact === "object") {
    base.contact = { ...base.contact, ...(data.contact as ResumeFormData["contact"]) };
  }
  if (data.skills && typeof data.skills === "object") {
    base.skills = { ...base.skills, ...(data.skills as ResumeFormData["skills"]) };
  }
  if (data.education && typeof data.education === "object") {
    const edu = data.education as Record<string, unknown>;
    base.educations = [
      {
        ...emptyEducation(),
        highSchoolName: String(edu.highSchoolName ?? ""),
        schoolCityState: String(edu.schoolCityState ?? ""),
        graduationMonthYear: String(edu.graduationMonthYear ?? ""),
        gpa: String(edu.gpa ?? ""),
        rankNumerator: String(edu.rankNumerator ?? ""),
        rankDenominator: String(edu.rankDenominator ?? ""),
        satTotal: String(edu.satTotal ?? ""),
        satMath: String(edu.satMath ?? ""),
        satEbrw: String(edu.satEbrw ?? ""),
        actScore: String(edu.actScore ?? ""),
        apCoursesLine: Array.isArray(edu.apCourses) ? edu.apCourses.filter(Boolean).join(", ") : "",
        courseworkLine: Array.isArray(edu.relevantCoursework)
          ? edu.relevantCoursework.filter(Boolean).join(", ")
          : "",
      },
    ];
  }
  if (Array.isArray(data.honors)) base.honors = data.honors as ResumeHonor[];
  if (Array.isArray(data.activities)) {
    base.activities = (data.activities as Array<Record<string, unknown>>).map(migrateActivityRow);
  }
  if (Array.isArray(data.works)) {
    base.works = (data.works as Array<Record<string, unknown>>).map(migrateWorkRow);
  } else if (data.work && typeof data.work === "object") {
    base.works = [migrateWorkRow(data.work as Record<string, unknown>)];
  }
  if (Array.isArray(data.projects)) {
    base.projects = (data.projects as Array<Record<string, unknown>>).map(migrateProjectRow);
  } else if (data.project && typeof data.project === "object") {
    base.projects = [migrateProjectRow(data.project as Record<string, unknown>)];
  }
  return base;
}
