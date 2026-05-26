import { useEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Subtle auto-scroll wrapper for the landing sample report peek.
 * - Slowly scrolls down when not hovered.
 * - Pauses when user hovers/focuses (so they can scroll manually).
 */
export function SampleReportAutoScroll({ children, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isHoveredRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const step = () => {
      const node = containerRef.current;
      if (!node) return;

      const { scrollTop, scrollHeight, clientHeight } = node;
      const hasOverflow = scrollHeight > clientHeight + 8;
      if (!hasOverflow || isHoveredRef.current) {
        frameRef.current = window.requestAnimationFrame(step);
        return;
      }

      const atBottom = scrollTop + clientHeight >= scrollHeight - 2;
      const speed = 0.35; // px per frame (~20px/s at 60fps)

      if (atBottom) {
        // brief pause at bottom, then reset to top
        setTimeout(() => {
          const n = containerRef.current;
          if (!n) return;
          if (!isHoveredRef.current) {
            n.scrollTop = 0;
          }
        }, 900);
      } else {
        node.scrollTop = scrollTop + speed;
      }

      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseEnter={() => {
        isHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
      }}
      onFocus={() => {
        isHoveredRef.current = true;
      }}
      onBlur={() => {
        isHoveredRef.current = false;
      }}
    >
      {children}
    </div>
  );
}

