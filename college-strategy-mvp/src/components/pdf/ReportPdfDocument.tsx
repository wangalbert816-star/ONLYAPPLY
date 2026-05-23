import type { ReactNode } from "react";
import type { FormState, ReportPayload } from "../../types";
import type { Locale } from "../../i18n/strings";
import { BrandLogo } from "../BrandLogo";
import { buildPdfReportModel, type PdfSchoolRow } from "../../lib/pdfReportModel";
import { PdfProfileRadar } from "./PdfProfileRadar";
import "./ReportPdfDocument.css";

function PdfKeep({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `pdf-keep ${className}` : "pdf-keep"}>{children}</div>;
}

function PdfSectionHead({ title, lead }: { title: string; lead: string }) {
  return (
    <PdfKeep className="pdf-keep--head">
      <h2 className="pdf-h2">{title}</h2>
      <p className="pdf-lead">{lead}</p>
    </PdfKeep>
  );
}

type Props = {
  form: FormState;
  report: ReportPayload;
  locale: Locale;
  unlocked: boolean;
  recipientName?: string | null;
};

function CellLines({ items }: { items: string[] }) {
  if (items.length === 0) return <>—</>;
  return (
    <>
      {items.map((line, j) => (
        <div key={j} className="pdf-cell-line">
          {line}
        </div>
      ))}
    </>
  );
}

function PdfSchoolBlock({ row, zh }: { row: PdfSchoolRow; zh: boolean }) {
  return (
    <PdfKeep className="pdf-school-block">
      <p className="pdf-school-block__name">{row.school}</p>
      {row.campusVibe ? (
        <p className="pdf-school-block__meta">
          <span className="pdf-k">{zh ? "气质" : "Vibe"}</span> {row.campusVibe}
        </p>
      ) : null}
      {row.differentiation ? (
        <p className="pdf-school-block__meta">
          <span className="pdf-k">{zh ? "差异" : "Diff"}</span> {row.differentiation}
        </p>
      ) : null}
      {row.contextNote ? (
        <p className="pdf-school-block__meta">
          <span className="pdf-k">{zh ? "语境" : "Context"}</span> {row.contextNote}
        </p>
      ) : null}
      {row.cultureFit ? <p className="pdf-school-block__culture">{row.cultureFit}</p> : null}
      <table className="pdf-school-table pdf-school-table--wide">
        <thead>
          <tr>
            <th>{zh ? "入档理由" : "Why tier"}</th>
            <th>{zh ? "匹配信号" : "Fit signals"}</th>
            <th>{zh ? "主要风险" : "Key risks"}</th>
            <th>{zh ? "官网核对" : "Verify"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{row.why || "—"}</td>
            <td>
              <CellLines items={row.signals} />
            </td>
            <td>
              <CellLines items={row.risks} />
            </td>
            <td>
              <CellLines items={row.verify} />
            </td>
          </tr>
        </tbody>
      </table>
      {row.officialLinks.length > 0 ? (
        <ul className="pdf-school-links">
          {row.officialLinks.map((link, i) => (
            <li key={i}>{link}</li>
          ))}
        </ul>
      ) : null}
    </PdfKeep>
  );
}

export function ReportPdfDocument({ form, report, locale, unlocked, recipientName }: Props) {
  const m = buildPdfReportModel(form, report, locale, unlocked, recipientName);
  const zh = m.locale === "zh";

  const hasContext =
    m.informationGaps.length > 0 || m.portfolioRisks.length > 0 || m.strategyNotes.length > 0;

  return (
    <div className="pdf-doc" lang={zh ? "zh-CN" : "en"}>
      <section className="pdf-cover-page">
        <div className="pdf-cover__glow" aria-hidden />
        <div className="pdf-cover__frame">
          <header className="pdf-cover__top">
            <BrandLogo className="pdf-cover__logo" />
            <p className="pdf-cover__type">{zh ? "申请决策报告" : "Application Decision Report"}</p>
          </header>

          <div className="pdf-cover__hero">
            <p className="pdf-cover__eyebrow">{zh ? "个性化选校策略" : "Personalized admissions strategy"}</p>
            <h1 className="pdf-cover__title">{m.coverTitle}</h1>
            <p className="pdf-cover__intake">{m.intakeLabel}</p>
            <p className="pdf-cover__tagline">
              {zh ? "可核对 · 可执行 · 一次带走" : "Verifiable · Actionable · Yours to keep"}
            </p>
          </div>

          <div className="pdf-cover__meta">
            {m.recipientName && (
              <p className="pdf-cover__meta-row">
                <span className="pdf-cover__meta-k">{zh ? "申请人" : "Prepared for"}</span>
                <span className="pdf-cover__meta-v">{m.recipientName}</span>
              </p>
            )}
            <p className="pdf-cover__meta-row">
              <span className="pdf-cover__meta-k">{zh ? "生成时间" : "Generated"}</span>
              <span className="pdf-cover__meta-v">{m.generatedAt}</span>
            </p>
            {m.isPreview && (
              <p className="pdf-cover__preview">{zh ? "预览版 · 部分内容未展开" : "Preview · partial content"}</p>
            )}
          </div>
        </div>
        <p className="pdf-cover__foot">{zh ? "仅供申请人规划参考" : "For planning purposes only"}</p>
      </section>

      <div className="pdf-body">
        <section className="pdf-section">
          <PdfSectionHead
            title={zh ? "你的申请结论" : "Your Application Summary"}
            lead={zh ? "一页读完重点" : "Everything that matters on one page"}
          />

          {m.profile.length > 0 && (
            <dl className="pdf-profile-strip">
              {m.profile.map((row) => (
                <div key={row.label} className="pdf-profile-strip__row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="pdf-verdict-card">
            <p className="pdf-verdict-card__headline">{m.verdict.headline}</p>
            {m.verdict.subline && <p className="pdf-verdict-card__subline">{m.verdict.subline}</p>}
            <ul className="pdf-verdict-card__bullets">
              <li>
                <span className="pdf-tag pdf-tag--ok">{zh ? "优势" : "Strength"}</span>
                {m.verdict.advantage}
              </li>
              <li>
                <span className="pdf-tag pdf-tag--risk">{zh ? "短板" : "Drag"}</span>
                {m.verdict.weakness}
              </li>
              <li>
                <span className="pdf-tag pdf-tag--go">{zh ? "策略" : "Strategy"}</span>
                {m.verdict.strategy}
              </li>
            </ul>
          </div>

          <PdfKeep>
            <h3 className="pdf-h3">{zh ? "接下来最重要的 3 件事" : "Top 3 moves next"}</h3>
            <ol className="pdf-top-actions">
              {m.topActions.map((a, i) => (
                <li key={i}>
                  <strong>{a.title}</strong>
                  {a.detail && <span> — {a.detail}</span>}
                </li>
              ))}
            </ol>
          </PdfKeep>

          {m.executiveSummary.length > 0 && (
            <PdfKeep>
              <h3 className="pdf-h3">{zh ? "要点速览" : "At a glance"}</h3>
              <ul className="pdf-bullets">
                {m.executiveSummary.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </PdfKeep>
          )}
        </section>

        <section className="pdf-section">
          <PdfSectionHead
            title={zh ? "五维申请画像" : "Five-dimension profile"}
            lead={zh ? "雷达总览 + 每维结论、原因与建议" : "Radar overview + judgment, why, and next steps"}
          />

          <PdfKeep className="pdf-gap-banner">
            <p className="pdf-gap-banner__title">
              {zh ? "当前最大短板" : "Biggest gap"} · {m.biggestGap.label}（{m.biggestGap.score}
              {zh ? "分" : ""}）
            </p>
            <p className="pdf-gap-banner__judgment">{m.biggestGap.judgment}</p>
            <p className="pdf-gap-banner__stake">{m.biggestGap.stakeLine}</p>
            <p className="pdf-gap-banner__line">
              <span className="pdf-k">{zh ? "原因" : "Why"}</span>
              {m.biggestGap.reason}
            </p>
            <p className="pdf-gap-banner__line">
              <span className="pdf-k">{zh ? "建议" : "Next"}</span>
              {m.biggestGap.suggest}
            </p>
          </PdfKeep>

          <PdfKeep className="pdf-radar-panel">
            <PdfProfileRadar items={m.radarDimensions} locale={m.locale} weakestKey={m.biggestGap.key} />
          </PdfKeep>

          <div className="pdf-dim-grid">
            {m.dimensions.map((d) => (
              <PdfKeep key={d.key} className={`pdf-dim-card${d.isWeakest ? " pdf-dim-card--weakest" : ""}`}>
                <header className="pdf-dim-card__head">
                  <p className="pdf-dim-card__title">
                    {d.label} · {d.score}
                    {zh ? " 分" : ""}
                  </p>
                  {d.isWeakest && <p className="pdf-dim-card__badge">{zh ? "当前最大短板" : "Fix first"}</p>}
                </header>
                <p className="pdf-dim-card__judgment">{d.judgment}</p>
                <p className="pdf-dim-card__line">
                  <span className="pdf-k">{zh ? "原因" : "Why"}</span>
                  {d.reason}
                </p>
                <p className="pdf-dim-card__line">
                  <span className="pdf-k">{zh ? "建议" : "Next"}</span>
                  {d.suggest}
                </p>
              </PdfKeep>
            ))}
          </div>
        </section>

        {(m.schoolTiers.length > 0 || m.topReferenceSchools.length > 0) && (
          <section className="pdf-section">
            <PdfSectionHead
              title={zh ? "推荐院校（按冲 / 稳 / 保）" : "Recommended schools (Reach / Match / Safety)"}
              lead={
                zh
                  ? "建议优先看「主要风险」，再核对入档理由与官网项。"
                  : "Scan key risks first, then fit and verification."
              }
            />
            {m.schoolTiers.map((tier) => (
              <div key={tier.tier} className="pdf-school-tier">
                <PdfKeep className="pdf-school-tier__head">
                  <h3 className="pdf-h3 pdf-school-tier__title">{tier.title}</h3>
                </PdfKeep>
                {tier.rows.map((row, i) => (
                  <PdfSchoolBlock key={`${row.school}-${i}`} row={row} zh={zh} />
                ))}
              </div>
            ))}
            {m.topReferenceSchools.length > 0 && (
              <PdfKeep className="pdf-top-reference">
                <h3 className="pdf-h3 pdf-school-tier__title">
                  {zh ? "顶级学校（参考）" : "Top schools (reference only)"}
                </h3>
                <p className="pdf-lead">
                  {zh
                    ? "这些学校在当前条件下录取概率极低，且对所有申请者都属于极高风险申请；它们不是常规推荐选择。"
                    : "Under the current information, these schools are extremely unlikely and high-risk for nearly every applicant; they are not regular recommendations."}
                </p>
                {m.topReferenceSchools.map((row, i) => (
                  <PdfSchoolBlock key={`${row.school}-${i}`} row={row} zh={zh} />
                ))}
              </PdfKeep>
            )}
          </section>
        )}

        {m.ucSection && (
          <section className="pdf-section pdf-section--uc">
            <PdfSectionHead
              title={zh ? "UC 系统专项" : "UC system portfolio"}
              lead={m.ucSection.overview}
            />
            <PdfKeep className="pdf-uc-callout">
              <strong>{zh ? "Test-Blind" : "Test-blind"}</strong>
              <p>{m.ucSection.testBlindNote}</p>
            </PdfKeep>
            <p className="pdf-lead">{m.ucSection.applicationNote}</p>
            {m.ucSection.tiers.map((tier) => (
              <div key={tier.tier} className="pdf-school-tier">
                <PdfKeep className="pdf-school-tier__head">
                  <h3 className="pdf-h3 pdf-school-tier__title">{tier.title}</h3>
                </PdfKeep>
                {tier.rows.map((row, i) => (
                  <PdfSchoolBlock key={`uc-${row.school}-${i}`} row={row} zh={zh} />
                ))}
              </div>
            ))}
            {m.ucSection.checklist.length > 0 && (
              <PdfKeep>
                <h3 className="pdf-h3">{zh ? "UC 核对清单" : "UC checklist"}</h3>
                <ul className="pdf-bullets">
                  {m.ucSection.checklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </PdfKeep>
            )}
            {m.ucSection.piqDirections.length > 0 && (
              <PdfKeep>
                <h3 className="pdf-h3">{zh ? "PIQ 方向" : "PIQ directions"}</h3>
                <ul className="pdf-bullets">
                  {m.ucSection.piqDirections.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </PdfKeep>
            )}
          </section>
        )}

        {hasContext && (
          <section className="pdf-section">
            {m.informationGaps.length > 0 && (
              <PdfKeep>
                <h2 className="pdf-h2">{zh ? "信息缺口" : "Information gaps"}</h2>
                <p className="pdf-lead">{zh ? "补齐后报告会更准" : "Filling these tightens the report"}</p>
                <ul className="pdf-bullets">
                  {m.informationGaps.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </PdfKeep>
            )}
            {m.portfolioRisks.length > 0 && (
              <PdfKeep>
                <h2 className={`pdf-h2${m.informationGaps.length > 0 ? " pdf-h2--spaced" : ""}`}>
                  {zh ? "组合风险" : "Portfolio risks"}
                </h2>
                <ul className="pdf-risk-list">
                  {m.portfolioRisks.map((r, i) => (
                    <li key={i}>
                      <strong>{r.title}</strong>：{r.meaning}
                      <span className="pdf-risk-mit">
                        {zh ? "应对" : "Mitigation"}：{r.mitigation}
                      </span>
                    </li>
                  ))}
                </ul>
              </PdfKeep>
            )}
            {m.strategyNotes.length > 0 && (
              <PdfKeep>
                <h2
                  className={`pdf-h2${m.informationGaps.length > 0 || m.portfolioRisks.length > 0 ? " pdf-h2--spaced" : ""}`}
                >
                  {zh ? "策略备注" : "Strategy notes"}
                </h2>
                <ul className="pdf-bullets">
                  {m.strategyNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </PdfKeep>
            )}
          </section>
        )}

        {m.actions.length > 0 && (
          <section className={`pdf-section${hasContext ? " pdf-section--break-before" : ""}`}>
            <PdfSectionHead
              title={zh ? "接下来怎么做" : "What to do next"}
              lead={zh ? "按节奏执行 · 勾选即进度" : "Run this like a checklist"}
            />
            {m.priorityFrame ? <p className="pdf-improve-priority">{m.priorityFrame}</p> : null}
            {m.activityBuild.length > 0 && (
              <PdfKeep className="pdf-action-block">
                <h3 className="pdf-h3">{zh ? "活动深化建议" : "Activity build"}</h3>
                <ul className="pdf-checklist">
                  {m.activityBuild.map((item, i) => (
                    <li key={i}>
                      <span className="pdf-check" aria-hidden>
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </PdfKeep>
            )}
            {m.actions.map((section) => (
              <PdfKeep key={section.title} className="pdf-action-block">
                <h3 className="pdf-h3">【{section.title}】</h3>
                <ul className="pdf-checklist">
                  {section.items.map((item, i) => (
                    <li key={i}>
                      <span className="pdf-check" aria-hidden>
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </PdfKeep>
            ))}
          </section>
        )}

        <PdfKeep className="pdf-footer">
          <p>{m.footerNote}</p>
          <p className="pdf-footer__brand">OnlyApply</p>
        </PdfKeep>
      </div>
    </div>
  );
}
