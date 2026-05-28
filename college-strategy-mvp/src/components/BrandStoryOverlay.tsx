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
        text: "展信安康",
      },
      {
        text: "当我写下这封信想要和你们说些什么的时候，我仿佛看到了曾经的自己：十七岁的年纪，埋在密密麻麻的选校清单里，十几年来的经历浓缩在一份表单里，对着高低起伏的院校排名反复焦虑，被海量的申请规则、文书逻辑、择校规划裹挟前行。",
      },
      {
        text: "我曾经和你们一样迷茫，我也曾经忐忑过、焦虑过。所有人都执着于名校的光环。纠结于标化成绩的高低，盲目追随着大多数人所谓的“最好的选择”。我们光顾着赶路，甚至从未停下来问问自己：我到底想要的是什么？这个学校真的匹配我的性格和我的未来吗？无人梳理的混乱的申请思路，无人拆解的复杂的申请逻辑，我们也曾经在焦虑中探索，在内卷中内耗。",
      },
      {
        text: "一路走来，我们深知美本申请从来不是简单的“分数决定一切，排名决定胜负”，而是一场自我认知和人生选择的双向匹配。这正是我们选择创立OnlyApply的初心和底气。",
      },
      {
        text: "我们相信很多人都告诉过你们，冲刺高排名院校、拿下顶尖名校的offer，是申请季的唯一目标。不可否认，优质的院校排名、顶尖的校园资源，是你们人生道路中耀眼的勋章，也是我们共同努力的目标之一，能为你们的人生铺路搭桥，我们感到无比荣幸。",
        kind: "emphasis",
      },
      {
        text: "但走过完整的申请路、经历过择校的迷茫与抉择，我想告诉你们一句最真诚的话：名校的光环转瞬即逝，适合自己的道路，才会贯穿余生。",
      },
      {
        text: "排名是冰冷的数字，但大学四年的成长、沉淀、蜕变，是滚烫且独一无二的。一所排名顶尖却与你格格不入的学校，只会让你在陌生的环境里内耗、迷茫、失去自我；而一所适配你的性格、契合你的热爱、包容你的特质、匹配你人生规划的学校，会成为你的沃土，托举你的热爱，成全你的理想，让你在四年里野蛮生长、闪闪发光。",
        kind: "emphasis",
      },
      {
        text: "这就是OnlyApply一直坚守的申请逻辑：不唯排名、不随大流、不追模板，只为每一个申请者找到专属的成长赛道。\n有的人进到了大众公认的名校，却错失了匹配自己的归宿；有的人，在契合的校园里，解锁了无限的、新的可能。我们深耕申请、打磨体系、梳理逻辑，不是仅仅为了帮大家堆砌光鲜的offer，而是帮你们拨开申请季的迷雾，理清择校的底层逻辑，跳出内卷的焦虑陷阱，看清自己的优势、明晰自己的目标，真正读懂：申请的终点，从来不是一张名校录取通知书，而是一场忠于自我的人生选择。",
        kind: "pause",
      },
      {
        text: "十七岁的申请季，是每个人青春里最热烈也最忐忑的一段旅程。我们始终怀揣一个纯粹的心愿：多年以后，当你们褪去青涩、奔赴山海，在二十多岁、三十多岁的人生路口回望，想起那个兵荒马乱、全力以赴的十七岁，想起这段意义非凡的申请时光，脑海中能清晰记得一个名字——OnlyApply。",
      },
      {
        text: "我们希望在所有人都执着于排名与光环的时候，是我们陪你沉淀自我、理清方向；是我们帮你摒弃盲从、打破焦虑，避开所有择校误区，挣脱世俗的评判标准，最终找到了最适合自己、最能成就自己的道路。",
      },
      {
        text: "于我们而言，帮你们拿到名校offer是一份成绩，但能陪伴你们认清自我、忠于本心、选对前路，是我们最大的荣幸，也是我们始终不变的初心。",
        kind: "emphasis",
      },
      {
        text: "亲爱的少年，不必焦虑内卷，不必盲从大众。申请的本质，是与自己对话，与未来相逢。",
      },
      {
        text: "愿你在择校时，不困于排名，不惑于流言；\n愿你所选之路，适配本心，不负热爱，不惧将来；\n愿多年回首，你会庆幸十七岁的自己勇敢坚定，也会感恩，有OnlyApply，陪你找到最适合自己的人生航向。",
        kind: "emphasis",
      },
      {
        text: "Only apply when it makes sense.",
      },
      {
        text: "OnlyApply 创始团队\n写于 Babson College",
        kind: "pause",
      },
    ] satisfies LetterParagraph[],
    signature: [],
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
