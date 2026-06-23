import { apiUrl } from "./apiBase";

export type ChancesTestMode = "sat" | "act";

export type ChancesInput = {
  gpa: string;
  testMode: ChancesTestMode;
  satScore: string;
  actScore: string;
};

export type ChancesSchoolResult = {
  school: string;
  abbreviation?: string;
  inTable: boolean;
  selectivity?: number;
  fitScore?: number;
  tier?: "reach" | "match" | "safety";
  engineGap?: number;
  flags?: string[];
  campusSize?: string | null;
  community?: string | null;
  acceptanceRate?: number | null;
  reason?: string;
};

export type ChancesEvaluateResponse = {
  academicScore: number;
  student: {
    uwGpa: number | null;
    sat: number | null;
    act: number | null;
    testOptionalNoScore: boolean;
    intl: boolean;
  };
  schools: ChancesSchoolResult[];
};

async function readJson<T>(res: Response): Promise<T> {
  const raw = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    throw new Error("request_failed");
  }
  if (!res.ok) {
    throw new Error(String(body.error ?? res.statusText ?? "request_failed"));
  }
  return body as T;
}

export async function searchChancesSchools(query: string): Promise<{ school: string; selectivity: number | null }[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(apiUrl(`/api/chances/schools?q=${encodeURIComponent(q)}&limit=10`));
  const data = await readJson<{ schools?: { school: string; selectivity: number | null }[] }>(res);
  return data.schools ?? [];
}

export async function evaluateChances(
  input: ChancesInput,
  schools: string[],
): Promise<ChancesEvaluateResponse> {
  const res = await fetch(apiUrl("/api/chances/evaluate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gpa: input.gpa,
      testMode: input.testMode,
      satScore: input.testMode === "sat" ? input.satScore : "",
      actScore: input.testMode === "act" ? input.actScore : "",
      schools,
    }),
  });
  return readJson<ChancesEvaluateResponse>(res);
}
