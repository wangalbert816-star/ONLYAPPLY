import type { FormState, PaywallCopy, PaywallTone, ReportDiff, ReportPayload, SchoolRow, SchoolTier, SupplementaryNote } from "./types";
import "./ReportView.css";
import "./ReportViewTheme.css";
import { useMemo, useRef } from "react";
import { useLanguage } from "./i18n/LanguageContext";
import { InformationGapsInteractive } from "./components/InformationGapsInteractive";
import { ExpertConsultSection } from "./components/ExpertConsultSection";
import { ApplicationProfileRadar } from "./components/ApplicationProfileRadar";
import { buildFiveDimensionProfile } from "./lib/fiveDimensionProfile";
import { buildBiggestGapBlock, buildOverallVerdict } from "./lib/decisionReport";
import { DecisionVerdictCard } from "./components/DecisionVerdictCard";
import { ReportBiggestGapBanner } from "./components/ReportBiggestGapBanner";
import { ReportPathStep } from "./components/ReportPathStep";
import { SaveReportBanner } from "./components/auth/SaveReportBanner";
import { ReportDownloadButton } from "./components/ReportDownloadButton";
import { ReportExportCsvButton } from "./components/ReportExportCsvButton";
import { ReportSectionNav } from "./components/ReportSectionNav";
import { SchoolTierPanel } from "./components/SchoolTierPanel";
import { ReportImprovementPanel } from "./components/ReportImprovementPanel";
import { sanitizeReportProse } from "./lib/reportProseSanitize";
import { REPORT_CONTENT_LOCALE } from "./lib/reportContentLocale";
import "./components/ReportImprovementPanel.css";
import { ReportPdfDocument } from "./components/pdf/ReportPdfDocument";
import { LegalLinks } from "./components/LegalLinks";
import { getEffectiveIntake } from "./lib/intakeTerm";
import { getImprovementPlanLabels, getIntakeHorizon } from "./lib/intakeHorizon";
import { resolveMainListRows } from "./lib/topReferenceSchools";

export type { PaywallCopy, PaywallTone } from "./types";

/** 演示用：接入 Stripe/微信等后改为支付成功回调 */
const UNLOCK_STORAGE_KEY = "college_strategy_report_unlock_v1";

export function readUnlockFromStorage(): boolean {
  try {
    return localStorage.getItem(UNLOCK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeUnlockToStorage() {
  try {
    localStorage.setItem(UNLOCK_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearUnlockStorage() {
  try {
    localStorage.removeItem(UNLOCK_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** 从 URL 切换话术：?paywall=rational | anxiety | curiosity（默认 rational） */
export function getPaywallTone(): PaywallTone {
  try {
    const v = new URLSearchParams(window.location.search).get("paywall");
    if (v === "anxiety" || v === "curiosity") return v;
  } catch {
    /* ignore */
  }
  return "rational";
}

export const PAYWALL_PACKS: Record<PaywallTone, PaywallCopy> = {
  rational: {
    eyebrow: "可核对 · 可执行 · 一次带走",
    title: "当前结果是保守判断——完整版更接近真实情况",
    body: `你看到的总览与信息缺口，是为了让你确认：系统正在基于已知信息理解你。真正有价值的是完整版里9 校全称 + 每校官网核对项 + 本月/提交前行动表——它会把判断依据摊开，方便你继续补充信息、核对风险。

预览每档只留 1 所样本，不是抠门，是先给你看判断逻辑；信息越完整，后续评估越接近你的真实情况。`,
    bullets: [
      "9 校全名与入档理由一次展开，方便核对系统判断",
      "逐校官网必核条目：轮次、国际生政策、费用口径",
      "风险后半段 + 行动表后半段：帮助你继续补全关键信息",
    ],
    ctaPrimary: "解锁基于完整信息的判断（9 校 + 核对 + 行动表）",
    ctaHint: "演示：点击即开。正式版跳转支付后即时解锁。",
    previewLine: "预览：这是基于当前信息的保守判断；完整版会展开更多依据。",
    hookLead:
      "以下校名指纹来自本次真实生成结果（非随机占位）。解锁不是为了多看字，而是看清系统为什么这样判断。",
    footerTitle: "还在用表格自己拼？",
    footerText:
      "完整版的价值是把判断依据展开：同一套信息，用结构帮你发现还需要补什么、核对什么。演示环境可一键解锁看全貌。",
  },
  anxiety: {
    eyebrow: "名单错了，代价不是这几十块",
    title: "最怕的不是多申一所，而是判断依据没看完整",
    body: `预览里你已经看到方向；没展开的是：每一档里第二、第三所往往才是家长问得最细、也最依赖完整信息的那一格——保底是否真能保住、冲刺是否把你的预算/身份算进去。

信息不完整时，系统会偏保守；完整版把 9 校与风险依据一次摊开，让你至少知道当前判断为什么成立、哪里还需要核对。`,
    bullets: [
      "看清每一档隐藏校：是不是你以为的那所保底",
      "风险后半段：专门对付国际生 + 奖助学金 + 方差",
      "提交前清单：减少漏材料 / 看错轮次这种低级全拒",
    ],
    ctaPrimary: "解锁完整版 · 看清完整风险判断",
    ctaHint: "演示：点击即开。正式版支付后立即展示全部敏感行。",
    previewLine: "预览是保守判断；要看完整风险依据，需要完整版。",
    hookLead:
      "下面三行是本次报告里尚未展示真名的学校指纹。它们不是吓唬你，是提醒你：系统已经给出判断，你只是还没看见完整依据。",
    footerTitle: "你可以关掉页面——但名单里的洞不会自己消失",
    footerText:
      "若你此刻正在焦虑 list，完整版至少让你带着判断依据去核对官网，而不是带着空白去猜。演示可一键解锁。",
  },
  curiosity: {
    eyebrow: "真名已经写进报告了——只是还没亮给你",
    title: "来认认：这三所第二顺位到底是谁？",
    body: `每一档的第二所学校，系统已经完成初步判定；预览故意只露指纹。

如果你读完预览觉得有点准，好奇心会逼你想知道剩下是谁——这就是完整版要给你的：不是悬念本身，而是悬念背后的全名、理由与核对路径。`,
    bullets: [
      "揭开冲刺/匹配/保底各自的第二所全名",
      "对照每所：为什么它在那一档、主要雷区是什么",
      "把猜变成查：官网核对项一条条摆出来",
    ],
    ctaPrimary: "解锁完整判断 · 9 校全名与依据",
    ctaHint: "演示：点击即开。正式版支付后秒开。",
    previewLine: "当前判断已生成——完整依据在完整版；先看指纹，再决定要不要展开。",
    hookLead:
      "规则很简单：只看首字母与长度，全名锁定在完整版。若和你心里猜的一样，说明你该解锁往下看了。",
    footerTitle: "都猜到边缘了，不如一次看完",
    footerText: "完整版把三档第二所连锅端出，不用来回刷新预览。演示一键解锁。",
  },
};

/** @deprecated 使用 PAYWALL_PACKS[getPaywallTone()] */
export const PAYWALL_GUIDE = PAYWALL_PACKS.rational;

interface ReportViewProps {
  report: ReportPayload;
  form: FormState;
  applicationId?: string | null;
  reportId?: string | null;
  unlocked: boolean;
  onUnlock: () => void;
  onReset: () => void;
  reportRefreshing?: boolean;
  refreshError?: string | null;
  onClearRefreshError?: () => void;
  subtleRefreshNotice?: string | null;
  onClearSubtleRefreshNotice?: () => void;
  reportDiff?: ReportDiff | null;
  onDismissReportDiff?: () => void;
  highlightSchoolKeys?: Set<string>;
  onRefreshReportWithGaps?: (notes: SupplementaryNote[]) => Promise<void>;
  onCommitProfileFiveNotes?: (notes: SupplementaryNote[]) => Promise<void>;
  authConfigured?: boolean;
  isAuthenticated?: boolean;
  showSaveBanner?: boolean;
  sessionSaved?: boolean;
  onRequestSignIn?: () => void;
  onOpenAccount?: () => void;
  onDismissSaveBanner?: () => void;
  /** 用于 PDF 封面（如登录邮箱） */
  pdfRecipientName?: string | null;
  purchaseBusy?: boolean;
  purchaseNotice?: string | null;
  stripeCheckoutEnabled?: boolean;
  inviteCodesEnabled?: boolean;
  inviteRedeemBusy?: boolean;
  onRedeemInviteCode?: (code: string) => void | Promise<void>;
}

export function ReportView({
  report,
  form,
  applicationId = null,
  reportId = null,
  unlocked,
  onUnlock,
  onReset,
  reportRefreshing = false,
  refreshError,
  onClearRefreshError,
  subtleRefreshNotice,
  onClearSubtleRefreshNotice,
  reportDiff,
  onDismissReportDiff,
  highlightSchoolKeys = new Set(),
  onRefreshReportWithGaps,
  onCommitProfileFiveNotes,
  authConfigured = false,
  isAuthenticated = false,
  showSaveBanner = false,
  sessionSaved = false,
  onRequestSignIn,
  onOpenAccount: _onOpenAccount,
  onDismissSaveBanner,
  pdfRecipientName = null,
  purchaseBusy = false,
  purchaseNotice = null,
  stripeCheckoutEnabled: _stripeCheckoutEnabled = false,
  inviteCodesEnabled: _inviteCodesEnabled = false,
  inviteRedeemBusy: _inviteRedeemBusy = false,
  onRedeemInviteCode: _onRedeemInviteCode,
}: ReportViewProps) {
  const { t } = useLanguage();
  const reportLocale = REPORT_CONTENT_LOCALE;
  const safeReport = useMemo(() => sanitizeReportProse(report, reportLocale), [report, reportLocale]);
  const pdfSourceRef = useRef<HTMLDivElement>(null);
  const intakeLabel = useMemo(() => getEffectiveIntake(form) || t("report.title"), [form, t]);
  const planHorizon = useMemo(() => getIntakeHorizon(getEffectiveIntake(form)), [form]);
  const planLabels = useMemo(
    () => getImprovementPlanLabels(planHorizon, reportLocale),
    [planHorizon, reportLocale],
  );
  const improveLead = useMemo(() => {
    if (planHorizon === "urgent") return t("report.improveLeadUrgent");
    if (planHorizon === "mid") return t("report.improveLeadMid");
    if (planHorizon === "long") return t("report.improveLeadLong");
    if (planHorizon === "unknown") return t("report.improveLeadUnknown");
    return null;
  }, [planHorizon, t]);
  const profileFive = useMemo(() => buildFiveDimensionProfile(form, reportLocale), [form, reportLocale]);
  const verdict = useMemo(
    () =>
      buildOverallVerdict(form, profileFive, reportLocale, {
        executiveLead: safeReport.executive_summary?.[0] ?? null,
      }),
    [form, profileFive, reportLocale, safeReport.executive_summary],
  );
  const biggestGap = useMemo(() => buildBiggestGapBlock(profileFive, reportLocale), [profileFive, reportLocale]);

  const tw = safeReport.improvement_plan?.this_week || [];
  const tierLabel = (tier: SchoolTier) =>
    tier === "reach" ? t("report.tierReach") : tier === "match" ? t("report.tierMatch") : t("report.tierSafety");

  const lockedSchoolRows = unlocked ? 999 : 1;
  const mainListRows = useMemo(() => resolveMainListRows(safeReport), [safeReport]);
  const lockedWeekItems = unlocked ? tw.length : Math.min(1, tw.length);

  const sectionNavItems = useMemo(
    () => [
      { id: "report-step-verdict", label: t("report.nav.overallCall") },
      { id: "report-step-schools", label: t("report.nav.schoolList") },
      { id: "report-step-profile", label: t("report.nav.fiveDimension") },
      { id: "report-step-action", label: t("report.nav.fillGaps") },
      { id: "report-advisor-support", label: t("report.nav.advisorSupport") },
      { id: "report-appendix-study", label: t("report.nav.infoStudy") },
    ],
    [t],
  );

  return (
    <div className={`app report-view${reportRefreshing ? " report-view--busy" : ""}`}>
      {reportRefreshing && (
        <div className="report-refresh-overlay" aria-live="polite" aria-busy="true">
          <div className="report-refresh-card">
            <div className="report-refresh-spinner" aria-hidden />
            <p className="report-refresh-text">{t("report.refresh.optimizing")}</p>
          </div>
        </div>
      )}

      {refreshError && (
        <div className="report-inline-alert" role="alert">
          <span>{refreshError}</span>
          <button type="button" className="btn btn-secondary report-inline-btn" onClick={() => onClearRefreshError?.()}>
            {t("report.refresh.dismissError")}
          </button>
        </div>
      )}

      {subtleRefreshNotice && !refreshError && (
        <div className="report-inline-notice" role="status">
          <span>{subtleRefreshNotice}</span>
          <button type="button" className="report-inline-btn-ghost" onClick={() => onClearSubtleRefreshNotice?.()}>
            {t("report.refresh.dismissError")}
          </button>
        </div>
      )}

      {reportDiff && !reportRefreshing && (
        <section className="card report-diff-banner" aria-labelledby="report-diff-title">
          <div className="report-diff-banner__head">
            <h2 id="report-diff-title" className="report-diff-banner__title">
              {t("report.diff.title")}
            </h2>
            <button type="button" className="btn btn-secondary report-diff-dismiss" onClick={() => onDismissReportDiff?.()}>
              {t("report.diff.dismiss")}
            </button>
          </div>
          <p className="report-diff-banner__lead">{t("report.diff.lead")}</p>
          {(reportDiff.tierMoves.length > 0 ||
            reportDiff.addedSchools.length > 0 ||
            reportDiff.removedSchools.length > 0) && (
            <>
              <p className="report-diff-section-label">{t("report.diff.sectionSchools")}</p>
              <ul className="report-diff-list">
                {reportDiff.tierMoves.map((m) => (
                  <li key={`mv-${m.schoolKey}`}>
                    {t("report.diff.move", { school: m.school, from: tierLabel(m.fromTier), to: tierLabel(m.toTier) })}
                  </li>
                ))}
                {reportDiff.addedSchools.map((a) => (
                  <li key={`ad-${a.schoolKey}`}>
                    {t("report.diff.added", { school: a.school, tier: tierLabel(a.tier) })}
                  </li>
                ))}
                {reportDiff.removedSchools.map((r) => (
                  <li key={`rm-${r.schoolKey}`}>
                    {t("report.diff.removed", { school: r.school, tier: tierLabel(r.tier) })}
                  </li>
                ))}
              </ul>
            </>
          )}
          {(reportDiff.gapsBeforeCount !== reportDiff.gapsAfterCount ||
            reportDiff.gapsAddedSamples.length > 0 ||
            reportDiff.gapsRemovedSamples.length > 0) && (
            <>
              <p className="report-diff-section-label">{t("report.diff.sectionGaps")}</p>
              <p className="report-diff-gaps-summary">
                {t("report.diff.gapsSummary", { before: reportDiff.gapsBeforeCount, after: reportDiff.gapsAfterCount })}
              </p>
              <ul className="report-diff-list report-diff-list--compact">
                {reportDiff.gapsRemovedSamples.map((line, i) => (
                  <li key={`gr-${i}`}>{t("report.diff.gapRemovedLine", { line: line.slice(0, 120) })}</li>
                ))}
                {reportDiff.gapsAddedSamples.map((line, i) => (
                  <li key={`ga-${i}`}>{t("report.diff.gapAddedLine", { line: line.slice(0, 120) })}</li>
                ))}
              </ul>
            </>
          )}
          {reportDiff.executiveSummaryChanged && (
            <p className="report-diff-exec">{t("report.diff.execChanged")}</p>
          )}
          {reportDiff.dimensionChanges.length > 0 && (
            <>
              <p className="report-diff-section-label">{t("report.diff.sectionDimensions")}</p>
              <ul className="report-diff-dimensions">
                {reportDiff.dimensionChanges.map((d) => (
                  <li key={d.key}>
                    {t("report.diff.dimensionLine", { label: d.label, before: d.before, after: d.after })}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {authConfigured && (showSaveBanner || (isAuthenticated && sessionSaved)) && onRequestSignIn && (
        <SaveReportBanner
          saved={isAuthenticated && sessionSaved}
          onSignIn={onRequestSignIn}
          onDismiss={showSaveBanner ? onDismissSaveBanner : undefined}
        />
      )}

      <div className="report-shell">
        <ReportSectionNav items={sectionNavItems} t={t} onRefresh={onReset} />

        <div className="report-main">
          <div className="report-main__toolbar" role="toolbar" aria-label={t("report.title")}>
            <ReportExportCsvButton report={safeReport} form={form} unlocked={unlocked} />
            {isAuthenticated && sessionSaved && unlocked && (
              <ReportDownloadButton sourceRef={pdfSourceRef} intakeLabel={intakeLabel} unlocked={unlocked} />
            )}
            {authConfigured && onRequestSignIn && !isAuthenticated && (
              <button type="button" className="btn btn-secondary report-main__toolbar-btn" onClick={onRequestSignIn}>
                {t("report.saveApplications")}
              </button>
            )}
            <button type="button" className="btn btn-primary report-main__toolbar-btn" onClick={onReset}>
              {t("report.startOver")}
            </button>
          </div>

          <header className="report-main__hero">
            <h1 className="report-main__title">
              {t("report.title")}{" "}
              <span className="badge-premium">{t("report.badgePremium")}</span>
            </h1>
            <p className="report-main__subtitle">{t("report.titleSubtitle", { intake: intakeLabel })}</p>
          </header>

          <div className="report-banner report-banner--info" role="note">
            <span className="report-banner__icon" aria-hidden>
              ✓
            </span>
            <p>{t("report.bannerInfo")}</p>
          </div>

          {!unlocked && (
            <div className="report-banner report-banner--unlock" data-no-pdf>
              <div className="report-banner--unlock__copy">
                <span className="report-banner__lock" aria-hidden>
                  🔒
                </span>
                <p>{t("report.unlockBannerTitle")}</p>
              </div>
              <button type="button" className="btn report-banner--unlock__cta" onClick={onUnlock} disabled={purchaseBusy}>
                {purchaseBusy ? t("report.checkoutOpening") : t("report.unlockBannerCta")}
              </button>
              {purchaseNotice ? <p className="report-banner--unlock__notice">{purchaseNotice}</p> : null}
            </div>
          )}

          <div className="report-path" aria-label={t("report.decision.pathAria")}>
            <ReportPathStep step={1} id="report-step-verdict" title={t("report.decision.step1Title")} lead={t("report.decision.step1Lead")}>
              <DecisionVerdictCard verdict={verdict} dimensions={profileFive} t={t} />
              <ExpertConsultSection
                variant="compact"
                gapCount={safeReport.information_gaps?.length ?? 0}
                applicationId={applicationId}
                reportId={reportId}
              />
            </ReportPathStep>

            <ReportPathStep step={2} id="report-step-gap" title={t("report.decision.step2Title")} lead={t("report.decision.step2Lead")}>
              <ReportBiggestGapBanner block={biggestGap} t={t} embedded />
            </ReportPathStep>

            <ReportPathStep step={3} id="report-step-profile" title={t("report.decision.step3Title")} lead={t("report.decision.step3Lead")}>
              <ApplicationProfileRadar
                items={profileFive}
                t={t}
                onCommitProfileFiveNotes={unlocked ? onCommitProfileFiveNotes : undefined}
                isCommitting={reportRefreshing}
                previewLocked={!unlocked}
                mockupLayout
              />
            </ReportPathStep>

            <ReportPathStep step={4} id="report-step-schools" title={t("report.decision.step4Title")} lead={t("report.decision.step4Lead")}>
              {(["reach", "match", "safety"] as const).map((tier) => (
                <SchoolTierPanel
                  key={tier}
                  tier={tier}
                  rows={(mainListRows[tier] as SchoolRow[]) ?? []}
                  unlocked={unlocked}
                  highlightSchoolKeys={highlightSchoolKeys}
                  lockedSchoolRows={lockedSchoolRows}
                  tierTitle={tierLabel(tier)}
                  defaultOpen={false}
                  form={form}
                  t={t}
                />
              ))}
            </ReportPathStep>

            <ReportPathStep step={5} id="report-step-action" title={t("report.decision.step5Title")} lead={t("report.decision.step5Lead")}>
              {unlocked && onRefreshReportWithGaps ? (
                <InformationGapsInteractive
                  gaps={safeReport.information_gaps ?? []}
                  onRegenerate={onRefreshReportWithGaps}
                  isRegenerating={reportRefreshing}
                  embedded
                />
              ) : null}
              <ReportImprovementPanel
                report={safeReport}
                form={form}
                locale={reportLocale}
                unlocked={unlocked}
                planLabels={planLabels}
                improveLead={improveLead}
                lockedWeekItems={lockedWeekItems}
                t={t}
                embedded
              />
            </ReportPathStep>

            <ReportPathStep step={6} id="report-advisor-support" title={t("report.expertConsult.navLabel")} lead={t("report.expertConsult.guide")}>
              <ExpertConsultSection
                id="report-advisor-support-panel"
                gapCount={safeReport.information_gaps?.length ?? 0}
                applicationId={applicationId}
                reportId={reportId}
              />
            </ReportPathStep>

            <ReportPathStep step={7} id="report-appendix-study" title={t("report.studyTitle")} lead={t("report.studyLead")}>
              <div className="report-study-grid">
                <article className="report-study-card">
                  <div className="report-study-card__tags">
                    <span className="report-study-tag">{t("report.study.tagAnalysis")}</span>
                    <span className="report-study-tag report-study-tag--muted">{t("report.study.tagReadMore")}</span>
                  </div>
                  <h3 className="report-study-card__title">{t("report.study.portfolioTitle")}</h3>
                  <p className="report-study-card__body">{t("report.study.portfolioBody")}</p>
                </article>
                <article className="report-study-card">
                  <div className="report-study-card__tags">
                    <span className="report-study-tag">{t("report.study.tagChecklist")}</span>
                  </div>
                  <h3 className="report-study-card__title">{t("report.study.interviewTitle")}</h3>
                  <p className="report-study-card__body">{t("report.study.interviewBody")}</p>
                </article>
              </div>
            </ReportPathStep>
          </div>

          <div className="report-content-footer">
            <p className="disclaimer">{t("report.disclaimer")}</p>
            <LegalLinks className="report-legal-links" />
          </div>
        </div>
      </div>

      <div ref={pdfSourceRef} className="report-pdf-export-root" aria-hidden>
        <ReportPdfDocument
          form={form}
          report={safeReport}
          locale={reportLocale}
          unlocked={unlocked}
          recipientName={pdfRecipientName}
        />
      </div>
    </div>
  );
}
