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
          "OnlyApply 提供 AI 生成的申请规划参考，不构成录取预测、录取保证、法律意见、财务建议、学校官方信息或最终升学顾问意见。",
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
          "我们可能收集登录信息、问卷信息、报告内容、补充说明、使用数据、邀请码兑换记录和解锁状态。",
          "问卷可能包含成绩、标化、预算、活动、专业偏好、地区偏好等申请规划相关信息。",
        ],
      },
      {
        title: "我们如何使用信息",
        body: [
          "这些信息用于生成和保存报告、提供登录与解锁功能、改善产品体验、排查错误、防止滥用，以及在你主动留下联系方式时与你沟通。",
        ],
      },
      {
        title: "AI 与第三方服务",
        body: [
          "为生成报告，我们可能将必要问卷内容发送给 AI 模型服务商或兼容 API 提供方处理。",
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
          "OnlyApply 报告由 AI 根据你填写的问卷生成，仅用于申请规划参考。",
          "本报告不构成录取预测、录取保证、学校官方建议、法律意见、财务建议或最终升学顾问意见。",
        ],
      },
      {
        title: "请核对官方信息",
        body: [
          "学校名单、理由、风险、费用、截止日期、国际生政策、奖助学金和申请要求均需以学校官网及当年官方政策为准。",
          "AI 可能生成不完整、过时或错误的信息。重大申请决策应结合官方信息、家庭情况和专业人士建议。",
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
          "OnlyApply provides AI-generated application planning references. It is not an admission prediction, admission guarantee, legal advice, financial advice, official school information, or a final counselor opinion.",
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
          "We may collect login information, questionnaire inputs, report content, supplementary notes, usage data, invite-code redemption records, and unlock status.",
          "Questionnaires may include grades, testing, budget, activities, major interests, region preferences, and other application-planning information.",
        ],
      },
      {
        title: "How we use information",
        body: [
          "We use information to generate and save reports, provide login and unlock features, improve product experience, debug issues, prevent abuse, and contact you when you choose to leave contact details.",
        ],
      },
      {
        title: "AI and third-party services",
        body: [
          "To generate reports, we may send necessary questionnaire content to AI model providers or compatible API providers.",
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
          "OnlyApply reports are generated by AI from your questionnaire and are intended only as application-planning references.",
          "The report is not an admission prediction, admission guarantee, official school advice, legal advice, financial advice, or final counselor opinion.",
        ],
      },
      {
        title: "Verify official sources",
        body: [
          "School lists, reasons, risks, costs, deadlines, international-student policies, aid, and requirements must be verified with official school sources and current-year policies.",
          "AI output may be incomplete, outdated, or incorrect. Major application decisions should combine official information, family context, and professional judgment.",
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
