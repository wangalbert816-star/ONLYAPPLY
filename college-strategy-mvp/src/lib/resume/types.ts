export type ResumeContact = {
  fullName: string;
  cityState: string;
  phone: string;
  email: string;
  linkedIn: string;
};

export type ResumeEducation = {
  highSchoolName: string;
  schoolCityState: string;
  graduationMonthYear: string;
  gpa: string;
  rankNumerator: string;
  rankDenominator: string;
  satTotal: string;
  satMath: string;
  satEbrw: string;
  actScore: string;
  apCoursesLine: string;
  courseworkLine: string;
};

export type ResumeHonor = {
  name: string;
  year: string;
  issuer: string;
  description: string;
};

export type ResumeActivity = {
  organization: string;
  dates: string;
  role: string;
  hoursPerWeek: string;
  weeksPerYear: string;
  /** Multi-line bullets; exported to Word as ▪ lines. */
  description: string;
};

export type ResumeWork = {
  company: string;
  location: string;
  title: string;
  dates: string;
  description: string;
};

export type ResumeProject = {
  title: string;
  year: string;
  supervisor: string;
  description: string;
};

export type ResumeSkills = {
  technical: string;
  languages: string;
  interests: string;
};

export type ResumeFormData = {
  contact: ResumeContact;
  educations: ResumeEducation[];
  honors: ResumeHonor[];
  activities: ResumeActivity[];
  works: ResumeWork[];
  projects: ResumeProject[];
  skills: ResumeSkills;
};

export type ResumeTemplateData = {
  FULL_NAME: string;
  CONTACT_LINE: string;
  educations: Array<Record<string, string>>;
  honors: Array<Record<string, string>>;
  activities: Array<Record<string, string>>;
  works: Array<Record<string, string>>;
  projects: Array<Record<string, string>>;
  SKILLS_TECHNICAL: string;
  SKILLS_LANGUAGES: string;
  SKILLS_INTERESTS: string;
};
