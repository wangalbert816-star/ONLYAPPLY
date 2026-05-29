import type { ProfileDimension, ProfileDimensionKey } from "../../lib/fiveDimensionProfile";
import "./AccountSnapshotRadar.css";

const VIEW_W = 220;
const VIEW_H = 188;
const CX = 110;
const CY = 88;
const R = 54;
const R_LABEL = 72;
const ANGLES_DEG = [-90, -18, 54, 126, 198];

function pt(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function polygonForScale(scale: number) {
  return ANGLES_DEG.map((deg, i) => {
    const { x, y } = pt(deg, R * scale);
    return `${i === 0 ? "" : " "}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join("");
}

type Props = {
  dimensions: ProfileDimension[];
  weakestKey?: ProfileDimensionKey;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export function AccountSnapshotRadar({ dimensions, weakestKey, t }: Props) {
  const dataPts = dimensions.map((it, i) => {
    const clamp = Math.max(8, Math.min(100, it.score)) / 100;
    return { ...pt(ANGLES_DEG[i], R * clamp), key: it.key };
  });
  const dataPoly = dataPts.map((p, i) => `${i === 0 ? "" : " "}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");

  return (
    <div className="account-snapshot-radar">
      <svg
        className="account-snapshot-radar__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={t("auth.accountSnapshotRadarAria")}
      >
        <title>{t("auth.accountSnapshotRadarAria")}</title>
        {[0.25, 0.5, 0.75, 1].map((s) => (
          <polygon key={s} className="account-snapshot-radar__grid" points={polygonForScale(s)} fill="none" />
        ))}
        {ANGLES_DEG.map((deg) => {
          const outer = pt(deg, R);
          return (
            <line
              key={deg}
              className="account-snapshot-radar__axis"
              x1={CX}
              y1={CY}
              x2={outer.x}
              y2={outer.y}
            />
          );
        })}
        <polygon className="account-snapshot-radar__area" points={dataPoly} />
        <polyline className="account-snapshot-radar__stroke" points={dataPoly} />
        {ANGLES_DEG.map((deg, i) => {
          const dim = dimensions[i];
          const { x, y } = pt(deg, R_LABEL);
          const anchor = x > CX + 8 ? "start" : x < CX - 8 ? "end" : "middle";
          const dy = y < CY - 14 ? -3 : y > CY + 14 ? 12 : 5;
          return (
            <text
              key={dim.key}
              className="account-snapshot-radar__label"
              x={x}
              y={y + dy}
              textAnchor={anchor}
            >
              {t(`report.profileFive.axisShort.${dim.key}`)}
            </text>
          );
        })}
        {dataPts.map((p) => (
          <circle
            key={p.key}
            className={`account-snapshot-radar__node${weakestKey === p.key ? " account-snapshot-radar__node--weak" : ""}`}
            cx={p.x}
            cy={p.y}
            r="3.5"
          />
        ))}
      </svg>
    </div>
  );
}
