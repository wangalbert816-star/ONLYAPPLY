import type { Locale } from "../../i18n/strings";
import { buildEvalReportPreview } from "./evalCaseForm";
import type { AdminEvalCase, AdminEvalRunResult, AdminEvalScore, EvalFeedbackExportEntry } from "./crmAdminApi";

type ScoreBreakdown = {
  tier: number | null;
  personalization: number | null;
  actionable: number | null;
  total: number | null;
};

function formatSchools(list: { school: string }[] | undefined) {
  if (!list?.length) return "—";
  return list.map((s) => s.school).join(", ");
}

function scoreFromSaved(score: AdminEvalScore | null | undefined): ScoreBreakdown {
  if (!score) return { tier: null, personalization: null, actionable: null, total: null };
  const tier = typeof score.scoreTier === "number" ? score.scoreTier : null;
  const personalization = typeof score.scorePersonalization === "number" ? score.scorePersonalization : null;
  const actionable = typeof score.scoreActionable === "number" ? score.scoreActionable : null;
  const nums = [tier, personalization, actionable].filter((n): n is number => n != null);
  return {
    tier,
    personalization,
    actionable,
    total: nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null,
  };
}

export function buildEvalFeedbackText(opts: {
  evalCase: AdminEvalCase;
  row: AdminEvalRunResult;
  score: AdminEvalScore | null;
  errorTagLabels: string[];
  previousTotal?: number | null;
  locale: Locale;
  run?: { label: string; createdAt: string } | null;
  includeFooter?: boolean;
}): string {
  const { evalCase, row, score, errorTagLabels, previousTotal, locale, run, includeFooter = true } = opts;
  const isEn = locale === "en";
  const preview = buildEvalReportPreview(row.reportPayload);
  const breakdown = scoreFromSaved(score);
  const notes = score?.notes?.trim() || "";

  const lines: string[] = [];
  lines.push(isEn ? "[OnlyApply report QA feedback]" : "【OnlyApply 报告评测反馈】");
  lines.push(isEn ? `Case: ${evalCase.title}` : `案例：${evalCase.title}`);
  lines.push(isEn ? `Case key: ${evalCase.caseKey}` : `案例编号：${evalCase.caseKey}`);
  if (run) {
    lines.push(isEn ? `Test run: ${run.label}` : `测试批次：${run.label}`);
  }

  if (previousTotal != null && breakdown.total != null) {
    lines.push(
      isEn
        ? `Score change: ${previousTotal}/15 → ${breakdown.total}/15`
        : `分数变化：${previousTotal}/15 → ${breakdown.total}/15`,
    );
  } else if (breakdown.total != null) {
    lines.push(isEn ? `Total score: ${breakdown.total}/15` : `总分：${breakdown.total}/15`);
  } else {
    lines.push(isEn ? "Total score: not saved yet" : "总分：尚未保存");
  }

  if (breakdown.tier != null || breakdown.personalization != null || breakdown.actionable != null) {
    lines.push(
      isEn
        ? `Breakdown — tiers: ${breakdown.tier ?? "—"}, analysis: ${breakdown.personalization ?? "—"}, actionable: ${breakdown.actionable ?? "—"}`
        : `分项 — 冲稳保：${breakdown.tier ?? "—"} · 分析：${breakdown.personalization ?? "—"} · 建议：${breakdown.actionable ?? "—"}`,
    );
  }

  lines.push("");
  lines.push(isEn ? "[Expected answer]" : "【标准答案】");
  lines.push(isEn ? `Reach: ${formatSchools(evalCase.expectedReach)}` : `冲：${formatSchools(evalCase.expectedReach)}`);
  lines.push(isEn ? `Match: ${formatSchools(evalCase.expectedMatch)}` : `稳：${formatSchools(evalCase.expectedMatch)}`);
  lines.push(isEn ? `Safety: ${formatSchools(evalCase.expectedSafety)}` : `保：${formatSchools(evalCase.expectedSafety)}`);
  if (evalCase.forbiddenSchools.length > 0) {
    lines.push(
      isEn
        ? `Must NOT appear: ${evalCase.forbiddenSchools.join(", ")}`
        : `不应出现：${evalCase.forbiddenSchools.join("、")}`,
    );
  }

  lines.push("");
  lines.push(isEn ? "[AI output]" : "【AI 输出】");
  if (preview) {
    lines.push(isEn ? `Reach: ${formatSchools(preview.reach.map((r) => ({ school: r.school })))}` : `冲：${preview.reach.map((r) => r.school).join(", ") || "—"}`);
    lines.push(isEn ? `Match: ${formatSchools(preview.match.map((r) => ({ school: r.school })))}` : `稳：${preview.match.map((r) => r.school).join(", ") || "—"}`);
    lines.push(isEn ? `Safety: ${formatSchools(preview.safety.map((r) => ({ school: r.school })))}` : `保：${preview.safety.map((r) => r.school).join(", ") || "—"}`);
    if (preview.summaryBullets[0]) {
      lines.push(isEn ? `Summary: ${preview.summaryBullets[0]}` : `摘要：${preview.summaryBullets[0]}`);
    }
  } else {
    lines.push(isEn ? "(Report not generated or failed)" : "（报告未生成或失败）");
  }

  lines.push("");
  lines.push(isEn ? "[Issues flagged]" : "【问题标签】");
  lines.push(errorTagLabels.length > 0 ? errorTagLabels.join(isEn ? ", " : "、") : isEn ? "None" : "无");

  if (notes) {
    lines.push("");
    lines.push(isEn ? "[Counselor notes]" : "【顾问补充】");
    lines.push(notes);
  }

  if (evalCase.notes?.trim()) {
    lines.push("");
    lines.push(isEn ? "[Case notes]" : "【案例备注】");
    lines.push(evalCase.notes.trim());
  }

  if (includeFooter) {
    lines.push("");
    lines.push(
      isEn
        ? "Please update prompt/rules in server/index.mjs based on this feedback, deploy, then retest the same case."
        : "请据此修改 server/index.mjs 中的 prompt/规则，部署后对同一案例重新生成并对比分数。",
    );
  }

  return lines.join("\n");
}

export function buildEvalFeedbackExportFile(
  entries: EvalFeedbackExportEntry[],
  locale: Locale,
  labelErrorTag: (tag: string) => string,
): string {
  const isEn = locale === "en";
  const exportedAt = new Date().toLocaleString(isEn ? "en-US" : "zh-CN");
  const header = [
    isEn ? "OnlyApply report QA feedback export" : "OnlyApply 报告评测反馈汇总",
    isEn ? `Exported: ${exportedAt}` : `导出时间：${exportedAt}`,
    isEn ? `Entries: ${entries.length}` : `共 ${entries.length} 条`,
    "",
  ].join("\n");

  const body = entries
    .map((entry, index) => {
      const tags = (entry.score.errorTags ?? []).map(labelErrorTag);
      const row: AdminEvalRunResult = { ...entry.result, case: entry.case, score: entry.score };
      const block = buildEvalFeedbackText({
        evalCase: entry.case,
        row,
        score: entry.score,
        errorTagLabels: tags,
        locale,
        run: entry.run,
        includeFooter: false,
      });
      const divider = isEn ? `[${index + 1}/${entries.length}]` : `【${index + 1}/${entries.length}】`;
      return `${"=".repeat(40)}\n${divider}\n${"=".repeat(40)}\n\n${block}`;
    })
    .join("\n\n");

  const footer = isEn
    ? `\n${"=".repeat(40)}\nPlease update prompt/rules in server/index.mjs based on all feedback above, deploy, then retest cases and export again.`
    : `\n${"=".repeat(40)}\n请根据以上全部反馈修改 server/index.mjs 中的 prompt/规则，部署后重新测试并再次导出。`;

  return `${header}${body}${footer}`;
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function evalFeedbackExportFilename(locale: Locale) {
  const d = new Date();
  const stamp = d.toISOString().slice(0, 10);
  return locale === "en" ? `onlyapply-report-feedback-${stamp}.txt` : `onlyapply-报告反馈-${stamp}.txt`;
}
