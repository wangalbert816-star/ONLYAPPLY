import type { ApplicationLinkCategoryId } from "./applicationLinks";

type Props = { categoryId: ApplicationLinkCategoryId; className?: string };

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function RoadmapCategoryIcon({ categoryId, className = "" }: Props) {
  const cn = `fs-roadmap-cat-icon ${className}`.trim();

  switch (categoryId) {
    case "submission":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden {...stroke}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h5" />
        </svg>
      );
    case "testing":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden {...stroke}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "essays":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden {...stroke}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      );
    case "financial":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden {...stroke}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v12" />
          <path d="M15 9.5c0-1.5-1.34-2.5-3-2.5S9 8 9 9.5s1.34 2.5 3 2.5 3 1 3 2.5-1.34 2.5-3 2.5-3-1-3-2.5" />
        </svg>
      );
    case "majors":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden {...stroke}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "research":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden {...stroke}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      );
    case "summer":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden {...stroke}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    case "scholarships":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden {...stroke}>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10a2 2 0 0 1 2 2v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V6a2 2 0 0 1 2-2z" />
          <path d="M5 6H3v1a3 3 0 0 0 3 3" />
          <path d="M19 6h2v1a3 3 0 0 1-3 3" />
        </svg>
      );
    case "researchPrograms":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden {...stroke}>
          <path d="M10 2v6.5L5.5 18.5A2 2 0 0 0 7.3 21.5h9.4a2 2 0 0 0 1.8-3L14 8.5V2" />
          <path d="M8.5 2h7" />
          <path d="M7 14h10" />
        </svg>
      );
    case "official":
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden {...stroke}>
          <circle cx="12" cy="12" r="9" />
          <path d="M2 12h20" />
          <path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z" />
        </svg>
      );
    default:
      return null;
  }
}
