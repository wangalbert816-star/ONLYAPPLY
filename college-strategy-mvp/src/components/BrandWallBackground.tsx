import type { CSSProperties } from "react";
import { useMemo } from "react";
import type { MarqueeSchool } from "./UniversityLogoMarquee";
import { DEFAULT_MARQUEE_SCHOOLS } from "./UniversityLogoMarquee";
import { repeatMarqueeStrip } from "../utils/repeatMarqueeStrip";
import "./BrandWallBackground.css";

type RowDirection = "left" | "right";

type RowConfig = {
  durationSec: number;
  delaySec: number;
  direction: RowDirection;
  marginTop: string;
  marginBottom: string;
  stripOffsetPx: number;
  logoOpacity: number;
  logoSizePx: number;
};

/** 2 行、双向、慢速；固定在视口底部，落在页面免责声明段落之下 */
const ROWS: RowConfig[] = [
  {
    durationSec: 220,
    delaySec: -8,
    direction: "left",
    marginTop: "1.4vh",
    marginBottom: "1.6vh",
    stripOffsetPx: 20,
    logoOpacity: 0.36,
    logoSizePx: 80,
  },
  {
    durationSec: 185,
    delaySec: -22,
    direction: "right",
    marginTop: "0.9vh",
    marginBottom: "1.2vh",
    stripOffsetPx: -48,
    logoOpacity: 0.33,
    logoSizePx: 74,
  },
];

const STRIP_REPEAT = 10;

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type LogoSlot = {
  school: MarqueeSchool;
  marginRight: number;
};

function buildSlots(schools: MarqueeSchool[], rowIndex: number): LogoSlot[] {
  return schools.map((school, idx) => {
    const h = hash(`${rowIndex}|${school.id}|${idx}`);
    return {
      school,
      marginRight: 18 + (h % 48),
    };
  });
}

function rotateSchools(schools: MarqueeSchool[], rowIndex: number): MarqueeSchool[] {
  const n = schools.length;
  const shift = (rowIndex * 11 + rowIndex * rowIndex * 3) % n;
  return [...schools.slice(shift), ...schools.slice(0, shift)];
}

function LogoCells({ slots, suffix }: { slots: LogoSlot[]; suffix: string }) {
  return (
    <>
      {slots.map((slot, i) => (
        <div
          className="brand-wall-logo"
          key={`${slot.school.id}-${suffix}-${i}`}
          style={{ marginRight: slot.marginRight }}
        >
          <img src={slot.school.logoUrl} alt="" loading="lazy" decoding="async" draggable={false} />
        </div>
      ))}
    </>
  );
}

function RowStrip({ slots, config }: { slots: LogoSlot[]; config: RowConfig }) {
  const rowVars = {
    marginTop: config.marginTop,
    marginBottom: config.marginBottom,
    "--bw-dur": `${config.durationSec}s`,
    "--bw-delay": `${config.delaySec}s`,
    "--bw-logo-opacity": String(config.logoOpacity),
    "--bw-logo-size": `${config.logoSizePx}px`,
  } as CSSProperties;

  const trackClass =
    "brand-wall-track" + (config.direction === "right" ? " brand-wall-track--rev" : "");

  return (
    <div className="brand-wall-row" style={rowVars}>
      <div
        className="brand-wall-strip-nudge"
        style={{ transform: `translate3d(${config.stripOffsetPx}px, 0, 0)` }}
      >
        <div className={trackClass}>
          <div className="brand-wall-group" role="presentation">
            <LogoCells slots={slots} suffix="a" />
          </div>
          <div className="brand-wall-group" aria-hidden>
            <LogoCells slots={slots} suffix="b" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 全屏底层：2 行双向慢速跑马灯 + 轻遮罩；条带贴底，与 .app 底部留白对齐 */
export function BrandWallBackground() {
  const rows = useMemo(
    () =>
      ROWS.map((config, i) => ({
        config,
        slots: buildSlots(
          repeatMarqueeStrip(rotateSchools(DEFAULT_MARQUEE_SCHOOLS, i), STRIP_REPEAT),
          i,
        ),
        key: i,
      })),
    [],
  );

  return (
    <div className="brand-wall-bg" aria-hidden>
      <div className="brand-wall-canvas">
        <div className="brand-wall-bottom-band">
          <div className="brand-wall-rows">
            {rows.map(({ config, slots, key }) => (
              <RowStrip key={key} config={config} slots={slots} />
            ))}
          </div>
        </div>
      </div>
      <div className="brand-wall-vignette" />
    </div>
  );
}

export default BrandWallBackground;
