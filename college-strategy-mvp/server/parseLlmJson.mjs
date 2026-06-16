/** Parse JSON from LLM output (markdown fences, trailing prose, truncation). */

function salvageTruncatedJsonObject(raw) {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let text = raw.slice(start).trimEnd();
  text = text.replace(/,\s*"[^"]*$/s, "").replace(/,\s*$/s, "");
  const stack = [];
  for (const ch of text) {
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if ((ch === "}" || ch === "]") && stack.length) stack.pop();
  }
  while (stack.length) text += stack.pop();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function parseJsonFromLlm(raw) {
  let s = String(raw ?? "").trim();
  if (!s) {
    const err = new Error("empty_llm_response");
    err.code = "invalid_json";
    throw err;
  }
  const fenced = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/im);
  if (fenced) s = fenced[1].trim();
  else if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    const salvaged = salvageTruncatedJsonObject(s);
    if (salvaged) return salvaged;
    const err = new Error(`invalid_json (${s.length} chars)`);
    err.code = "invalid_json";
    throw err;
  }
}
