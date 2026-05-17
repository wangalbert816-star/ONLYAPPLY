import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { SUPPORT_EMAIL } from "../lib/support";
import { BrandLogo } from "./BrandLogo";
import "./LegalLinks.css";

type LegalDoc = "terms" | "privacy" | "disclaimer";

type LegalCopy = {
  title: string;
  updated: string;
  sections: { title: string; body: string[] }[];
};

const zhDocs: Record<LegalDoc, LegalCopy> = {
  terms: {
    title: "使用条款",
    updated: "最后更新：2026 年 5 月",
    sections: [
      {
        title: "服务性质",
        body: [
          "OnlyApply 提供 AI 生成的申请规划、报告解读和文书修改参考，不构成录取预测、录取保证、法律意见、财务建议、学校官方信息或最终升学顾问意见。",
          "文书方向、段落分析、示例改写和修改建议仅用于帮助你思考与修改，不代表人工顾问定稿，也不应被视为可直接提交的申请材料。",
          "报告中的学校建议、风险判断、费用、国际生政策、截止日期、奖助学金与申请要求，均需以各学校官网、Common App、官方招生办公室及当年政策为准。",
        ],
      },
      {
        title: "用户责任",
        body: [
          "你应确保提交的信息尽可能真实、准确、完整。若信息不完整、不准确或已过期，报告结果可能不适合你的实际情况。",
          "你不得将本服务用于伪造申请材料、冒充官方结论、转售报告、批量抓取内容，或未经授权提交他人敏感信息。",
        ],
      },
      {
        title: "解锁、邀请码与付费",
        body: [
          "免费预览仅展示报告的一部分。完整版可能包含完整学校名单、逐校理由、风险应对、行动计划和 PDF 下载。",
          "报告解锁通常按单份申请档案计算。若你在同一份申请档案中补充信息、更新活动或重新生成报告，系统会尽量沿用该档案的解锁状态；若你新建另一份申请档案或为不同学生/不同申请目标生成报告，可能需要单独解锁。",
          "文书分析可能作为独立功能提供，需要单独付费、订阅或使用指定邀请码解锁。报告解锁不一定自动包含文书分析解锁，具体以页面提示为准。",
          "付款由 Stripe 等第三方支付服务处理。OnlyApply 不保存完整银行卡信息；支付成功后的解锁以支付服务回调和我们记录的权益状态为准。",
          "邀请码仅供指定用户或活动使用，不得转售、滥用或公开传播。我们保留停用、撤销或限制邀请码的权利。",
        ],
      },
      {
        title: "责任限制",
        body: [
          "在法律允许范围内，OnlyApply 不对因使用或无法使用本服务导致的申请失败、错过截止日期、经济损失、机会损失或第三方争议承担间接、特殊或后果性责任。",
        ],
      },
    ],
  },
  privacy: {
    title: "隐私政策",
    updated: "最后更新：2026 年 5 月",
    sections: [
      {
        title: "我们收集的信息",
        body: [
          "我们可能收集登录信息、问卷信息、报告内容、补充说明、文书草稿、文书分析结果、分析历史、使用数据、邀请码兑换记录和解锁状态。",
          "问卷可能包含成绩、标化、预算、活动、结构化活动/竞赛、专业偏好、地区偏好、申请底线和其他申请规划相关信息。",
          "当你回答信息缺口、补充活动或更新申请档案时，这些补充信息可能会被保存到同一份申请档案或报告历史中，用于后续重新生成报告，减少重复提问并提高判断一致性。",
          "文书草稿可能包含你主动输入的个人经历、活动细节、家庭或成长背景等内容。请不要提交你无权提供的他人信息，或不希望系统处理的敏感内容。",
        ],
      },
      {
        title: "我们如何使用信息",
        body: [
          "这些信息用于生成和保存报告、保存申请档案和结构化活动、保留补充说明供后续报告使用、保存文书草稿与分析历史、提供登录与解锁功能、改善产品体验、排查错误、防止滥用，以及在你主动留下联系方式时与你沟通。",
          "我们可能保存支付状态、Stripe Checkout 会话标识、邀请码兑换记录和权益记录，用于确认报告或文书分析是否已解锁。我们不保存完整银行卡号。",
        ],
      },
      {
        title: "AI 与第三方服务",
        body: [
          "为生成报告或文书分析，我们可能将必要问卷内容、报告上下文、文书草稿或相关片段发送给 AI 模型服务商或兼容 API 提供方处理。",
          "我们也可能使用 Supabase、Vercel、Stripe、Google 登录等第三方服务。它们会根据各自隐私政策处理必要数据。",
        ],
      },
      {
        title: "数据删除",
        body: [
          "你可以联系我们请求查询、更正或删除账户相关数据。部分交易、审计或安全记录可能会在法律或合规需要范围内保留。",
        ],
      },
    ],
  },
  disclaimer: {
    title: "AI 免责声明",
    updated: "最后更新：2026 年 5 月",
    sections: [
      {
        title: "规划参考，而非最终结论",
        body: [
          "OnlyApply 报告和文书分析由 AI 根据你填写的问卷、报告上下文和你提交的文书草稿生成，仅用于申请规划与写作修改参考。",
          "如果你在后续轮次补充 ACT、语言成绩、活动、预算、申请身份或其他信息，系统可能会把这些补充说明带入后续重新分析；但这仍然是基于输入的模型判断，不是人工顾问的连续记忆。",
          "这些内容不构成录取预测、录取保证、学校官方建议、法律意见、财务建议、人工顾问定稿或最终升学顾问意见。",
        ],
      },
      {
        title: "请核对官方信息",
        body: [
          "学校名单、理由、风险、费用、截止日期、国际生政策、奖助学金和申请要求均需以学校官网及当年官方政策为准。",
          "AI 可能生成不完整、过时或错误的信息。重大申请决策应结合官方信息、家庭情况和专业人士建议。",
        ],
      },
      {
        title: "文书反馈需要人工判断",
        body: [
          "AI 可能指出问题、提供修改方向或示例改写，但它无法完整理解你的真实经历、价值判断、家庭背景和申请策略。",
          "请不要直接复制 AI 示例作为最终文书提交。你应自行核对事实、保持真实表达，并在重大申请材料上结合家长、老师或专业顾问意见。",
        ],
      },
    ],
  },
};

const enDocs: Record<LegalDoc, LegalCopy> = {
  terms: {
    title: "Terms of Use",
    updated: "Last updated: May 2026",
    sections: [
      {
        title: "Nature of the service",
        body: [
          "OnlyApply provides AI-generated application planning, report interpretation, and essay revision references. It is not an admission prediction, admission guarantee, legal advice, financial advice, official school information, or a final counselor opinion.",
          "Essay direction, paragraph analysis, rewrite examples, and revision suggestions are intended to help you think and revise. They are not human counselor final drafts and should not be treated as application materials ready for submission.",
          "School recommendations, risks, costs, deadlines, international-student policies, aid, and requirements must be verified with official school sources and current-year policies.",
        ],
      },
      {
        title: "User responsibility",
        body: [
          "You are responsible for submitting accurate and complete information. Incomplete or outdated inputs may make the report unsuitable for your situation.",
          "You may not use the service to fabricate application materials, impersonate official conclusions, resell reports, scrape content, or submit another person's sensitive information without authorization.",
        ],
      },
      {
        title: "Unlocks, invite codes, and payments",
        body: [
          "The free preview shows only part of the report. The full report may include complete school lists, school-by-school reasons, risk responses, action plans, and PDF download.",
          "Full-report unlocks are generally tied to a single saved application profile. If you add information, update activities, or regenerate reports within the same profile, the service will try to preserve that profile's unlock status. A separate application profile, student, or application target may require a separate unlock.",
          "Essay analysis may be offered as a separate feature that requires a separate payment, subscription, or designated invite code. Unlocking a report does not necessarily unlock essay analysis unless the page says so.",
          "Payments are processed by third-party payment providers such as Stripe. OnlyApply does not store full payment-card details. Unlock status is based on payment-provider callbacks and entitlement records in our system.",
          "Invite codes are for designated users or campaigns and may not be resold, abused, or publicly distributed. We may disable, revoke, or limit invite codes.",
        ],
      },
      {
        title: "Limitation of liability",
        body: [
          "To the extent permitted by law, OnlyApply is not liable for indirect, special, or consequential losses from using or being unable to use the service, including admission outcomes, missed deadlines, financial loss, lost opportunities, or third-party disputes.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "Last updated: May 2026",
    sections: [
      {
        title: "Information we collect",
        body: [
          "We may collect login information, questionnaire inputs, report content, supplementary notes, essay drafts, essay analysis results, analysis history, usage data, invite-code redemption records, and unlock status.",
          "Questionnaires may include grades, testing, budget, activities, structured activity or competition entries, major interests, region preferences, dealbreakers, and other application-planning information.",
          "When you answer information gaps, add activities, or update an application profile, those supplementary details may be saved with the same profile or report history and used in later report regeneration to reduce repeated questions and improve consistency.",
          "Essay drafts may include personal experiences, activity details, family or growth background, and other content you choose to enter. Do not submit another person's information without authorization or sensitive content you do not want processed by the service.",
        ],
      },
      {
        title: "How we use information",
        body: [
          "We use information to generate and save reports, save application profiles and structured activities, preserve supplementary notes for later report runs, save essay drafts and analysis history, provide login and unlock features, improve product experience, debug issues, prevent abuse, and contact you when you choose to leave contact details.",
          "We may store payment status, Stripe Checkout session identifiers, invite-code redemption records, and entitlement records to confirm whether reports or essay analyses are unlocked. We do not store full card numbers.",
        ],
      },
      {
        title: "AI and third-party services",
        body: [
          "To generate reports or essay analysis, we may send necessary questionnaire content, report context, essay drafts, or related excerpts to AI model providers or compatible API providers.",
          "We may also use Supabase, Vercel, Stripe, Google Sign-In, and other third-party services, which process necessary data under their own privacy policies.",
        ],
      },
      {
        title: "Data deletion",
        body: [
          "You may contact us to request access, correction, or deletion of account-related data. Some transaction, audit, or security records may be retained where legally or operationally required.",
        ],
      },
    ],
  },
  disclaimer: {
    title: "AI Disclaimer",
    updated: "Last updated: May 2026",
    sections: [
      {
        title: "Planning reference, not a final answer",
        body: [
          "OnlyApply reports and essay analyses are generated by AI from your questionnaire, report context, and essay drafts. They are intended only as application-planning and writing-revision references.",
          "If you later add ACT, language scores, activities, budget, applicant identity, or other details, the system may carry those supplementary notes into later report regeneration. This is still model-based analysis from inputs, not human counselor memory.",
          "They are not an admission prediction, admission guarantee, official school advice, legal advice, financial advice, human counselor final draft, or final counselor opinion.",
        ],
      },
      {
        title: "Verify official sources",
        body: [
          "School lists, reasons, risks, costs, deadlines, international-student policies, aid, and requirements must be verified with official school sources and current-year policies.",
          "AI output may be incomplete, outdated, or incorrect. Major application decisions should combine official information, family context, and professional judgment.",
        ],
      },
      {
        title: "Essay feedback requires human judgment",
        body: [
          "AI may identify issues, suggest revision directions, or provide rewrite examples, but it cannot fully understand your lived experience, values, family context, or application strategy.",
          "Do not copy AI examples directly as final essays. You are responsible for verifying facts, preserving your authentic voice, and using parent, teacher, or professional counselor judgment for major application materials.",
        ],
      },
    ],
  },
};

const docOrder: LegalDoc[] = ["terms", "privacy", "disclaimer"];

export function LegalLinks({ className = "" }: { className?: string }) {
  const { locale } = useLanguage();
  const [openDoc, setOpenDoc] = useState<LegalDoc | null>(null);
  const docs = locale === "en" ? enDocs : zhDocs;
  const copy = openDoc ? docs[openDoc] : null;

  useEffect(() => {
    if (!openDoc) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDoc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [openDoc]);

  const legalPage = copy
    ? createPortal(
        <div className="legal-page" role="dialog" aria-modal="true" aria-labelledby="legal-page-title">
          <div className="legal-page__scrim" onClick={() => setOpenDoc(null)} />
          <div className="legal-page__panel">
            <header className="legal-page__bar">
              <span className="legal-page__chrome-title" aria-hidden>
                OnlyApply Legal
              </span>
              <button type="button" className="legal-page__back" onClick={() => setOpenDoc(null)}>
                {locale === "en" ? "Close" : "关闭"} <kbd className="legal-page__kbd">Esc</kbd>
              </button>
            </header>

            <main className="legal-page__main">
              <BrandLogo />
              <p className="legal-page__eyebrow">OnlyApply Legal</p>
              <h1 id="legal-page-title">{copy.title}</h1>
              <p className="legal-page__updated">{copy.updated}</p>

              <div className="legal-page__body">
                {copy.sections.map((section) => (
                  <section key={section.title} className="legal-page__section">
                    <h2>{section.title}</h2>
                    {section.body.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </section>
                ))}
              </div>

              <nav className="legal-page__switcher" aria-label={locale === "en" ? "Switch legal document" : "切换法律文档"}>
                {docOrder.map((doc) => (
                  <button
                    key={doc}
                    type="button"
                    className={`legal-page__switch${openDoc === doc ? " legal-page__switch--active" : ""}`}
                    onClick={() => setOpenDoc(doc)}
                  >
                    {docs[doc].title}
                  </button>
                ))}
              </nav>
              <p className="legal-page__support">
                {locale === "en" ? "Questions, data requests, or report issues? Email " : "如需帮助、删除数据或反馈异常，请联系 "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </p>
            </main>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <nav className={`legal-links ${className}`} aria-label={locale === "en" ? "Legal links" : "法律与隐私链接"}>
        {docOrder.map((doc, index) => (
          <span key={doc} className="legal-links__item">
            {index > 0 && <span className="legal-links__sep">·</span>}
            <button type="button" className="legal-links__btn" onClick={() => setOpenDoc(doc)}>
              {docs[doc].title}
            </button>
          </span>
        ))}
        <span className="legal-links__item">
          <span className="legal-links__sep">·</span>
          <a className="legal-links__btn" href={`mailto:${SUPPORT_EMAIL}`}>
            {locale === "en" ? "Support" : "联系我们"}
          </a>
        </span>
      </nav>

      {legalPage}
    </>
  );
}

export function LegalConsentLine() {
  const { locale } = useLanguage();
  return (
    <p className="legal-consent-line">
      {locale === "en"
        ? "By continuing, you agree to the Terms and acknowledge this is AI-generated planning guidance."
        : "继续使用即表示你同意使用条款，并知悉本报告为 AI 生成的规划参考。"}
    </p>
  );
}
