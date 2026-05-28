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
    letterLabel: "创始人来信",
    letterParagraphs: [
      {
        text: "申请季里熬过一整个长夜之后，常常会有一种特别的安静——事情还没完，但人已经先静下来了。",
      },
      {
        text: "浏览器标签页还开着，选校表填了一半，某所学校的招生页面在屏幕上发着光；在排名、文书、截止日期、分数、预算，以及身边每一个人的建议之间，整个申请开始模糊成一片。",
      },
      {
        text: "你可能已经研究了好几个月，可能把同一段文字改到不再像你自己，可能建好了名单、勾完了清单、问遍了该问的问题，却仍然会想：",
      },
      {
        text: "我现在到底在什么位置？\n我已经做的这一切，够不够？",
        kind: "question",
      },
      {
        text: "这种不确定，并不代表你落后了。",
        kind: "emphasis",
      },
      {
        text: "它只说明：你正站在一个要求你做出人生级决定的流程中间——信息零散、背景不完整、压力从四面八方涌来。",
      },
      { text: "大多数学生需要的，不是再多一个被扔进噪音里的意见。" },
      { text: "他们需要的是清晰。", kind: "emphasis" },
      {
        text: "不是那种假装能预测未来的清晰，而是能更诚实地看清当下的清晰。",
      },
      {
        text: "大学申请不只是展示成就，更是翻译：把多年的努力、身份、成长、抱负、限制与可能，压缩成别人几分钟内会读完的一份材料。难点往往不在「无话可说」，而在「太多可说」——太多草稿、太多角度、太多恐惧，太多版本的自己同时挤在桌上。",
      },
      { text: "OnlyApply 就是为那一刻而建的。", kind: "pause" },
      {
        text: "它不会替你决定未来，不会代替你书写人生，也不会把你的价值简化成一个分数、一次考试或一句判断。",
      },
      {
        text: "它会帮你停下来，看清申请材料的大致轮廓：你大概站在哪里、什么可能在拖住你的档案，以及下一步是该加强选校名单、重新定位，还是让某一个故事终于听起来像背后的那个人。",
      },
      { text: "报告只是开始。" },
      {
        text: "后续的追问、更新反馈、文书方向与段落建议，都是为了把判断磨得更准，而不是取代你的声音。",
      },
      {
        text: "我们不相信 AI 应该替你说。我们相信它应该帮你整理这间屋子，让你更能听见自己的声音。",
        kind: "emphasis",
      },
      {
        text: "OnlyApply 像一位耐心的向导：把散落的页面铺开，轻轻指向真正重要的地方，陪你走向下一稿、下一个决定、下一个更清晰的版本。",
      },
      {
        text: "所以当你调整名单、修改文书、重新思考自己如何呈现时，你不只是在恐慌中挪动——你是在带着意图行动。你明白自己在改什么，也明白为什么。",
      },
      {
        text: "因为对很多学生来说，申请季最难的不是工作本身，而是在已经付出这么多之后，仍想看清自己究竟站在哪里。",
        kind: "emphasis",
      },
      {
        text: "希望 OnlyApply 能让这一部分，轻一点、静一点、也清楚一点。",
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
          <section className="brand-story__hero" aria-labelledby={titleId}>
            <BrandLogo className="brand-story__logo" />
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
