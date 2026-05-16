import type { ProfileDimension, ProfileDimensionKey } from "../../lib/fiveDimensionProfile";
import type { Locale } from "../../i18n/strings";

/* 加大 viewBox 底边留白，避免轴标签贴边；导出时整图不拆页 */
const VIEW_W = 320;
const VIEW_H = 272;
const CX = 160;
const CY = 128;
const R = 64;
const R_LABEL = 86;
const ANGLES_DEG = [-90, -18, 54, 126, 198];

function pt(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function polygonForScale(scale: number): string {
  return ANGLES_DEG.map((deg, i) => {
    const { x, y } = pt(deg, R * scale);
    return `${i === 0 ? "" : " "}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join("");
}

function axisShort(key: ProfileDimensionKey, locale: Locale): string {
  const zh: Record<ProfileDimensionKey, string> = {
    academic: "学术",
    testing: "标化",
    activities: "活动",
    essays: "文书",
    strategy: "策略",
  };
  const en: Record<ProfileDimensionKey, string> = {
    academic: "GPA",
    testing: "Test",
    activities: "Act.",
    essays: "Essay",
    strategy: "List",
  };
  return locale === "en" ? en[key] : zh[key];
}

type Props = {
  items: ProfileDimension[];
  locale: Locale;
  weakestKey: ProfileDimensionKey;
};

export function PdfProfileRadar({ items, locale, weakestKey }: Props) {
  const dataPts = items.map((it, i) => {
    const clamp = Math.max(8, Math.min(100, it.score)) / 100;
    return pt(ANGLES_DEG[i], R * clamp);
  });
  const dataPoly = dataPts.map((p, i) => `${i === 0 ? "" : " "}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");

  return (
    <div className="pdf-radar-wrap">
      <svg className="pdf-radar" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-hidden>
        {[0.25, 0.5, 0.75, 1].map((s) => (
          <polygon key={s} className="pdf-radar__grid" points={polygonForScale(s)} fill="none" />
        ))}
        {ANGLES_DEG.map((deg) => {
          const outer = pt(deg, R);
          return <line key={deg} className="pdf-radar__axis" x1={CX} y1={CY} x2={outer.x} y2={outer.y} />;
        })}
        <polygon className="pdf-radar__area" points={dataPoly} />
        <polyline className="pdf-radar__stroke" points={dataPoly} />
        {ANGLES_DEG.map((deg, i) => {
          const dim = items[i];
          const { x, y } = pt(deg, R_LABEL);
          const anchor = x > CX + 8 ? "start" : x < CX - 8 ? "end" : "middle";
          const dy = y < CY - 18 ? -2 : y > CY + 14 ? 12 : 4;
          return (
            <text key={dim.key} className="pdf-radar__label" x={x} y={y + dy} textAnchor={anchor}>
              {axisShort(dim.key, locale)}
            </text>
          );
        })}
        {dataPts.map((p, i) => {
          const dim = items[i];
          const weak = dim.key === weakestKey;
          return (
            <circle
              key={dim.key}
              className={`pdf-radar__node${weak ? " pdf-radar__node--weak" : ""}`}
              cx={p.x}
              cy={p.y}
              r={weak ? 5 : 4}
            />
          );
        })}
      </svg>
    </div>
  );
}
