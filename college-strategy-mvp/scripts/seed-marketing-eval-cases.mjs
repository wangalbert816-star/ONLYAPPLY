#!/usr/bin/env node
/**
 * Seed Marketing Brainstorm eval cases (CASE-017 … CASE-025) into Supabase.
 * CASE-016 (Ava Chen) is assumed already imported.
 *
 * Usage: node scripts/seed-marketing-eval-cases.mjs
 *        node scripts/seed-marketing-eval-cases.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

function loadDotEnv() {
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (process.env[key] == null || process.env[key] === "") process.env[key] = val;
  }
}

loadDotEnv();

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

function act(name, kind, role, description, extra = {}) {
  return {
    id: randomUUID(),
    name,
    kind,
    role,
    description,
    award: extra.award ?? "",
    hours: extra.hours ?? "6 hrs/week",
    proof: extra.proof ?? "",
    scope: extra.scope ?? "school",
    grades: extra.grades ?? "11",
    outcome: extra.outcome ?? "",
    majorRelated: extra.majorRelated ?? "yes",
  };
}

function baseBody(overrides) {
  return {
    locale: "en",
    intakeTerm: "2027 Fall",
    applicantIdentity: "us_citizen",
    citizenship: "United States",
    testing: "will_submit",
    actScore: "",
    languageScores: "",
    academicSpecialFlags: [],
    academicSpecialNotes: "",
    majorSecondary: "",
    schoolSize: "any",
    campusCulturePref: "any",
    riskStyle: "balanced",
    dealbreakers: "",
    ...overrides,
  };
}

function tier(...schools) {
  return schools.filter(Boolean).slice(0, 3).map((school) => ({ school }));
}

const MARKETING_CASES = [
  {
    caseKey: "CASE-017",
    title: "Ethan Martinez",
    tags: ["marketing", "cs", "us-citizen", "west-coast", "sat-1450"],
    notes: "Marketing Brainstorm — competitive suburban public, CS/DS, Bay Area; UC-heavy interest list.",
    reportBody: baseBody({
      residenceRegion: "California",
      budget: "high_budget",
      satScore: "1450",
      gpa: "3.76 unweighted / 4.22 weighted",
      gpaTrend: "upward",
      highSchoolSystem: "US public school",
      currentHighSchool: "Large public high school, San Jose, CA",
      majorPrimary: "Computer Science / Data Science",
      geoPrefs: ["west"],
      structuredActivities: [
        act("Robotics team", "activity", "Programming lead", "Led robot programming and autonomous routines for competition season", { scope: "regional", majorRelated: "yes" }),
        act("Tutoring center app", "activity", "Developer", "Built a scheduling app for the school tutoring center", { scope: "school", majorRelated: "yes" }),
        act("Traffic ML project", "research", "Independent researcher", "Machine learning project predicting local traffic patterns", { scope: "local", majorRelated: "yes" }),
        act("Coding camp TA", "internship", "Teaching assistant", "Summer coding camp teaching assistant for intro Python", { scope: "local", majorRelated: "yes" }),
        act("Varsity tennis", "sports", "Team member", "Varsity tennis", { majorRelated: "no" }),
        act("Hackathon", "competition", "Participant", "Local hackathon — Best Use of Data award", { award: "Best Use of Data", scope: "local", majorRelated: "yes" }),
      ],
    }),
    expectedReach: tier("UC Berkeley", "UCLA", "Georgia Institute of Technology"),
    expectedMatch: tier("UC San Diego", "Purdue University", "University of Washington"),
    expectedSafety: tier("San Jose State University", "UC Davis", "Cal Poly San Luis Obispo"),
  },
  {
    caseKey: "CASE-018",
    title: "Maya Thompson",
    tags: ["marketing", "humanities", "journalism", "need-aid", "sat-1390"],
    notes: "Marketing Brainstorm — Chicago arts magnet, English/writing/journalism, needs financial aid.",
    reportBody: baseBody({
      residenceRegion: "Illinois",
      budget: "need_aid",
      satScore: "1390",
      gpa: "3.91 unweighted / 4.18 weighted",
      gpaTrend: "stable",
      highSchoolSystem: "US public magnet",
      currentHighSchool: "Public arts magnet school, Chicago, IL",
      majorPrimary: "English / Creative Writing / Journalism",
      geoPrefs: ["midwest", "east"],
      structuredActivities: [
        act("Literary magazine", "activity", "Editor-in-chief", "Editor-in-chief of school literary magazine", { scope: "school", majorRelated: "yes" }),
        act("Storytelling podcast", "activity", "Founder", "Founded student storytelling podcast", { scope: "school", majorRelated: "yes" }),
        act("Youth journalism", "internship", "Reporter", "Youth journalist for a local Chicago nonprofit", { scope: "local", majorRelated: "yes" }),
        act("Poetry slam", "arts", "Competitor", "Poetry slam competitor", { scope: "regional", majorRelated: "yes" }),
        act("Reading mentor", "service", "Volunteer", "Volunteer reading mentor for elementary students", { scope: "local", majorRelated: "yes" }),
        act("Bookstore job", "activity", "Part-time staff", "Part-time job at bookstore", { majorRelated: "no" }),
      ],
    }),
    expectedReach: tier("Northwestern University", "University of Chicago", "Columbia University"),
    expectedMatch: tier("NYU", "Boston College", "Kenyon College"),
    expectedSafety: tier("DePaul University", "Loyola University Chicago", "University of Illinois Urbana-Champaign"),
  },
  {
    caseKey: "CASE-019",
    title: "Priya Patel",
    tags: ["marketing", "pre-med", "bio", "strong-stats", "sat-1530"],
    notes: "Marketing Brainstorm — competitive Texas public, pre-med/public health, very strong STEM profile.",
    reportBody: baseBody({
      residenceRegion: "Texas",
      budget: "high_budget",
      satScore: "1530",
      gpa: "3.97 unweighted / 4.62 weighted",
      gpaTrend: "stable",
      highSchoolSystem: "US public school",
      currentHighSchool: "Large suburban public high school, Plano, TX",
      majorPrimary: "Biology / Public Health / Pre-Med",
      geoPrefs: ["south", "midwest", "any"],
      structuredActivities: [
        act("Hospital volunteer", "service", "Volunteer", "180+ hours hospital volunteer", { scope: "local", majorRelated: "yes" }),
        act("Mental health club", "club", "Founder", "Founder of mental health awareness club", { scope: "school", majorRelated: "yes" }),
        act("University lab RA", "research", "Research assistant", "Research assistant at local university lab", { scope: "local", majorRelated: "yes" }),
        act("HOSA", "club", "Chapter president", "HOSA chapter president; state finalist", { award: "HOSA State Finalist", scope: "state", majorRelated: "yes" }),
        act("Physician shadowing", "activity", "Observer", "Shadowed a pediatrician", { scope: "local", majorRelated: "yes" }),
        act("Blood drive", "service", "Organizer", "Organized school blood drive", { scope: "school", majorRelated: "yes" }),
      ],
    }),
    expectedReach: tier("Johns Hopkins University", "Duke University", "Rice University"),
    expectedMatch: tier("Emory University", "Washington University in St. Louis", "University of Michigan"),
    expectedSafety: tier("University of Texas at Austin", "Texas A&M University", "Baylor University"),
  },
  {
    caseKey: "CASE-020",
    title: "Jordan Williams",
    tags: ["marketing", "business", "first-gen", "need-aid", "weak-gpa"],
    notes: "Marketing Brainstorm — Newark urban public, marketing/communications, first-gen low-income.",
    reportBody: baseBody({
      residenceRegion: "New Jersey",
      budget: "need_aid",
      satScore: "1210",
      gpa: "3.35 unweighted / 3.62 weighted",
      gpaTrend: "upward",
      highSchoolSystem: "US public school",
      currentHighSchool: "Public high school, Newark, NJ",
      majorPrimary: "Marketing / Communications / Business",
      geoPrefs: ["east", "any"],
      structuredActivities: [
        act("Student government", "club", "Vice president", "Student government vice president", { scope: "school", majorRelated: "yes" }),
        act("Sneaker resale business", "activity", "Founder", "Started a sneaker resale business", { scope: "local", majorRelated: "yes" }),
        act("Barber shop social media", "internship", "Social media manager", "Manages social media for local barber shop", { scope: "local", majorRelated: "yes" }),
        act("Varsity basketball", "sports", "Captain", "Captain of varsity basketball team; MVP", { award: "Varsity MVP", scope: "school", majorRelated: "no" }),
        act("Grocery store job", "activity", "Part-time", "Works 15 hours/week at grocery store", { majorRelated: "no" }),
        act("Youth basketball coach", "service", "Volunteer coach", "Volunteer coach for youth basketball", { scope: "local", majorRelated: "no" }),
      ],
    }),
    expectedReach: tier("Syracuse University", "Drexel University", "Howard University"),
    expectedMatch: tier("Temple University", "Penn State University", "Seton Hall University"),
    expectedSafety: tier("Montclair State University", "Rutgers University–Newark", "Pace University"),
  },
  {
    caseKey: "CASE-021",
    title: "Lily Anderson",
    tags: ["marketing", "environmental", "rural", "act-31", "budget-cap"],
    notes: "Marketing Brainstorm — rural Montana public, limited AP access, environmental science.",
    reportBody: baseBody({
      residenceRegion: "Montana",
      budget: "budget_cap",
      satScore: "",
      actScore: "31",
      gpa: "3.82 unweighted / 4.05 weighted",
      gpaTrend: "stable",
      highSchoolSystem: "US rural public school",
      currentHighSchool: "Small rural public high school, Missoula, MT",
      majorPrimary: "Environmental Science / Sustainability",
      geoPrefs: ["west", "any"],
      academicSpecialNotes: "School only offers 4 AP classes total; high rigor within school context.",
      structuredActivities: [
        act("Environmental club", "club", "President", "President of environmental club", { scope: "school", majorRelated: "yes" }),
        act("Water quality project", "research", "Lead researcher", "Conducted local water quality testing project", { scope: "local", majorRelated: "yes" }),
        act("4-H", "activity", "Member", "4-H member for 7 years; state leadership award", { award: "State 4-H leadership award", scope: "state", majorRelated: "yes" }),
        act("Family farm", "activity", "Worker", "Works on family farm", { scope: "local", majorRelated: "yes" }),
        act("Recycling program", "service", "Organizer", "Organized recycling program at school", { scope: "school", majorRelated: "yes" }),
        act("Sustainability committee", "service", "Student representative", "Student representative to town sustainability committee", { scope: "local", majorRelated: "yes" }),
      ],
    }),
    expectedReach: tier("UC Davis", "Middlebury College", "Cornell CALS"),
    expectedMatch: tier("Colorado State University", "University of Vermont", "Oregon State University"),
    expectedSafety: tier("University of Montana", "Montana State University", "University of Colorado Boulder"),
  },
  {
    caseKey: "CASE-022",
    title: "Daniel Kim",
    tags: ["marketing", "intl", "engineering", "sat-1540", "full-pay"],
    notes: "Marketing Brainstorm — Seoul international school, mechanical/aerospace engineering, full-pay intl.",
    reportBody: baseBody({
      applicantIdentity: "intl",
      citizenship: "South Korea",
      residenceRegion: "Seoul",
      budget: "full_pay",
      satScore: "1540",
      gpa: "3.89 unweighted / 4.31 weighted",
      gpaTrend: "stable",
      highSchoolSystem: "International school (US curriculum)",
      currentHighSchool: "Private international school, Seoul",
      majorPrimary: "Mechanical Engineering / Aerospace Engineering",
      languageScores: "TOEFL 116",
      geoPrefs: ["any"],
      structuredActivities: [
        act("Robotics team", "activity", "Captain", "Robotics team captain; international competition finalist", { award: "International robotics finalist", scope: "international", majorRelated: "yes" }),
        act("Disaster relief drone", "research", "Builder", "Built drone prototype for disaster relief delivery", { scope: "local", majorRelated: "yes" }),
        act("Engineering startup", "internship", "Intern", "Internship at engineering startup", { scope: "local", majorRelated: "yes" }),
        act("Aerospace club", "club", "Founder", "Founder of school aerospace club", { scope: "school", majorRelated: "yes" }),
        act("Math competition", "competition", "Team member", "Math competition team; AMC 12 high scorer", { award: "AMC 12 high scorer", scope: "national", majorRelated: "yes" }),
        act("STEM tutor", "service", "Volunteer tutor", "Volunteer STEM tutor", { scope: "local", majorRelated: "yes" }),
      ],
    }),
    expectedReach: tier("Georgia Institute of Technology", "Purdue University", "Carnegie Mellon University"),
    expectedMatch: tier("University of Illinois Urbana-Champaign", "University of Michigan", "University of Southern California"),
    expectedSafety: tier("Virginia Tech", "Ohio State University", "Rutgers University–New Brunswick"),
  },
  {
    caseKey: "CASE-023",
    title: "Sofia Ramirez",
    tags: ["marketing", "psychology", "upward-trend", "need-aid", "sat-1280"],
    notes: "Marketing Brainstorm — Miami charter, psychology/education, upward GPA trend, needs aid.",
    reportBody: baseBody({
      residenceRegion: "Florida",
      budget: "need_aid",
      satScore: "1280",
      gpa: "3.48 unweighted / 3.81 weighted",
      gpaTrend: "upward",
      highSchoolSystem: "US charter school",
      currentHighSchool: "Charter high school, Miami, FL",
      majorPrimary: "Psychology / Education",
      geoPrefs: ["south", "any"],
      structuredActivities: [
        act("Peer counselor", "service", "Peer counselor", "Peer counselor supporting classmates", { scope: "school", majorRelated: "yes" }),
        act("Aftercare volunteer", "service", "Volunteer", "Volunteer at elementary school aftercare program", { scope: "local", majorRelated: "yes" }),
        act("Bilingual tutoring", "activity", "Founder", "Founder of bilingual tutoring group", { scope: "local", majorRelated: "yes" }),
        act("Sibling care", "activity", "Family responsibility", "Cares for younger siblings after school", { majorRelated: "no" }),
        act("Bakery job", "activity", "Part-time", "Works part-time at a bakery", { majorRelated: "no" }),
        act("Summer camp counselor", "service", "Counselor", "Summer camp counselor", { scope: "local", majorRelated: "yes" }),
      ],
    }),
    expectedReach: tier("Emory University", "Tulane University", "Boston University"),
    expectedMatch: tier("University of Miami", "Florida State University", "George Washington University"),
    expectedSafety: tier("Florida International University", "University of Central Florida", "Rollins College"),
  },
  {
    caseKey: "CASE-024",
    title: "Noah Stein",
    tags: ["marketing", "political-science", "elite-stats", "sat-1560", "full-pay"],
    notes: "Marketing Brainstorm — Boston private prep, political science/public policy, grade-deflation context.",
    reportBody: baseBody({
      residenceRegion: "Massachusetts",
      budget: "full_pay",
      satScore: "1560",
      gpa: "3.94 unweighted (school does not weight)",
      gpaTrend: "stable",
      highSchoolSystem: "US private college-prep",
      currentHighSchool: "Private college-prep school, Boston, MA",
      majorPrimary: "Political Science / History / Public Policy",
      geoPrefs: ["east", "any"],
      academicSpecialNotes: "School known for grade deflation.",
      structuredActivities: [
        act("Debate team", "competition", "Captain", "Debate team captain; national qualifier", { award: "National debate qualifier", scope: "national", majorRelated: "yes" }),
        act("City council campaign", "internship", "Intern", "Interned for city council campaign", { scope: "local", majorRelated: "yes" }),
        act("Civic engagement group", "club", "Founder", "Founder of student civic engagement group", { scope: "school", majorRelated: "yes" }),
        act("Newspaper opinion editor", "activity", "Editor", "Editor of school newspaper opinion section", { scope: "school", majorRelated: "yes" }),
        act("Model UN", "club", "President", "Model UN president; Best Delegate", { award: "Best Delegate", scope: "regional", majorRelated: "yes" }),
        act("Immigration legal aid", "service", "Volunteer", "Volunteers at immigration legal aid nonprofit", { scope: "local", majorRelated: "yes" }),
      ],
    }),
    expectedReach: tier("Georgetown University", "Columbia University", "Brown University"),
    expectedMatch: tier("Tufts University", "Boston College", "George Washington University"),
    expectedSafety: tier("American University", "Northeastern University", "Boston University"),
  },
  {
    caseKey: "CASE-025",
    title: "Zoe Carter",
    tags: ["marketing", "entrepreneurship", "design", "sat-1360", "business"],
    notes: "Marketing Brainstorm — Atlanta magnet, entrepreneurship/design/marketing, creative business profile.",
    reportBody: baseBody({
      residenceRegion: "Georgia",
      budget: "budget_cap",
      satScore: "1360",
      gpa: "3.71 unweighted / 4.08 weighted",
      gpaTrend: "stable",
      highSchoolSystem: "US public magnet",
      currentHighSchool: "Public magnet school (arts & technology), Atlanta, GA",
      majorPrimary: "Entrepreneurship / Design / Marketing",
      geoPrefs: ["south", "east", "any"],
      structuredActivities: [
        act("Custom apparel business", "activity", "Founder", "Founder of custom apparel business", { scope: "local", majorRelated: "yes" }),
        act("Club merch design", "arts", "Designer", "Designed merch for 12 school clubs", { scope: "school", majorRelated: "yes" }),
        act("Arts festival social media", "activity", "Social media manager", "Social media manager for school arts festival", { scope: "school", majorRelated: "yes" }),
        act("Nonprofit marketing intern", "internship", "Marketing intern", "Marketing intern for local nonprofit", { scope: "local", majorRelated: "yes" }),
        act("Entrepreneurship club", "club", "President", "President of entrepreneurship club", { scope: "school", majorRelated: "yes" }),
        act("Etsy shop", "activity", "Founder", "Runs Etsy shop with $8,000 in sales", { outcome: "$8,000 sales", scope: "national", majorRelated: "yes" }),
      ],
    }),
    expectedReach: tier("Babson College", "Parsons School of Design", "NYU"),
    expectedMatch: tier("Northeastern University", "Syracuse University", "Emory University"),
    expectedSafety: tier("University of Georgia", "Spelman College", "Savannah College of Art and Design"),
  },
];

function normalizeCase(raw) {
  return {
    case_key: raw.caseKey,
    title: raw.title,
    tags: raw.tags ?? [],
    locale: "en",
    report_body: raw.reportBody,
    expected_reach: raw.expectedReach ?? [],
    expected_match: raw.expectedMatch ?? [],
    expected_safety: raw.expectedSafety ?? [],
    forbidden_schools: raw.forbiddenSchools ?? [],
    notes: raw.notes ?? null,
    active: true,
    created_by: "seed-marketing-eval-cases.mjs",
    updated_at: new Date().toISOString(),
  };
}

const payloads = MARKETING_CASES.map(normalizeCase);

if (dryRun) {
  console.log(`Dry run: would upsert ${payloads.length} marketing cases:`);
  for (const p of payloads) console.log(`  - ${p.case_key}: ${p.title}`);
  process.exit(0);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let ok = 0;
let failed = 0;

for (const payload of payloads) {
  const { data, error } = await admin
    .from("report_eval_cases")
    .upsert(payload, { onConflict: "case_key" })
    .select("case_key, title")
    .single();

  if (error) {
    failed += 1;
    console.error(`FAIL ${payload.case_key}:`, error.message);
    continue;
  }
  ok += 1;
  console.log(`OK   ${data.case_key}: ${data.title}`);
}

console.log(`\nDone. ${ok} upserted, ${failed} failed.`);
if (failed > 0) process.exit(1);
