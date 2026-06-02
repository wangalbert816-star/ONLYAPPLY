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
    bullet1: "",
    bullet2: "",
  };
}

export function emptyWork(): ResumeWork {
  return {
    company: "",
    location: "",
    title: "",
    dates: "",
    bullet1: "",
    bullet2: "",
  };
}

export function emptyProject(): ResumeProject {
  return {
    title: "",
    year: "",
    supervisor: "",
    bullet1: "",
    bullet2: "",
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
  const bullets: string[] = [];
  if (item.description.trim()) bullets.push(item.description.trim());
  if (item.outcome.trim()) bullets.push(item.outcome.trim());
  return {
    organization: item.name.trim(),
    dates: activityDatesFromItem(item),
    role: item.role.trim(),
    hoursPerWeek: item.hours.trim(),
    weeksPerYear: "",
    bullet1: bullets[0] ?? "",
    bullet2: bullets[1] ?? "",
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
      bullet1: item.description.trim(),
      bullet2: item.outcome.trim(),
    }))
    .filter((w) => w.company);
  base.projects = structured
    .filter((a) => a.kind === "research")
    .map((item) => ({
      ...emptyProject(),
      title: item.name.trim(),
      supervisor: item.proof.trim(),
      bullet1: item.description.trim(),
      bullet2: item.outcome.trim(),
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
  if (!trimmed) return "";
  return trimmed.startsWith("▪") ? trimmed : `▪    ${trimmed}`;
}

function hasAnyValue(values: string[]): boolean {
  return values.some((v) => v.trim().length > 0);
}

function formatSatLine(edu: ResumeEducation): string {
  const total = edu.satTotal.trim();
  const math = edu.satMath.trim();
  const ebrw = edu.satEbrw.trim();
  const act = edu.actScore.trim();

  let sat = "";
  if (total) {
    sat = `SAT: ${total}`;
    if (math || ebrw) {
      sat += ` (Math: ${math || "—"}, EBRW: ${ebrw || "—"})`;
    }
  }
  if (act) {
    return sat ? `${sat}  |  ACT: ${act}` : `ACT: ${act}`;
  }
  return sat;
}

function mapEducation(edu: ResumeEducation) {
  return {
    HS_NAME: edu.highSchoolName.trim(),
    HS_CITY_STATE: edu.schoolCityState.trim(),
    GRAD_MONTH_YEAR: edu.graduationMonthYear.trim(),
    GPA: edu.gpa.trim(),
    RANK_NUM: edu.rankNumerator.trim(),
    RANK_DEN: edu.rankDenominator.trim(),
    SAT_LINE: formatSatLine(edu),
    AP_COURSES_LINE: edu.apCoursesLine.trim(),
    COURSEWORK_LINE: edu.courseworkLine.trim(),
  };
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
          edu.satTotal,
          edu.actScore,
          edu.apCoursesLine,
          edu.courseworkLine,
        ]),
      )
      .map(mapEducation),
    honors: form.honors
      .filter((h) => hasAnyValue([h.name, h.year, h.issuer, h.description]))
      .map((h) => ({
        AWARD_NAME: h.name.trim(),
        AWARD_YEAR: h.year.trim(),
        AWARD_ISSUER: h.issuer.trim(),
        AWARD_DESC: bulletLine(h.description),
      })),
    activities: form.activities
      .filter((a) => hasAnyValue([a.organization, a.dates, a.role, a.bullet1, a.bullet2]))
      .map((a) => ({
        ACTIVITY_ORG: a.organization.trim(),
        ACTIVITY_DATES: a.dates.trim(),
        ACTIVITY_ROLE: a.role.trim(),
        ACTIVITY_HOURS: formatActivityHours(a),
        ACTIVITY_BULLET_1: bulletLine(a.bullet1),
        ACTIVITY_BULLET_2: bulletLine(a.bullet2),
      })),
    works: form.works
      .filter((w) => hasAnyValue([w.company, w.title, w.dates, w.bullet1, w.bullet2]))
      .map((w) => ({
        WORK_COMPANY: w.company.trim(),
        WORK_LOCATION: w.location.trim(),
        WORK_TITLE: w.title.trim(),
        WORK_DATES: w.dates.trim(),
        WORK_BULLET_1: bulletLine(w.bullet1),
        WORK_BULLET_2: bulletLine(w.bullet2),
      })),
    projects: form.projects
      .filter((p) => hasAnyValue([p.title, p.year, p.supervisor, p.bullet1, p.bullet2]))
      .map((p) => ({
        PROJECT_TITLE: p.title.trim(),
        PROJECT_YEAR: p.year.trim(),
        PROJECT_SUPERVISOR: p.supervisor.trim(),
        PROJECT_BULLET_1: bulletLine(p.bullet1),
        PROJECT_BULLET_2: bulletLine(p.bullet2),
      })),
    SKILLS_TECHNICAL: form.skills.technical.trim(),
    SKILLS_LANGUAGES: form.skills.languages.trim(),
    SKILLS_INTERESTS: form.skills.interests.trim(),
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
      activities: Array.isArray(data.activities) ? (data.activities as ResumeActivity[]) : [],
      works: Array.isArray(data.works) ? (data.works as ResumeWork[]) : [],
      projects: Array.isArray(data.projects) ? (data.projects as ResumeProject[]) : [],
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
  if (Array.isArray(data.activities)) base.activities = data.activities as ResumeActivity[];
  if (data.work && typeof data.work === "object") base.works = [data.work as ResumeWork];
  if (data.project && typeof data.project === "object") base.projects = [data.project as ResumeProject];
  return base;
}
