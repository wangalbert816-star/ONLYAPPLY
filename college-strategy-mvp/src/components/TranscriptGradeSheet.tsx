import { useCallback, useMemo, useState } from "react";
import type { FormState, TranscriptCourseRow, TranscriptSheet } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { useLanguage } from "../i18n/LanguageContext";
import {
  COURSE_LEVEL_OPTIONS,
  GRADE_YEAR_OPTIONS,
  GRADING_SCALE_OPTIONS,
  createTranscriptCourseRow,
  ensureTranscriptSheet,
  syncGpaSummaryFromSheet,
} from "../lib/transcriptSheet";
import { parseTranscriptFile, parseTranscriptPaste } from "../lib/transcriptParseClient";
import "./TranscriptGradeSheet.css";

type Updater = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

type Props = {
  form: FormState;
  update: Updater;
  t: Translate;
  onSkipAdvance?: () => void;
};

export function TranscriptGradeSheet({ form, update, t, onSkipAdvance }: Props) {
  const { locale } = useLanguage();
  const sheet = ensureTranscriptSheet(form);
  const [pasteText, setPasteText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  const patchSheet = useCallback(
    (patch: Partial<TranscriptSheet>) => {
      const next: TranscriptSheet = { ...ensureTranscriptSheet(form), ...patch };
      update("transcriptSheet", next);
      if (!next.skipped && (next.courses.length || next.unweightedGpa || next.weightedGpa)) {
        const summary = syncGpaSummaryFromSheet(next);
        if (summary) update("gpa", summary);
      }
    },
    [form, update],
  );

  const patchCourse = (id: string, patch: Partial<TranscriptCourseRow>) => {
    patchSheet({
      courses: sheet.courses.map((row) =>
        row.id === id ? { ...row, ...patch, source: "user" as const } : row,
      ),
    });
  };

  const addRow = () => {
    patchSheet({ courses: [...sheet.courses, createTranscriptCourseRow()] });
  };

  const removeRow = (id: string) => {
    patchSheet({ courses: sheet.courses.filter((r) => r.id !== id) });
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setShowMissing(false);
    patchSheet({ parseStatus: "parsing", parseError: "", fileName: file.name });
    try {
      const parsed = await parseTranscriptFile(file, locale);
      patchSheet({ ...parsed, confirmedAt: "" });
    } finally {
      setBusy(false);
    }
  };

  const handlePasteParse = () => {
    if (!pasteText.trim()) return;
    setShowMissing(false);
    const parsed = parseTranscriptPaste(pasteText);
    patchSheet({ ...parsed, confirmedAt: "" });
  };

  const hasGpa = Boolean(sheet.unweightedGpa.trim() || sheet.weightedGpa.trim());
  const hasCourse = sheet.courses.some((c) => c.courseName.trim() && c.grade.trim());
  const canConfirm = Boolean(sheet.gradingScale && (hasGpa || hasCourse));
  const courseCount = sheet.courses.filter((c) => c.courseName.trim()).length;
  const isParsing = busy || sheet.parseStatus === "parsing";
  const isConfirmed = Boolean(sheet.confirmedAt);

  const flowStep = useMemo(() => {
    if (isConfirmed) return 3;
    if (sheet.gradingScale || hasGpa || hasCourse || sheet.fileName) return 2;
    return 1;
  }, [hasCourse, hasGpa, isConfirmed, sheet.fileName, sheet.gradingScale]);

  const handleConfirm = () => {
    if (!canConfirm) {
      setShowMissing(true);
      return;
    }
    setShowMissing(false);
    patchSheet({
      skipped: false,
      confirmedAt: new Date().toISOString(),
      parseStatus: "ready",
    });
  };

  const handleSkip = () => {
    patchSheet({
      skipped: true,
      confirmedAt: "",
      courses: [],
      parseStatus: "idle",
      parseError: "",
    });
    onSkipAdvance?.();
  };

  return (
    <div className="transcript-sheet">
      <ol className="transcript-sheet__flow" aria-label={t("form.transcriptSheet.flowLabel")}>
        <li className={flowStep >= 1 ? "is-active" : undefined} data-done={flowStep > 1 || undefined}>
          {t("form.transcriptSheet.stepImport")}
        </li>
        <li className={flowStep >= 2 ? "is-active" : undefined} data-done={flowStep > 2 || undefined}>
          {t("form.transcriptSheet.stepReview")}
        </li>
        <li className={flowStep >= 3 ? "is-active" : undefined}>{t("form.transcriptSheet.stepConfirm")}</li>
      </ol>

      {isConfirmed ? (
        <p className="transcript-sheet__banner transcript-sheet__banner--ok">{t("form.transcriptSheet.confirmed")}</p>
      ) : null}

      <section className="transcript-sheet__card" aria-labelledby="ts-import-heading">
        <h3 id="ts-import-heading" className="transcript-sheet__card-title">
          {t("form.transcriptSheet.stepImport")}
        </h3>
        <p className="transcript-sheet__card-lead">{t("form.transcriptSheet.uploadFormats")}</p>

        <label className={`transcript-sheet__drop${isParsing ? " is-busy" : ""}`}>
          <span className="transcript-sheet__drop-icon" aria-hidden>
            ↑
          </span>
          <span className="transcript-sheet__drop-label">{t("form.transcriptSheet.upload")}</span>
          <span className="transcript-sheet__drop-hint">{t("form.transcriptSheet.uploadHint")}</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,image/*,application/pdf,text/plain"
            className="transcript-sheet__file-input"
            disabled={isParsing}
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {sheet.fileName ? (
          <p className="transcript-sheet__file">
            <span className="transcript-sheet__file-name">{sheet.fileName}</span>
          </p>
        ) : null}

        {isParsing ? <p className="transcript-sheet__status">{t("form.transcriptSheet.parsing")}</p> : null}
        {sheet.parseStatus === "failed" && sheet.parseError ? (
          <p className="transcript-sheet__error transcript-sheet__error--pre" role="alert">
            {formatParseError(sheet.parseError, t)}
          </p>
        ) : null}

        <button
          type="button"
          className="transcript-sheet__toggle-paste"
          aria-expanded={pasteOpen}
          onClick={() => setPasteOpen((v) => !v)}
        >
          {pasteOpen ? t("form.transcriptSheet.togglePasteHide") : t("form.transcriptSheet.togglePasteShow")}
        </button>

        {pasteOpen ? (
          <div className="transcript-sheet__paste">
            <textarea
              id="transcript-paste"
              className="input-modern input-modern--action transcript-sheet__paste-input"
              rows={3}
              value={pasteText}
              placeholder={t("form.transcriptSheet.pastePlaceholder")}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button type="button" className="admin-portal__btn admin-portal__btn--ghost" onClick={handlePasteParse}>
              {t("form.transcriptSheet.parsePaste")}
            </button>
          </div>
        ) : null}
      </section>

      <section className="transcript-sheet__card" aria-labelledby="ts-review-heading">
        <div className="transcript-sheet__card-head">
          <h3 id="ts-review-heading" className="transcript-sheet__card-title">
            {t("form.transcriptSheet.sectionReview")}
          </h3>
          {courseCount > 0 ? (
            <span className="transcript-sheet__badge">
              {t("form.transcriptSheet.courseCount").replace("{n}", String(courseCount))}
            </span>
          ) : null}
        </div>

        <div className="transcript-sheet__gpa-row">
          <div className="transcript-sheet__gpa-field transcript-sheet__gpa-field--scale">
            <label className="field-sub-label" htmlFor="ts-scale">
              {t("form.transcriptSheet.scaleLabel")}
            </label>
            <select
              id="ts-scale"
              className="input-modern input-modern--action"
              value={sheet.gradingScale}
              onChange={(e) => patchSheet({ gradingScale: e.target.value as TranscriptSheet["gradingScale"] })}
            >
              <option value="">{t("form.opt.choose")}</option>
              {GRADING_SCALE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="transcript-sheet__gpa-field">
            <label className="field-sub-label" htmlFor="ts-uw">
              {t("form.transcriptSheet.uwGpa")}
            </label>
            <input
              id="ts-uw"
              className="input-modern input-modern--action"
              value={sheet.unweightedGpa}
              placeholder="3.85"
              onChange={(e) => patchSheet({ unweightedGpa: e.target.value })}
            />
          </div>
          <div className="transcript-sheet__gpa-field">
            <label className="field-sub-label" htmlFor="ts-w">
              {t("form.transcriptSheet.wGpa")}
            </label>
            <input
              id="ts-w"
              className="input-modern input-modern--action"
              value={sheet.weightedGpa}
              placeholder="4.2"
              onChange={(e) => patchSheet({ weightedGpa: e.target.value })}
            />
          </div>
        </div>

        <div className="transcript-sheet__table-wrap">
          <table className="transcript-sheet__table">
            <thead>
              <tr>
                <th>{t("form.transcriptSheet.colYear")}</th>
                <th>{t("form.transcriptSheet.colSubject")}</th>
                <th>{t("form.transcriptSheet.colCourse")}</th>
                <th>{t("form.transcriptSheet.colLevel")}</th>
                <th>{t("form.transcriptSheet.colGrade")}</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {sheet.courses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="transcript-sheet__empty">
                    {t("form.transcriptSheet.empty")}
                  </td>
                </tr>
              ) : (
                sheet.courses.map((row) => (
                  <tr key={row.id} className={row.confidence === "low" ? "transcript-sheet__row--low" : undefined}>
                    <td data-label={t("form.transcriptSheet.colYear")}>
                      <select
                        className="transcript-sheet__cell-input"
                        value={row.gradeYear}
                        aria-label={t("form.transcriptSheet.colYear")}
                        onChange={(e) =>
                          patchCourse(row.id, { gradeYear: e.target.value as TranscriptCourseRow["gradeYear"] })
                        }
                      >
                        {GRADE_YEAR_OPTIONS.map((y) => (
                          <option key={y} value={y}>
                            {y === "other" ? t("form.transcriptSheet.yearOther") : y}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label={t("form.transcriptSheet.colSubject")}>
                      <input
                        className="transcript-sheet__cell-input"
                        value={row.subject}
                        aria-label={t("form.transcriptSheet.colSubject")}
                        onChange={(e) => patchCourse(row.id, { subject: e.target.value })}
                      />
                    </td>
                    <td data-label={t("form.transcriptSheet.colCourse")}>
                      <input
                        className="transcript-sheet__cell-input transcript-sheet__cell-input--wide"
                        value={row.courseName}
                        aria-label={t("form.transcriptSheet.colCourse")}
                        onChange={(e) => patchCourse(row.id, { courseName: e.target.value })}
                      />
                    </td>
                    <td data-label={t("form.transcriptSheet.colLevel")}>
                      <select
                        className="transcript-sheet__cell-input"
                        value={row.level}
                        aria-label={t("form.transcriptSheet.colLevel")}
                        onChange={(e) =>
                          patchCourse(row.id, { level: e.target.value as TranscriptCourseRow["level"] })
                        }
                      >
                        {COURSE_LEVEL_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label={t("form.transcriptSheet.colGrade")}>
                      <input
                        className="transcript-sheet__cell-input"
                        value={row.grade}
                        aria-label={t("form.transcriptSheet.colGrade")}
                        onChange={(e) => patchCourse(row.id, { grade: e.target.value })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="transcript-sheet__remove"
                        aria-label={t("form.transcriptSheet.removeRow")}
                        onClick={() => removeRow(row.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button type="button" className="transcript-sheet__add-row" onClick={addRow}>
          + {t("form.transcriptSheet.addRow")}
        </button>
      </section>

      <div className="transcript-sheet__footer">
        <p className="transcript-sheet__footer-note">{t("form.transcriptSheet.confirmVsSkip")}</p>
        <button
          type="button"
          className="btn btn-primary btn-primary--guided btn-block transcript-sheet__confirm"
          onClick={handleConfirm}
          disabled={isConfirmed}
        >
          {t("form.transcriptSheet.confirm")}
        </button>
        {showMissing && !canConfirm ? (
          <p className="transcript-sheet__missing" role="status">
            {t("form.transcriptSheet.confirmMissing")}
          </p>
        ) : null}
        {!isConfirmed ? <p className="transcript-sheet__hint">{t("form.transcriptSheet.hint")}</p> : null}
        <button type="button" className="transcript-sheet__skip" onClick={handleSkip}>
          {t("form.transcriptSheet.skip")}
        </button>
      </div>
    </div>
  );
}

function formatParseError(raw: string, t: Translate): string {
  const [code, ...rest] = raw.split("\n");
  const hint = rest.join("\n").trim();
  const key = `form.transcriptSheet.errors.${code}`;
  const localized = t(key);
  const base = localized !== key ? localized : t("form.transcriptSheet.parseFailed");
  return hint ? `${base}\n\n${hint}` : base;
}
