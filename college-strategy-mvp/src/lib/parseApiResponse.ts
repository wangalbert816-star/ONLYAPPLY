export type ApiJsonFailureKind = "gateway" | "invalid_json" | "empty";

export type ApiJsonReadResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; kind: ApiJsonFailureKind };

/** Read response body as JSON; detect Vercel/HTML gateway failures that break res.json(). */
export async function readApiJson(res: Response): Promise<ApiJsonReadResult> {
  const text = await res.text();
  if (!text.trim()) {
    return { ok: false, kind: res.status === 504 || res.status === 502 ? "gateway" : "empty" };
  }
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (data && typeof data === "object") return { ok: true, data };
    return { ok: false, kind: "invalid_json" };
  } catch {
    const gateway =
      res.status === 504 ||
      res.status === 502 ||
      /FUNCTION_INVOCATION_TIMEOUT|An error occurred with your deployment|Gateway Timeout/i.test(text);
    return { ok: false, kind: gateway ? "gateway" : "invalid_json" };
  }
}
