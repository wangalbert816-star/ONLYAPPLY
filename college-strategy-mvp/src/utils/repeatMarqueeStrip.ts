/** 无缝横向跑马灯：每条半轨需足够长，避免 translate -50% 周期中途露出空白 */
export function repeatMarqueeStrip<T>(items: readonly T[], times: number): T[] {
  if (items.length === 0 || times < 1) return [...items];
  const out: T[] = [];
  for (let k = 0; k < times; k++) out.push(...items);
  return out;
}
