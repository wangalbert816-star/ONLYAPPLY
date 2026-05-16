import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { BrandLogo } from "./BrandLogo";
import "./BrandStoryOverlay.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
};

const letterParagraphs: { text: string; kind?: "question" | "emphasis" | "pause" }[] = [
  { text: "如果你在申请季，你大概已经被很多东西包围了。" },
  { text: "排名、冲刺、保底、活动、文书、分数、预算、身份、截止日期。" },
  { text: "你可能已经研究了很久，也做了很多准备，但你心里可能还是不太确定：" },
  { text: "我现在到底在什么位置？\n我做的这些，到底够不够？", kind: "question" },
  { text: "这种感觉，其实很正常。", kind: "emphasis" },
  { text: "不是你不努力，也不是你哪里做错了，" },
  { text: "而是这些信息，本来就很碎，很少有人真的把它们放在一起讲清楚。" },
  { text: "你不缺信息。你缺的是一个更清楚的判断。", kind: "emphasis" },
  { text: "申请这件事，说到底不是比谁更会“填表”，而是你要在不确定的情况下，做一个很真实的选择。" },
  { text: "OnlyApply 做的事情，其实很简单：", kind: "pause" },
  { text: "不是替你决定去哪所学校，也不是告诉你“你行不行”。" },
  { text: "只是在你已经做了这么多之后，帮你把现在的情况尽量讲清楚一点：" },
  { text: "你大概在哪一档，\n真正限制你的是什么，\n如果你想走得更远，还缺什么。", kind: "question" },
  { text: "这样，当你做选择的时候，不是因为焦虑，而是因为你至少知道自己在做什么。" },
  { text: "走完申请这段路的人，大多都会发现一件事：" },
  { text: "最难的，从来不是努力，而是搞清楚，自己到底在什么位置。", kind: "emphasis" },
  { text: "希望这份报告，至少能帮你想明白这一点。" },
];

export function BrandStoryOverlay({ open, onClose, onStart }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="brand-story" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="brand-story__scrim" onClick={onClose} />
      <div className="brand-story__panel">
        <header className="brand-story__bar">
          <span className="brand-story__chrome-title" aria-hidden>
            OnlyApply
          </span>
          <button ref={closeRef} type="button" className="brand-story__close" onClick={onClose}>
            关闭 <kbd className="brand-story__kbd">Esc</kbd>
          </button>
        </header>

        <main className="brand-story__main">
          <section className="brand-story__hero" aria-labelledby={titleId}>
            <BrandLogo className="brand-story__logo" />
            <p className="brand-story__eyebrow">产品理念</p>
            <h1 id={titleId}>把申请季里的混乱，整理成一份更清楚的判断。</h1>
            <p className="brand-story__intro">
              OnlyApply 是一个 AI 选校策略报告工具。它不承诺录取，也不替你决定去哪所学校；它只是把你的背景、目标、
              约束和风险放在一起，帮你看清自己大概站在哪里，以及下一步最该补什么。
            </p>
          </section>

          <article className="brand-story__letter" aria-label="写给正在申请的你">
            <p className="brand-story__letter-kicker">写给正在申请的你</p>
            {letterParagraphs.map((paragraph) => (
              <p
                key={paragraph.text}
                className={paragraph.kind ? `brand-story__letter-line brand-story__letter-line--${paragraph.kind}` : "brand-story__letter-line"}
              >
                {paragraph.text}
              </p>
            ))}
            <footer className="brand-story__signature" aria-label="署名">
              <span>一个走过这段申请的人</span>
              <span>OnlyApply 创始人</span>
              <span>写于 Babson College</span>
            </footer>
          </article>
        </main>

        <footer className="brand-story__foot">
          <div className="brand-story__actions">
            <button type="button" className="btn btn-primary brand-story__start" onClick={onStart}>
              开始填写问卷
            </button>
            <button type="button" className="btn btn-secondary brand-story__secondary" onClick={onClose}>
              关闭
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
