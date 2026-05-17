import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { BrandLogo } from "./BrandLogo";
import "./BrandStoryOverlay.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
};

type LetterParagraph = { text: string; kind?: "question" | "emphasis" | "pause" };

const storyCopy = {
  zh: {
    close: "关闭",
    eyebrow: "产品理念",
    title: "把申请季里的混乱，整理成一个能继续往前走的判断。",
    intro:
      "OnlyApply 是一个 AI 申请判断与文书修改工作区。它不承诺录取，不替你决定去哪所学校，也不替你写最终文书；它只是把你的背景、目标、约束、风险和草稿放在一起，帮你看清自己大概站在哪里，以及下一步最该补什么、改什么。",
    letterLabel: "写给正在申请的你",
    letterParagraphs: [
      { text: "如果你在申请季，你大概已经被很多东西包围了。" },
      { text: "排名、冲刺、保底、活动、文书、分数、预算、身份、截止日期，还有别人一句一句给你的建议。" },
      { text: "你可能已经研究了很久，也做了很多准备，但你心里可能还是不太确定：" },
      { text: "我现在到底在什么位置？\n我做的这些，到底够不够？", kind: "question" },
      { text: "这种感觉，其实很正常。", kind: "emphasis" },
      { text: "不是你不努力，也不是你哪里做错了，" },
      { text: "而是这些信息，本来就很碎，很少有人真的把它们放在一起讲清楚。" },
      { text: "你不缺信息。你缺的是一个更清楚的判断，和一个能继续往前改的地方。", kind: "emphasis" },
      { text: "申请这件事，说到底不是比谁更会“填表”，也不是把自己包装成另一个人。" },
      { text: "它更像是在不确定的情况下，把真实的你、现实的限制、学校的判断标准，一点点对齐。" },
      { text: "OnlyApply 做的事情，其实很简单：", kind: "pause" },
      { text: "不是替你决定去哪所学校，也不是替你写一篇文书，更不是告诉你“你行不行”。" },
      { text: "只是在你已经做了这么多之后，帮你把现在的情况尽量讲清楚一点：" },
      { text: "你大概在哪一档，\n真正限制你的是什么，\n下一步该补信息、调策略，还是把某段经历写清楚。", kind: "question" },
      { text: "报告是起点。后面的补充信息、判断更新、文书方向和段落反馈，都是为了让这个判断继续变准确。" },
      { text: "我们不希望 AI 替你做决定，也不希望 AI 替你发声。" },
      { text: "我们更希望它像一个很耐心的整理者：把混乱摊开，把问题指出来，再陪你改到下一版。" },
      { text: "这样，当你做选择、改名单、写文书的时候，不是因为焦虑，而是因为你至少知道自己在做什么。" },
      { text: "走完申请这段路的人，大多都会发现一件事：" },
      { text: "最难的，从来不是努力，而是在努力很多之后，还能看清自己到底在什么位置。", kind: "emphasis" },
      { text: "希望 OnlyApply 至少能在这件事上，帮你轻一点，清楚一点。" },
    ] satisfies LetterParagraph[],
    signature: ["一个走过这段申请的人", "OnlyApply 创始人", "写于 Babson College"],
    start: "开始填写问卷",
  },
  en: {
    close: "Close",
    eyebrow: "Product Philosophy",
    title: "Turn the chaos of application season into a judgment you can keep moving with.",
    intro:
      "OnlyApply is an AI workspace for application judgment and essay revision. It does not promise admission, choose schools for you, or write your final essay. It puts your background, goals, constraints, risks, and drafts in one place so you can see where you stand and what to improve next.",
    letterLabel: "A Letter To You, In Application Season",
    letterParagraphs: [
      { text: "If you are in application season, you are probably surrounded by a lot already." },
      { text: "Rankings, reaches, safeties, activities, essays, scores, budget, identity, deadlines, and one more piece of advice from one more person." },
      { text: "You may have researched for months. You may have done a lot. And still, somewhere in the back of your mind, you may not feel sure:" },
      { text: "Where do I actually stand?\nIs what I have done enough?", kind: "question" },
      { text: "That feeling is normal.", kind: "emphasis" },
      { text: "It does not mean you are not working hard. It does not mean you did something wrong." },
      { text: "The problem is that the information is fragmented, and very few people put it together clearly." },
      { text: "You do not need more noise. You need clearer judgment, and a place to keep revising from there.", kind: "emphasis" },
      { text: "Applying is not really about who can fill out forms better. It is not about packaging yourself into someone else." },
      { text: "It is about aligning who you are, what limits are real, and how schools will read your file." },
      { text: "What OnlyApply does is simple:", kind: "pause" },
      { text: "It does not decide where you should go. It does not write your essay for you. It does not tell you whether you are “good enough.”" },
      { text: "After you have already done so much, it tries to make the current picture a little clearer:" },
      { text: "Where you roughly stand,\nwhat is actually holding the file back,\nand whether the next move is more information, a strategy change, or making one story clearer.", kind: "question" },
      { text: "The report is the starting point. The follow-up questions, updated judgment, essay direction, and paragraph feedback are all there to make that judgment more accurate." },
      { text: "We do not want AI to decide for you. We do not want AI to speak for you." },
      { text: "We want it to act more like a patient organizer: lay out the mess, point to the real problem, and help you get to the next draft." },
      { text: "So when you choose schools, adjust a list, or revise an essay, you are not moving only because of anxiety. You at least know what you are doing." },
      { text: "Most people who make it through this process realize one thing:" },
      { text: "The hardest part is not effort. It is seeing where you stand after you have already tried so hard.", kind: "emphasis" },
      { text: "I hope OnlyApply can make that part a little lighter, and a little clearer." },
    ] satisfies LetterParagraph[],
    signature: ["Someone who has been through it", "Founder of OnlyApply", "Written at Babson College"],
    start: "Start Questionnaire",
  },
};

export function BrandStoryOverlay({ open, onClose, onStart }: Props) {
  const { locale } = useLanguage();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const copy = storyCopy[locale];

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
            {copy.close} <kbd className="brand-story__kbd">Esc</kbd>
          </button>
        </header>

        <main className="brand-story__main">
          <section className="brand-story__hero" aria-labelledby={titleId}>
            <BrandLogo className="brand-story__logo" />
            <p className="brand-story__eyebrow">{copy.eyebrow}</p>
            <h1 id={titleId}>{copy.title}</h1>
            <p className="brand-story__intro">{copy.intro}</p>
          </section>

          <article className="brand-story__letter" aria-label={copy.letterLabel}>
            <p className="brand-story__letter-kicker">{copy.letterLabel}</p>
            {copy.letterParagraphs.map((paragraph) => (
              <p
                key={paragraph.text}
                className={paragraph.kind ? `brand-story__letter-line brand-story__letter-line--${paragraph.kind}` : "brand-story__letter-line"}
              >
                {paragraph.text}
              </p>
            ))}
            <footer className="brand-story__signature" aria-label="署名">
              {copy.signature.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </footer>
          </article>
        </main>

        <footer className="brand-story__foot">
          <div className="brand-story__actions">
            <button type="button" className="btn btn-primary brand-story__start" onClick={onStart}>
              {copy.start}
            </button>
            <button type="button" className="btn btn-secondary brand-story__secondary" onClick={onClose}>
              {copy.close}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
