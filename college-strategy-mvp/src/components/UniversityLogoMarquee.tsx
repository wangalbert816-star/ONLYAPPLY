import { useCallback, useMemo, useState, type CSSProperties } from "react";
import babsonLogo from "../assets/logos/babson.png";
import nyuLogo from "../assets/logos/nyu.png";
import princetonLogo from "../assets/logos/princeton.png";
import berkeleyLogo from "../assets/logos/berkeley.png";
import brownLogo from "../assets/logos/brown.png";
import columbiaLogo from "../assets/logos/columbia.png";
import dukeLogo from "../assets/logos/duke.png";
import harvardLogo from "../assets/logos/harvard.png";
import michiganLogo from "../assets/logos/michigan.png";
import mitLogo from "../assets/logos/mit.png";
import stanfordLogo from "../assets/logos/stanford.png";
import uclaLogo from "../assets/logos/ucla.png";
import "./UniversityLogoMarquee.css";
import { repeatMarqueeStrip } from "../utils/repeatMarqueeStrip";

export interface MarqueeSchool {
  id: string;
  name: string;
  /** 打包后的资源 URL（`import … from '../assets/…'`）或外链 */
  logoUrl: string;
}

/** 自托管 logo（Vite 打包）；前景条、底层墙共用；纯装饰，不承载交互 */
export const DEFAULT_MARQUEE_SCHOOLS: MarqueeSchool[] = [
  { id: "harvard", name: "Harvard", logoUrl: harvardLogo },
  { id: "stanford", name: "Stanford", logoUrl: stanfordLogo },
  { id: "columbia", name: "Columbia", logoUrl: columbiaLogo },
  { id: "brown", name: "Brown", logoUrl: brownLogo },
  { id: "duke", name: "Duke", logoUrl: dukeLogo },
  { id: "michigan", name: "Michigan", logoUrl: michiganLogo },
  { id: "ucla", name: "UCLA", logoUrl: uclaLogo },
  { id: "berkeley", name: "Berkeley", logoUrl: berkeleyLogo },
  { id: "mit", name: "MIT", logoUrl: mitLogo },
  { id: "nyu", name: "NYU", logoUrl: nyuLogo },
  { id: "princeton", name: "Princeton", logoUrl: princetonLogo },
  { id: "babson", name: "Babson College", logoUrl: babsonLogo },
];

export interface UniversityLogoMarqueeProps {
  schools?: MarqueeSchool[];
  /** 单圈滚动时长，越大越慢 */
  durationSec?: number;
  className?: string;
  /** 首页中部：彩色原色 logo，无灰度 */
  colored?: boolean;
}

function InitialFallback({ name }: { name: string }) {
  const letter = name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "?";
  return <span className="marquee-fallback-letter">{letter}</span>;
}

export function UniversityLogoMarquee({
  schools = DEFAULT_MARQUEE_SCHOOLS,
  durationSec,
  className = "",
  colored = false,
}: UniversityLogoMarqueeProps) {
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const onImgError = useCallback((id: string) => {
    setBroken((prev) => ({ ...prev, [id]: true }));
  }, []);

  const effectiveDuration = durationSec ?? (colored ? 120 : 280);
  const style = { "--marquee-duration": `${effectiveDuration}s` } as CSSProperties;

  const stripSchools = useMemo(() => repeatMarqueeStrip(schools, 12), [schools]);

  const renderLogo = (school: MarqueeSchool, keySuffix: string, loopDup = false) => {
    const wideMark = school.id === "babson" || school.id === "michigan" || school.id === "mit";
    const nyuMark = school.id === "nyu";
    const mitMark = school.id === "mit";
    const tallMark = school.id === "princeton" || school.id === "brown";
    const cellClass = [
      "marquee-logo-cell",
      wideMark ? "marquee-logo-cell--wide" : "marquee-logo-cell--standard",
      loopDup && "marquee-logo-cell--loop-dup",
    ]
      .filter(Boolean)
      .join(" ");
    const frameClass = [
      "marquee-logo-frame",
      wideMark && "marquee-logo-frame--wide",
      nyuMark && "marquee-logo-frame--nyu",
      mitMark && "marquee-logo-frame--mit",
      tallMark && "marquee-logo-frame--tall",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <div className={cellClass} key={`${school.id}-${keySuffix}`} aria-hidden>
        <div className={frameClass}>
          {broken[school.id] ? (
            <InitialFallback name={school.name} />
          ) : (
            <img
              src={school.logoUrl}
              alt=""
              loading="eager"
              decoding="async"
              draggable={false}
              onError={() => onImgError(school.id)}
            />
          )}
        </div>
      </div>
    );
  };

  const rootClass = ["university-logo-marquee", colored && "university-logo-marquee--colored", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} style={style} aria-hidden="true">
      <div className="marquee-fade marquee-fade--left" aria-hidden />
      <div className="marquee-fade marquee-fade--right" aria-hidden />
      <div className="marquee-viewport">
        <div className="marquee-track">
          <div className="marquee-group">
            {stripSchools.map((s, i) => renderLogo(s, `a-${i}`))}
            {stripSchools.map((s, i) => renderLogo(s, `b-${i}`, true))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UniversityLogoMarquee;
