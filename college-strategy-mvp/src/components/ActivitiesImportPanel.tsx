import { useMemo, useState } from "react";
import type { ActivityItem } from "../types";
import type { Translate } from "../i18n/LanguageContext";
import { useLanguage } from "../i18n/LanguageContext";
import {
  activitiesParseSucceeded,
  parseActivitiesFile,
  parseActivitiesPaste,
} from "../lib/activitiesParseClient";
import "./TranscriptGradeSheet.css";

export type ActivitiesImportMeta = {
  hadExistingContent: boolean;
};

export type ActivitiesImportResult = {
  addedCount: number;
  totalCount: number;
  appended: boolean;
};

type Props = {
  t: Translate;
  activityCount: number;
  hasExistingActivities: boolean;
  onImport: (items: ActivityItem[], meta: ActivitiesImportMeta) => ActivitiesImportResult;
};

export function ActivitiesImportPanel({ t, activityCount, hasExistingActivities, onImport }: Props) {
  const { locale } = useLanguage();
  const [pasteText, setPasteText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [importTotalCount, setImportTotalCount] = useState<number | null>(null);
  const [importAppended, setImportAppended] = useState(false);

  const flowStep = useMemo(() => {
    if (activityCount > 0 && importedCount !== null) return 2;
    if (fileName || pasteText.trim()) return 1;
    return 1;
  }, [activityCount, fileName, importedCount, pasteText]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setParseError("");
    setImportedCount(null);
    setImportTotalCount(null);
    setImportAppended(false);
    setFileName(file.name);
    try {
      const parsed = await parseActivitiesFile(file, locale);
      if (activitiesParseSucceeded(parsed)) {
        const result = onImport(parsed.activities, { hadExistingContent: hasExistingActivities });
        setImportedCount(result.addedCount);
        setImportTotalCount(result.totalCount);
        setImportAppended(result.appended);
      } else {
        setParseError(parsed.parseError || "no_activities_detected");
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePasteParse = () => {
    if (!pasteText.trim()) return;
    setParseError("");
    setImportedCount(null);
    setImportTotalCount(null);
    setImportAppended(false);
    setFileName("");
    const parsed = parseActivitiesPaste(pasteText);
    if (activitiesParseSucceeded(parsed)) {
      const result = onImport(parsed.activities, { hadExistingContent: hasExistingActivities });
      setImportedCount(result.addedCount);
      setImportTotalCount(result.totalCount);
      setImportAppended(result.appended);
    } else {
      setParseError(parsed.parseError || "no_activities_detected");
    }
  };

  const isParsing = busy;

  return (
    <div className="transcript-sheet transcript-sheet--activities">
      <ol className="transcript-sheet__flow" aria-label={t("form.activitiesImport.flowLabel")}>
        <li className={flowStep >= 1 ? "is-active" : undefined} data-done={flowStep > 1 || undefined}>
          {t("form.activitiesImport.stepImport")}
        </li>
        <li className={flowStep >= 2 ? "is-active" : undefined}>{t("form.activitiesImport.stepReview")}</li>
      </ol>

      {importedCount !== null ? (
        <p className="transcript-sheet__banner transcript-sheet__banner--ok">
          {importAppended
            ? t("form.activitiesImport.appended")
                .replace("{n}", String(importedCount))
                .replace("{total}", String(importTotalCount ?? importedCount))
            : t("form.activitiesImport.imported").replace("{n}", String(importedCount))}
        </p>
      ) : null}

      <section className="transcript-sheet__card" aria-labelledby="act-import-heading">
        <h3 id="act-import-heading" className="transcript-sheet__card-title">
          {t("form.activitiesImport.stepImport")}
        </h3>
        <p className="transcript-sheet__card-lead">{t("form.activitiesImport.uploadFormats")}</p>

        <label className={`transcript-sheet__drop${isParsing ? " is-busy" : ""}`}>
          <span className="transcript-sheet__drop-icon" aria-hidden>
            ↑
          </span>
          <span className="transcript-sheet__drop-label">{t("form.activitiesImport.upload")}</span>
          <span className="transcript-sheet__drop-hint">{t("form.activitiesImport.uploadHint")}</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.tsv,image/*,application/pdf,text/plain,text/csv"
            className="transcript-sheet__file-input"
            disabled={isParsing}
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {fileName ? (
          <p className="transcript-sheet__file">
            <span className="transcript-sheet__file-name">{fileName}</span>
          </p>
        ) : null}

        {isParsing ? <p className="transcript-sheet__status">{t("form.activitiesImport.parsing")}</p> : null}
        {parseError ? (
          <p className="transcript-sheet__error transcript-sheet__error--pre" role="alert">
            {formatParseError(parseError, t)}
          </p>
        ) : null}

        <button
          type="button"
          className="transcript-sheet__toggle-paste"
          aria-expanded={pasteOpen}
          onClick={() => setPasteOpen((v) => !v)}
        >
          {pasteOpen ? t("form.activitiesImport.togglePasteHide") : t("form.activitiesImport.togglePasteShow")}
        </button>

        {pasteOpen ? (
          <div className="transcript-sheet__paste">
            <textarea
              id="activities-paste"
              className="input-modern input-modern--action transcript-sheet__paste-input"
              rows={4}
              value={pasteText}
              placeholder={t("form.activitiesImport.pastePlaceholder")}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button type="button" className="admin-portal__btn admin-portal__btn--ghost" onClick={handlePasteParse}>
              {t("form.activitiesImport.parsePaste")}
            </button>
          </div>
        ) : null}
      </section>

      <p className="transcript-sheet__hint">{t("form.activitiesImport.hint")}</p>
    </div>
  );
}

function formatParseError(raw: string, t: Translate): string {
  const [code, ...rest] = raw.split("\n");
  const hint = rest.join("\n").trim();
  const key = `form.activitiesImport.errors.${code}`;
  const localized = t(key);
  const base = localized !== key ? localized : t("form.activitiesImport.parseFailed");
  return hint ? `${base}\n\n${hint}` : base;
}
