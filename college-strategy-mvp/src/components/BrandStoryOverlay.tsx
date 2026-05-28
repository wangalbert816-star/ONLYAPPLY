import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n/LanguageContext";
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
    letterLabel: "创始人来信",
    letterParagraphs: [
      {
        text: "申请季里，总有一些很长的夜。",
      },
      {
        text: "页面还亮着，名单还悬着，文书改到后来，连自己也有些认不出原来的句子。",
      },
      {
        text: "排名、截止日期、分数、预算、别人的建议，像许多条线交错在一起；你明明已经做了很多，却仍会在某个安静的时刻停下来，问自己：",
      },
      {
        text: "我如今，究竟站在哪里？",
        kind: "question",
      },
      {
        text: "这不是软弱，也不是迟疑。",
        kind: "emphasis",
      },
      {
        text: "只是大学申请从来不只是一次材料递交。它更像是一场漫长的翻译：把一个人的努力、性格、限制、野心、经历与尚未说清的可能，压缩进几页纸里，交给一个素未谋面的人去理解。",
      },
      {
        text: "难的往往不是没有故事。\n难的是故事太多，而判断太少。",
        kind: "emphasis",
      },
      {
        text: "OnlyApply 就是为这样的时刻而建的。",
        kind: "pause",
      },
      {
        text: "我们不相信申请应该只凭别人的建议，也不相信一个更响亮的名字，就一定意味着一个更正确的去处。我们希望先帮你把散落的信息铺开，看清哪些学校现实可冲，哪些选择仍有风险，哪些地方还需要被补足、被验证、被重新表达。",
      },
      {
        text: "报告不是终点，被一所好的大学录取也不是终点。",
        kind: "emphasis",
      },
      {
        text: "它更像是一盏灯，照出你现在的位置，也照出下一步该往哪里走。后续的追问、反馈、文书方向与策略建议，并不是为了替你做决定，而是为了让每一次修改、每一次取舍、每一次申请，都有更清楚的理由。比起去到排名最高的学校，我们相信去到一个更加适合自己的学校，才是正确的人生选择。",
      },
      {
        text: "我们不希望你只是申请更多学校。\n我们希望你申请得更明白。",
        kind: "emphasis",
      },
      {
        text: "因为真正好的选择，未必是旁人眼中最耀眼的名字；而是多年以后回望时，你仍然愿意承认：\n那是适合我的地方。\n那是我愿意再次选择的地方。",
      },
      {
        text: "这也是 OnlyApply 想做的事。\n让申请这件事，简单一点，也清楚一点。",
      },
      {
        text: "Only apply when it makes sense.",
        kind: "pause",
      },
    ] satisfies LetterParagraph[],
    signature: ["OnlyApply 创始人", "写于 Babson College"],
    start: "开始填写问卷",
  },
  en: {
    close: "Close",
    eyebrow: "Product Philosophy",
    title: "Turn the chaos of application season into a judgment you can keep moving with.",
    intro:
      "OnlyApply is an AI workspace for application judgment and essay revision. It does not promise admission, choose schools for you, or write your final essay. It puts your background, goals, constraints, risks, and drafts in one place so you can see where you stand and what to improve next.",
    letterLabel: "A Letter from the Founders",
    letterParagraphs: [
      {
        text: "There is a particular kind of silence that follows a long night of college applications.",
      },
      {
        text: "The tabs are still open. The spreadsheet is half-finished. A school’s admissions page glows on your screen, and somewhere between the rankings, essays, deadlines, scores, finances, and advice from everyone around you, the whole process begins to blur.",
      },
      {
        text: "You may have spent months researching. You may have revised the same paragraph until it no longer sounded like you. You may have built the list, checked the boxes, asked the questions, and still wondered:",
      },
      {
        text: "Where do I actually stand? Is everything I have done enough?",
        kind: "question",
      },
      {
        text: "That uncertainty does not mean you are behind. It means you are standing in the middle of a process that asks you to make life-shaping decisions with scattered information, incomplete context, and pressure from every direction.",
        kind: "emphasis",
      },
      { text: "What most students need is not another opinion thrown into the noise." },
      { text: "They need clarity.", kind: "emphasis" },
      {
        text: "Not the kind that pretends to predict the future, but the kind that helps you see the present more honestly.",
      },
      {
        text: "College applications are not just about presenting achievements. They are about translation: turning years of effort, identity, growth, ambition, limits, and possibility into a file someone else will read in a matter of minutes. That is where the process becomes difficult. Not because students have nothing to say, but because they often have too much. Too many drafts, too many angles, too many fears, and too many versions of themselves to make sense of at once.",
      },
      { text: "OnlyApply was built for that moment.", kind: "pause" },
      {
        text: "It does not decide your future for you. It does not write your story in your place. It does not reduce your worth to a number, a score, or a single judgment. Instead, it helps you pause long enough to see the shape of your application more clearly: where you roughly stand, what may be holding your file back, and whether your next step is strengthening your school list, rethinking your positioning, or making one story finally sound like the person behind it.",
      },
      { text: "The report is only the beginning." },
      {
        text: "The follow-up questions, updated feedback, essay direction, and paragraph suggestions are meant to refine the judgment, not replace your voice. We do not believe AI should speak for you. We believe it should help organize the room so you can hear yourself better.",
      },
      {
        text: "OnlyApply acts like a patient guide. It lays out the scattered pages, points gently to what matters, and helps you move toward the next draft, the next decision, and the next clearer version of your application.",
      },
      {
        text: "So when you adjust your list, revise an essay, or rethink how you are presenting yourself, you are not moving purely out of panic. You are moving with intention. You understand not just what you are changing, but why.",
      },
      {
        text: "Because for many students, the hardest part of application season is not the work itself. It is trying to see where you stand after you have already given so much of yourself to the process.",
        kind: "emphasis",
      },
      {
        text: "I hope OnlyApply can make that part feel a little lighter, a little quieter, and a little clearer.",
      },
    ] satisfies LetterParagraph[],
    signature: ["From the Founders of OnlyApply", "Written at Babson College"],
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
