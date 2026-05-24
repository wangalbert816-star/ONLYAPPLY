/** LLM 偶发把 bullet 字段输出成 string；统一成 string[] */
export function coerceStringArray(value) {
  if (Array.isArray(value)) return value.map(String).filter((x) => x.trim()).map((x) => x.trim());
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}
