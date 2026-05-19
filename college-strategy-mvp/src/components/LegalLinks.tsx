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
          "我们可能收集登录信息（邮箱或 Google 登录标识）、问卷信息、报告内容、补充说明、文书草稿、文书分析结果、分析历史、邀请码兑换记录和解锁状态。",
          "问卷可能包含成绩、标化、预算、活动、结构化活动/竞赛、专业偏好、地区偏好、申请底线和其他申请规划相关信息。",
          "当你回答信息缺口、补充活动或更新申请档案时，这些补充信息可能会被保存到同一份申请档案或报告历史中，用于后续重新生成报告。",
          "文书草稿可能包含你主动输入的个人经历、活动细节、家庭或成长背景等内容。请不要提交你无权提供的他人信息，或不希望系统处理的敏感内容。",
          "仅当你主动申请专家 1v1 帮助并提交表单时，我们才会收集你自愿留下的邮箱、微信（可选）及来源页面信息。",
        ],
      },
      {
        title: "信息存储位置与保留期限",
        body: [
          "登录并保存后：问卷、报告、补充说明、文书草稿与分析记录保存在 Supabase 数据库（与您的账户绑定）。",
          "未登录时：生成报告会经我们的服务器实时处理；默认不写入您的云端账户。浏览器可能暂存待保存草稿（约 7 天），清除站点数据即删除。",
          "付款：我们只保存支付状态、Stripe Checkout 会话标识与权益记录，不保存完整银行卡号。",
          "在您的账户与相关记录存在期间，我们会继续保存以便提供服务；目前没有自动到期删除所有个人数据的机制。您可通过下文「您的权利」请求删除。",
        ],
      },
      {
        title: "我们如何使用信息",
        body: [
          "用于生成、展示与保存选校报告；在您补充信息后重新生成；提供文书分析与历史回看；管理登录、邀请码与 Stripe 解锁；在您主动申请专家 1v1 时由 OnlyApply 官方跟进。",
          "用于改进产品、排查故障与防止滥用。",
          "我们不会出售、出租或以换取对价的方式向数据经纪人提供您的申请档案；不会向其他用户公开展示您的个人申请内容；当前产品未集成第三方广告或行为画像 SDK。",
        ],
      },
      {
        title: "AI 服务（火山引擎方舟）",
        body: [
          "为生成报告与文书分析，我们的服务器会将提供服务所必需的信息发送至火山引擎方舟（Volcengine Ark）API，包括问卷中的成绩、标化、预算、活动、专业与地区偏好、申请身份与地区上下文；已有报告的结构化内容（文书分析时）；以及您提交的文书草稿片段（受系统长度限制）。",
          "OnlyApply 不会使用您的申请数据训练我们自有的 AI 模型。通过方舟 API 传输的数据，同时受火山引擎相关服务条款与数据处理说明约束。",
          "我们不为报告生成之目的，将您的完整申请档案提供给方舟以外的其他 AI 服务商（除非未来产品变更并更新本政策）。",
        ],
      },
      {
        title: "其他基础设施第三方",
        body: [
          "Supabase：账户登录与数据库。Vercel：网站与 API 托管。Stripe：支付处理。Google：可选登录方式。",
          "上述服务仅在运行 OnlyApply 所必需范围内处理数据，各自适用其隐私政策。",
        ],
      },
      {
        title: "专家 1v1 与留资",
        body: [
          "默认情况下，您的申请问卷、报告、文书及登录信息不会提供给任何留资团队、外部升学顾问、合作机构或第三方销售/客服团队。",
          "仅当您主动点击「获取 1v1 专家建议」等入口并提交联系方式时，我们才会保存您自愿提供的邮箱、微信（可选），以便 OnlyApply 官方工作人员与您联系。",
          "在该流程中，我们不会因您留资而将完整申请档案（含成绩、活动列表、报告全文等）提供给外部顾问团队或合作方。",
          "您没有义务使用专家咨询功能；不使用该功能不影响报告生成与其他产品功能。",
        ],
      },
      {
        title: "未登录使用",
        body: [
          "您可以在不登录的情况下填写问卷并生成报告预览。此时问卷与报告结果会经我们的 API 实时转发给火山方舟处理；默认不会写入您的云端账户。",
          "若需长期保存、解锁完整版、文书分析或跨设备访问，请登录并将报告保存到账户。",
        ],
      },
      {
        title: "谁能访问您的数据",
        body: [
          "您本人：通过登录访问已保存的申请、报告与文书记录（数据库行级安全策略限制为本人）。",
          "OnlyApply 授权人员：在运维、客服、您主动发起的专家 1v1 跟进、安全与合规所必需范围内可能访问。",
          "我们不会向其他申请用户或外部留资/顾问团队批量提供您的完整申请档案。",
        ],
      },
      {
        title: "您的权利",
        body: [
          `您可联系 ${SUPPORT_EMAIL} 请求查询、更正或删除与您账户相关的数据（在技术可行且法律允许的范围内）。`,
          "删除后，部分支付记录、邀请码核销、安全日志或合规备份可能仍需保留一段时间。",
        ],
      },
      {
        title: "安全提示",
        body: [
          "我们采用 HTTPS、数据库访问控制与服务端密钥管理等措施保护数据。没有任何在线服务能保证绝对安全。",
          "请勿在文书中提交不必要的身份证号、他人敏感信息或您不愿被系统处理的内容。",
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
          "We may collect login information (email or Google sign-in identifier), questionnaire inputs, report content, supplementary notes, essay drafts, essay analysis results, analysis history, invite-code redemption records, and unlock status.",
          "Questionnaires may include grades, testing, budget, activities, structured activity or competition entries, major interests, region preferences, dealbreakers, and other application-planning information.",
          "When you answer information gaps, add activities, or update an application profile, those details may be saved with the same profile or report history for later regeneration.",
          "Essay drafts may include personal experiences, activity details, family or growth background, and other content you choose to enter. Do not submit another person's information without authorization or sensitive content you do not want processed.",
          "We collect email and optional WeChat only when you opt in to expert 1:1 support and submit the contact form.",
        ],
      },
      {
        title: "Where data is stored and how long",
        body: [
          "After sign-in and save: questionnaires, reports, notes, essay drafts, and analysis history are stored in Supabase, tied to your account.",
          "Without sign-in: report generation is processed in real time through our server; by default nothing is written to your cloud account. Your browser may keep a pending draft for up to ~7 days until you clear site data.",
          "Payments: we store unlock status, Stripe Checkout session identifiers, and entitlement records—not full card numbers.",
          "We retain data while your account and related records exist to provide the service. There is no automatic expiry deletion today. You may request deletion as described below.",
        ],
      },
      {
        title: "How we use information",
        body: [
          "To generate, display, and save reports; regenerate after you add facts; run essay analysis; manage login, invite codes, and Stripe unlocks; and follow up when you opt in to expert 1:1 support from OnlyApply staff.",
          "To improve the product, debug issues, and prevent abuse.",
          "We do not sell or rent your application profile to data brokers; we do not show your profile to other users; and we do not use third-party ad or behavioral-profiling SDKs in the product today.",
        ],
      },
      {
        title: "AI (Volcengine Ark)",
        body: [
          "To generate reports and essay feedback, we send only what is necessary to Volcengine Ark APIs—including questionnaire fields (grades, testing, budget, activities, majors, preferences, identity/region context), structured report JSON when analyzing essays, and essay excerpts (subject to length limits).",
          "OnlyApply does not train its own models on your application data. Data sent via Ark is also subject to Volcengine's applicable terms and data-processing statements.",
          "We do not use additional AI vendors for report generation unless we change the product and update this policy.",
        ],
      },
      {
        title: "Other infrastructure providers",
        body: [
          "Supabase (auth and database), Vercel (hosting), Stripe (payments), and optional Google sign-in process data only as needed to run the service, each under its own privacy policy.",
        ],
      },
      {
        title: "Expert 1:1 and contact requests",
        body: [
          "By default, we do not provide your questionnaire, reports, essays, or account details to consult/lead teams, external counselors, partners, or third-party sales teams.",
          "Only if you opt in to expert 1:1 support and submit email and/or WeChat do we store those voluntary contact details so OnlyApply staff can reach you.",
          "Opting in does not mean we share your full application profile with external advisors or partners.",
          "Expert consult is optional and does not affect report generation or other features.",
        ],
      },
      {
        title: "Use without signing in",
        body: [
          "You may complete the questionnaire and generate a preview without signing in. Data passes through our API to Volcengine Ark in real time and is not saved to your cloud account by default.",
          "To save long-term, unlock the full report, use essay analysis, or access across devices, sign in and save the report to your account.",
        ],
      },
      {
        title: "Who can access your data",
        body: [
          "You: via sign-in to your saved applications, reports, and essays (database row-level security limits access to your account).",
          "Authorized OnlyApply staff: for operations, support, expert 1:1 follow-up you requested, security, and compliance when necessary.",
          "We do not bulk-share application profiles with external consult or lead teams.",
        ],
      },
      {
        title: "Your rights",
        body: [
          `You may email ${SUPPORT_EMAIL} to request access, correction, or deletion of account-related data where feasible and permitted by law.`,
          "Some payment, invite-redemption, security, or compliance records may be retained for a period after deletion.",
        ],
      },
      {
        title: "Security",
        body: [
          "We use HTTPS, database access controls, and server-side secret management. No online service can guarantee absolute security.",
          "Do not submit unnecessary government IDs, another person's sensitive information, or content you do not want processed.",
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

type LegalLinksProps = {
  className?: string;
  openDoc?: LegalDoc | null;
  onOpenDocChange?: (doc: LegalDoc | null) => void;
};

export function LegalLinks({ className = "", openDoc: openDocProp, onOpenDocChange }: LegalLinksProps) {
  const { locale } = useLanguage();
  const [internalOpenDoc, setInternalOpenDoc] = useState<LegalDoc | null>(null);
  const isControlled = openDocProp !== undefined;
  const openDoc = isControlled ? openDocProp : internalOpenDoc;
  const setOpenDoc = (doc: LegalDoc | null) => {
    if (!isControlled) setInternalOpenDoc(doc);
    onOpenDocChange?.(doc);
  };
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
