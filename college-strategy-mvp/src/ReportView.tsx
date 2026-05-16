import type { FormState, PaywallCopy, PaywallTone, ReportDiff, ReportPayload, SchoolRow, SchoolTier, SupplementaryNote } from "./types";
import "./ReportView.css";
import { useMemo, useRef, useState } from "react";
import { useLanguage } from "./i18n/LanguageContext";
import { EN_PAYWALL } from "./i18n/paywallEn";
import { InformationGapsInteractive } from "./components/InformationGapsInteractive";
import { BrandLogo } from "./components/BrandLogo";
import { ExpertConsultSection } from "./components/ExpertConsultSection";
import { ApplicationProfileRadar } from "./components/ApplicationProfileRadar";
import { buildFiveDimensionProfile } from "./lib/fiveDimensionProfile";
import { buildBiggestGapBlock, buildOverallVerdict } from "./lib/decisionReport";
import { DecisionVerdictCard } from "./components/DecisionVerdictCard";
import { ReportBiggestGapBanner } from "./components/ReportBiggestGapBanner";
import { ReportOptimizeCtaBar } from "./components/ReportOptimizeCtaBar";
import { ReportPathStep } from "./components/ReportPathStep";
import { SaveReportBanner } from "./components/auth/SaveReportBanner";
import { ReportDownloadButton } from "./components/ReportDownloadButton";
import { ReportPdfDocument } from "./components/pdf/ReportPdfDocument";
import { getEffectiveIntake } from "./lib/intakeTerm";

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
    title: "预览已证明「逻辑对」——完整版解决「省时间」",
    body: `你看到的总览与信息缺口，是为了建立信任；真正省时间的，是完整版里「9 校全称 + 每校官网核对项 + 本月/提交前行动表」——可直接复制进自己的表格，少翻几十页招生网站。

预览每档只留 1 所样本，不是抠门，是让你先确认：这份报告配得上你接下来要付的那笔钱。`,
    bullets: [
      "9 校全名与入档理由一次展开，方便定稿 list",
      "逐校「官网必核」条目：轮次、国际生政策、费用口径",
      "风险后半段 + 行动表后半段：对齐申请季节奏",
    ],
    ctaPrimary: "解锁完整版 · 带走可执行清单（9 校 + 核对 + 行动表）",
    ctaHint: "演示：点击即开。正式版跳转支付后即时解锁。",
    previewLine: "预览：逻辑与样本已展示——完整版负责省你与家长的对齐时间。",
    hookLead:
      "以下「校名指纹」来自本次真实生成结果（非随机占位）。解锁不是为了多看字，而是把已定稿的数据一次性导出到你的决策里。",
    footerTitle: "还在用表格自己拼？",
    footerText:
      "完整版的价值是「少返工」：同一套信息，用结构换你几个晚上的官网漫游。演示环境可一键解锁看全貌。",
  },
  anxiety: {
    eyebrow: "名单错了，代价不是这几十块",
    title: "最怕的不是多申一所，而是「以为稳了」其实没兜住",
    body: `预览里你已经看到方向；没展开的是：每一档里「第二、第三所」往往才是家长问得最细、也最容易填错的那一格——保底是否真能保住、冲刺是否把你的预算/身份算进去。

这些行一旦错了，损失的不是解锁费，是轮次、材料、情绪与可选空间。完整版把 9 校与风险对策一次摊开，让你至少「知道自己在赌什么」。`,
    bullets: [
      "看清每一档「隐藏校」：是不是你以为的那所保底",
      "风险后半段：专门对付「国际生 + 奖助学金 + 方差」",
      "提交前清单：减少「漏材料 / 看错轮次」这种低级全拒",
    ],
    ctaPrimary: "解锁完整版 · 把风险摊开再决定怎么申",
    ctaHint: "演示：点击即开。正式版支付后立即展示全部敏感行。",
    previewLine: "预览够用来「感受文风」；不够用来「签字定校」——后者在完整版。",
    hookLead:
      "下面三行是本次报告里「尚未展示真名」的学校指纹。它们不是吓唬你，是提醒你：名单已经写进系统了，你只是还没看见全貌。",
    footerTitle: "你可以关掉页面——但名单里的洞不会自己消失",
    footerText:
      "若你此刻正在焦虑 list，完整版至少让你「带着问题去核对官网」，而不是带着空白去猜。演示可一键解锁。",
  },
  curiosity: {
    eyebrow: "真名已经写进报告了——只是还没亮给你",
    title: "来认认：这三所「第二顺位」到底是谁？",
    body: `每一档的第二所学校，模型已经写进 JSON 里了；预览故意只露「指纹」。

如果你读完预览觉得「有点准」，好奇心会逼你想知道剩下是谁——这就是完整版要给你的：不是悬念本身，而是悬念背后的全名、理由与核对路径。`,
    bullets: [
      "揭开冲刺/匹配/保底各自的「第二所」全名",
      "对照每所：为什么它在那一档、主要雷区是什么",
      "把「猜」变成「查」：官网核对项一条条摆出来",
    ],
    ctaPrimary: "揭开谜底 · 解锁 9 校全名与深度行",
    ctaHint: "演示：点击即开。正式版支付后秒开。",
    previewLine: "草稿已生成——谜底在完整版；先看指纹，再决定要不要揭开。",
    hookLead:
      "规则很简单：只看首字母与长度，全名锁定在完整版。若和你心里猜的一样，说明你该解锁往下看了。",
    footerTitle: "都猜到边缘了，不如一次看完",
    footerText: "完整版把三档「第二所」连锅端出，不用来回刷新预览。演示一键解锁。",
  },
};

/** @deprecated 使用 PAYWALL_PACKS[getPaywallTone()] */
export const PAYWALL_GUIDE = PAYWALL_PACKS.rational;

function clampCellText(s: string, max: number): string {
  const v = (s || "").replace(/\s+/g, " ").trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}…`;
}

function StrongHookCard({
  report,
  tone,
  lead,
}: {
  report: ReportPayload;
  tone: PaywallTone;
  lead: string;
}) {
  const { t } = useLanguage();
  const fp = (name?: string) => {
    const s = name?.trim();
    if (!s) return null;
    return t("report.fingerprint", { first: s[0], len: s.length });
  };
  const r2 = fp(report.reach?.[1]?.school);
  const m2 = fp(report.match?.[1]?.school);
  const s2 = fp(report.safety?.[1]?.school);
  const any = r2 || m2 || s2;

  const cta =
    tone === "anxiety"
      ? t("report.strongCtaAnxiety")
      : tone === "curiosity"
        ? t("report.strongCtaCuriosity")
        : t("report.strongCtaRational");

  return (
    <div className={`strong-hook-card strong-hook-card--${tone}`}>
      <h3 className="strong-hook-title">
        {tone === "curiosity" ? t("report.strongTitleCuriosity") : t("report.strongTitleDefault")}
      </h3>
      <p className="strong-hook-lead">{lead}</p>
      {any ? (
        <ul className="strong-hook-list">
          {r2 && (
            <li>
              <strong>{t("report.strongReach")}</strong>
              {r2}
            </li>
          )}
          {m2 && (
            <li>
              <strong>{t("report.strongMatch")}</strong>
              {m2}
            </li>
          )}
          {s2 && (
            <li>
              <strong>{t("report.strongSafety")}</strong>
              {s2}
            </li>
          )}
        </ul>
      ) : (
        <p className="strong-hook-fallback">{t("report.strongFallback")}</p>
      )}
      <p className="strong-hook-cta">{cta}</p>
    </div>
  );
}

function whyCell(row: SchoolRow, tier: "reach" | "match" | "safety"): string {
  if (tier === "reach") return row.why_reach_for_you || "";
  if (tier === "match") return row.why_match_for_you || "";
  return row.why_safety_for_you || "";
}

function PreviewLockedCell({ label }: { label: string }) {
  return (
    <span className="preview-locked-cell">
      <span className="lock-icon" aria-hidden>
        🔒
      </span>
      {label}
    </span>
  );
}

interface ReportViewProps {
  report: ReportPayload;
  form: FormState;
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
  stripeCheckoutEnabled?: boolean;
  inviteCodesEnabled?: boolean;
  inviteRedeemBusy?: boolean;
  onRedeemInviteCode?: (code: string) => void | Promise<void>;
}

export function ReportView({
  report,
  form,
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
  stripeCheckoutEnabled = false,
  inviteCodesEnabled = false,
  inviteRedeemBusy = false,
  onRedeemInviteCode,
}: ReportViewProps) {
  const { t, locale } = useLanguage();
  const [inviteInput, setInviteInput] = useState("");
  const pdfSourceRef = useRef<HTMLDivElement>(null);
  const intakeLabel = useMemo(() => getEffectiveIntake(form) || t("report.title"), [form, t]);
  const profileFive = useMemo(() => buildFiveDimensionProfile(form, locale), [form, locale]);
  const verdict = useMemo(() => buildOverallVerdict(form, profileFive, locale), [form, profileFive, locale]);
  const biggestGap = useMemo(() => buildBiggestGapBlock(profileFive, locale), [profileFive, locale]);
  const tone = getPaywallTone();
  const copy = locale === "zh" ? PAYWALL_PACKS[tone] : EN_PAYWALL[tone];

  const tierLabel = (tier: SchoolTier) =>
    tier === "reach" ? t("report.tierReach") : tier === "match" ? t("report.tierMatch") : t("report.tierSafety");
  const tierTitle = tierLabel;

  const inviteModeOnly = inviteCodesEnabled && !stripeCheckoutEnabled;

  const risks = report.portfolio_risks || [];
  const tw = report.improvement_plan?.this_week || [];
  const tm = report.improvement_plan?.this_month || [];
  const bs = report.improvement_plan?.before_submitting || [];
  const notes = report.strategy_notes || [];

  const lockedSchoolRows = unlocked ? 999 : 1;
  const lockedRiskCount = unlocked ? risks.length : Math.min(1, risks.length);
  const lockedWeekItems = unlocked ? tw.length : Math.min(1, tw.length);
  const visibleExecutiveSummary = unlocked
    ? report.executive_summary ?? []
    : (report.executive_summary ?? []).slice(0, 1);
  const previewGapCount = Math.min(2, report.information_gaps?.length ?? 0);

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
        </section>
      )}

      <div className="top-actions">
        <div className="top-actions__brand">
          <BrandLogo />
          <h1>
            {t("report.title")}{" "}
            {unlocked ? <span className="badge-full">{t("report.badgeFull")}</span> : <span className="badge-preview">{t("report.badgePreview")}</span>}
          </h1>
        </div>
        <div className="top-actions__auth">
          {isAuthenticated && sessionSaved && unlocked && (
            <ReportDownloadButton sourceRef={pdfSourceRef} intakeLabel={intakeLabel} unlocked={unlocked} />
          )}
          {isAuthenticated && sessionSaved && !unlocked && (
            <span className="preview-pdf-lock" data-no-pdf>{t("report.previewPdfLocked")}</span>
          )}
          <button type="button" className="btn btn-secondary" onClick={onReset}>
            {t("report.reset")}
          </button>
        </div>
      </div>

      {authConfigured && (showSaveBanner || (isAuthenticated && sessionSaved)) && onRequestSignIn && (
        <SaveReportBanner
          saved={isAuthenticated && sessionSaved}
          onSignIn={onRequestSignIn}
          onDismiss={showSaveBanner ? onDismissSaveBanner : undefined}
        />
      )}

      <p className="report-ready">
        {unlocked ? t("report.readyFull") : copy.previewLine}
      </p>

      {!unlocked && (
        <div data-no-pdf>
          <StrongHookCard report={report} tone={tone} lead={copy.hookLead} />

          <section className="card paywall-guide" aria-labelledby="paywall-guide-title">
            <p className="paywall-eyebrow">{copy.eyebrow}</p>
            <h2 id="paywall-guide-title" className="paywall-title">
              {copy.title}
            </h2>
            <p className="paywall-body">{copy.body}</p>
            <ul className="paywall-bullets">
              {copy.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <button type="button" className="btn btn-primary btn-block paywall-cta" onClick={onUnlock} disabled={purchaseBusy}>
              {inviteModeOnly ? t("report.inviteUnlockCta") : copy.ctaPrimary}
            </button>
            <p className="paywall-cta-hint">{inviteModeOnly ? t("report.inviteUnlockHint") : copy.ctaHint}</p>
            {inviteCodesEnabled && stripeCheckoutEnabled && (
              <p className="paywall-invite-hybrid-hint">{t("report.inviteHybridHint")}</p>
            )}
            {inviteCodesEnabled && (
              <div id="report-invite-redeem" className="invite-redeem" data-no-pdf>
                <p className="invite-redeem__label">{t("report.inviteCodeLabel")}</p>
                {!isAuthenticated ? (
                  <p className="invite-redeem__hint">{t("report.inviteSignInFirst")}</p>
                ) : !sessionSaved ? (
                  <p className="invite-redeem__hint">{t("report.inviteNeedSave")}</p>
                ) : (
                  <div className="invite-redeem__row">
                    <input
                      type="text"
                      className="invite-redeem__input"
                      autoComplete="off"
                      spellCheck={false}
                      value={inviteInput}
                      onChange={(e) => setInviteInput(e.target.value)}
                      placeholder={t("report.inviteRedeemPlaceholder")}
                      aria-label={t("report.inviteCodeLabel")}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary invite-redeem__btn"
                      disabled={inviteRedeemBusy}
                      onClick={() => void onRedeemInviteCode?.(inviteInput)}
                    >
                      {inviteRedeemBusy ? t("report.inviteRedeemBusy") : t("report.inviteRedeemSubmit")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <div className="report-path" aria-label={t("report.decision.pathAria")}>
        <ReportPathStep step={1} id="report-step-verdict" title={t("report.decision.step1Title")} lead={t("report.decision.step1Lead")}>
          <DecisionVerdictCard verdict={verdict} t={t} />
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
          />
        </ReportPathStep>

        <ReportPathStep step={4} id="report-step-schools" title={t("report.decision.step4Title")} lead={t("report.decision.step4Lead")} bare>
          {(["reach", "match", "safety"] as const).map((tier) => {
        const rows = report[tier] as SchoolRow[] | undefined;
        if (!rows?.length) return null;
        const visible = rows.slice(0, lockedSchoolRows);
        const lockedCount = unlocked ? 0 : Math.max(0, rows.length - 1);
        return (
          <section className="card report-block report-path-step__panel" key={tier}>
            <h2>
              {tierTitle(tier)}
              {!unlocked && lockedCount > 0 && <span className="inline-hint">{t("report.tierMore", { n: lockedCount })}</span>}
            </h2>
            {tier === "reach" && <p className="report-table-guide">{t("report.decision.tableGuide")}</p>}
            <div className="table-wrap report-table-wrap--dense">
              <table>
                <thead>
                  <tr>
                    <th>{t("report.thSchool")}</th>
                    <th>{t("report.thWhy")}</th>
                    <th>{t("report.thSignals")}</th>
                    <th>{t("report.thRisks")}</th>
                    <th>{t("report.thVerify")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, i) => {
                    const hot = highlightSchoolKeys.has(row.school.trim().toLowerCase());
                    return (
                    <tr key={i} className={hot ? "school-row-highlight" : undefined}>
                      <td>{row.school}</td>
                      <td>{clampCellText(whyCell(row, tier), unlocked ? 118 : 72)}</td>
                      {unlocked ? (
                        <>
                          <td>
                            {(row.key_fit_signals || []).map((x, j) => (
                              <div key={j}>{clampCellText(x, 88)}</div>
                            ))}
                          </td>
                          <td>
                            {(row.key_risks || []).map((x, j) => (
                              <div key={j}>{clampCellText(x, 88)}</div>
                            ))}
                          </td>
                          <td>
                            {(row.verification_focus || []).map((x, j) => (
                              <div key={j}>{clampCellText(x, 88)}</div>
                            ))}
                          </td>
                        </>
                      ) : (
                        <>
                          <td><PreviewLockedCell label={t("report.previewTableSignalsLocked")} /></td>
                          <td><PreviewLockedCell label={t("report.previewTableRisksLocked")} /></td>
                          <td><PreviewLockedCell label={t("report.previewTableVerifyLocked")} /></td>
                        </>
                      )}
                    </tr>
                    );
                  })}
                  {!unlocked &&
                    rows.slice(1).map((_, i) => (
                      <tr key={`lock-${i}`} className="row-locked">
                        <td colSpan={5}>
                          <span className="lock-icon" aria-hidden>
                            🔒
                          </span>
                          {t("report.lockRow", { n: i + 2 })}
                          <span className="lock-sub">{t("report.lockRowSub")}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
        </ReportPathStep>

        <ReportPathStep step={5} id="report-step-action" title={t("report.decision.step5Title")} lead={t("report.decision.step5Lead")} bare>
          {unlocked ? (
            <>
              <InformationGapsInteractive
                gaps={report.information_gaps ?? []}
                onRegenerate={onRefreshReportWithGaps}
                isRegenerating={reportRefreshing}
                embedded
              />
              <ReportOptimizeCtaBar t={t} />
            </>
          ) : (
            <section className="card report-block report-path-step__panel preview-gaps-card" id="report-section-gaps">
              <p className="paywall-eyebrow">{t("report.previewGapsEyebrow")}</p>
              <h2>{t("report.previewGapsTitle", { n: report.information_gaps?.length ?? 0 })}</h2>
              <p className="preview-gaps-card__lead">{t("report.previewGapsLead")}</p>
              {(report.information_gaps ?? []).slice(0, previewGapCount).map((gap, i) => (
                <p key={i} className="preview-gap-line">
                  <strong>{t("report.previewGapLabel", { n: i + 1 })}</strong>
                  {clampCellText(gap, 88)}
                </p>
              ))}
              {(report.information_gaps?.length ?? 0) > previewGapCount && (
                <p className="block-locked">
                  <span className="lock-icon" aria-hidden>
                    🔒
                  </span>
                  {t("report.previewGapsLocked", { n: (report.information_gaps?.length ?? 0) - previewGapCount })}
                </p>
              )}
            </section>
          )}
        </ReportPathStep>
      </div>

      <div className="report-path-appendix">
        <h2 className="report-path-appendix__title">{t("report.decision.appendixTitle")}</h2>
        <p className="report-path-appendix__lead">{t("report.decision.appendixLead")}</p>

        {visibleExecutiveSummary.length > 0 && (
          <section className="card report-block report-path-appendix__card">
            <h3>{t("report.decision.execDigestTitle")}</h3>
            <ul className="report-exec-digest__list">
              {visibleExecutiveSummary.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
              {!unlocked && (report.executive_summary?.length ?? 0) > visibleExecutiveSummary.length && (
                <li className="li-locked">
                  {t("report.previewExecLocked", { n: (report.executive_summary?.length ?? 0) - visibleExecutiveSummary.length })}
                  <span className="lock-sub">{t("report.previewUnlockForDetails")}</span>
                </li>
              )}
            </ul>
          </section>
        )}

        <ExpertConsultSection gapCount={report.information_gaps?.length ?? 0} />

      <section className="card report-block report-path-appendix__card">
        <h2>
          {t("report.risksTitle")}
          {!unlocked && risks.length > 2 && <span className="inline-hint">{t("report.risksPreview")}</span>}
        </h2>
        <ul>
          {risks.slice(0, lockedRiskCount).map((r, i) => (
            <li key={i}>
              <strong>{r.risk_title}</strong>：{r.what_it_means_for_you}
              {unlocked && (
                <>
                  {" "}
                  <em>{t("report.risksMit")}</em>
                  {r.mitigation}
                </>
              )}
              {!unlocked && <span className="lock-sub">{t("report.previewRiskMitigationLocked")}</span>}
            </li>
          ))}
          {!unlocked &&
            risks.slice(1).map((r, i) => (
              <li key={`rlock-${i}`} className="li-locked">
                <strong>{r.risk_title}</strong>
                <span className="lock-sub">{t("report.risksLockSub")}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="card report-block">
        <h2>
          {t("report.improveTitle")}
          {!unlocked && <span className="inline-hint">{t("report.improvePreview")}</span>}
        </h2>
        <h3 className="subh">{t("report.week")}</h3>
        <ul>
          {tw.slice(0, lockedWeekItems).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        {!unlocked && tw.length > 1 && (
          <p className="lock-inline">{t("report.weekMore", { n: tw.length - 1 })}</p>
        )}
        <h3 className="subh">{t("report.month")}</h3>
        {unlocked ? (
          <ul>
            {tm.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="block-locked">
            <span className="lock-icon" aria-hidden>
              🔒
            </span>
            {t("report.monthLock", { n: tm.length })}
            <strong>{t("report.monthLockBold")}</strong>
          </p>
        )}
        <h3 className="subh">{t("report.before")}</h3>
        {unlocked ? (
          <ul>
            {bs.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="block-locked">
            <span className="lock-icon" aria-hidden>
              🔒
            </span>
            {t("report.beforeLock", { n: bs.length })}
            <strong>{t("report.beforeLockBold")}</strong>
          </p>
        )}
      </section>

      <section className="card report-block">
        <h2>
          {t("report.notesTitle")}
          {!unlocked && notes.length > 2 && <span className="inline-hint">{t("report.notesPreview")}</span>}
        </h2>
        <ul>
          {notes.slice(0, unlocked ? notes.length : Math.min(1, notes.length)).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
          {!unlocked &&
            notes.slice(1).map((_, i) => (
              <li key={`nlock-${i}`} className="li-locked">
                {t("report.notesLock", { n: i + 2 })}
                <span className="lock-sub">{t("report.notesLockSub")}</span>
              </li>
            ))}
        </ul>
      </section>

      </div>

      <p className="disclaimer">{t("report.disclaimer")}</p>

      <div ref={pdfSourceRef} className="report-pdf-export-root" aria-hidden>
        <ReportPdfDocument
          form={form}
          report={report}
          locale={locale}
          unlocked={unlocked}
          recipientName={pdfRecipientName}
        />
      </div>

      {!unlocked && (
        <section className="card paywall-footer" aria-labelledby="paywall-footer-title" data-no-pdf>
          <h2 id="paywall-footer-title" className="paywall-footer-title">
            {copy.footerTitle}
          </h2>
          <p className="paywall-footer-text">{copy.footerText}</p>
          <button type="button" className="btn btn-primary btn-block" onClick={onUnlock} disabled={purchaseBusy}>
            {copy.ctaPrimary}
          </button>
        </section>
      )}
    </div>
  );
}
