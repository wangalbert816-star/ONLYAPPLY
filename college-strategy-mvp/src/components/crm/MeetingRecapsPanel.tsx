import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import type { CrmMeetingRecapDraft } from "../../lib/crm/meetingRecapFormat";
import { isMeetingRecapDraftValid } from "../../lib/crm/meetingRecapFormat";
import type { CrmMeetingRecap } from "../../lib/crm/types";
import { MeetingRecapView } from "./MeetingRecapView";
import "./MeetingRecapsPanel.css";

function formatRecapDate(value: string | undefined, locale: "zh" | "en") {
  if (!value) return "";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const EMPTY_DRAFT = (): CrmMeetingRecapDraft => ({
  title: "",
  heldAt: "",
  actionItems: "",
  resources: "",
  summary: "",
  recordingUrl: "",
});

type Props = {
  recaps: CrmMeetingRecap[];
  studentDisplayName?: string;
  canEdit?: boolean;
  busy?: boolean;
  compact?: boolean;
  onOpenActionItems?: () => void;
  onAdd?: (input: CrmMeetingRecapDraft) => Promise<void>;
  onDelete?: (recapId: string) => Promise<void>;
};

export function MeetingRecapsPanel({
  recaps,
  studentDisplayName,
  canEdit = false,
  busy = false,
  compact = false,
  onOpenActionItems,
  onAdd,
  onDelete,
}: Props) {
  const { t, locale } = useLanguage();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const visibleRecaps = compact ? recaps.slice(0, 1) : recaps;
  const studentName = studentDisplayName?.trim() || t("crm.meetings.recapStudentFallback");

  const patchDraft = (patch: Partial<CrmMeetingRecapDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    if (error) setError(null);
  };

  const resetForm = () => {
    setDraft(EMPTY_DRAFT());
    setFormOpen(false);
    setError(null);
  };

  const submitRecap = async () => {
    if (!onAdd || busy || !isMeetingRecapDraftValid(draft)) return;
    setError(null);
    try {
      await onAdd({
        ...draft,
        title: draft.title.trim(),
        heldAt: draft.heldAt?.trim() || undefined,
        recordingUrl: draft.recordingUrl?.trim() || undefined,
      });
      resetForm();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(
        raw === "meeting_recaps_schema_missing"
          ? t("crm.meetings.errors.recaps_schema_missing")
          : t("crm.meetings.recapSaveFailed"),
      );
    }
  };

  return (
    <section className={`meeting-recaps${compact ? " meeting-recaps--compact" : ""}`}>
      {!compact ? (
        <div className="meeting-recaps__head">
          <div>
            <h3 className="meeting-recaps__title">{t("crm.meetings.recapsTitle")}</h3>
            <p className="meeting-recaps__lead">{t("crm.meetings.recapsLead")}</p>
          </div>
          {canEdit && onAdd ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm meeting-recaps__add-toggle"
              disabled={busy}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? t("crm.meetings.recapCancel") : t("crm.meetings.recapAdd")}
            </button>
          ) : null}
        </div>
      ) : canEdit && onAdd ? (
        <div className="meeting-recaps__head meeting-recaps__head--compact">
          <button
            type="button"
            className="btn btn-secondary btn-sm meeting-recaps__add-toggle"
            disabled={busy}
            onClick={() => setFormOpen((v) => !v)}
          >
            {formOpen ? t("crm.meetings.recapCancel") : t("crm.meetings.recapAdd")}
          </button>
        </div>
      ) : null}

      {canEdit && onAdd && formOpen ? (
        <div className="meeting-recaps__form">
          <p className="meeting-recaps__form-intro">{t("crm.meetings.recapFormIntro", { student: studentName })}</p>

          <div className="meeting-recaps__form-meta">
            <label className="meeting-recaps__field">
              <span>{t("crm.meetings.recapTitleLabel")}</span>
              <input
                value={draft.title}
                disabled={busy}
                placeholder={t("crm.meetings.recapTitlePlaceholder")}
                onChange={(e) => patchDraft({ title: e.target.value })}
              />
            </label>
            <label className="meeting-recaps__field">
              <span>{t("crm.meetings.recapDateLabel")}</span>
              <input
                type="date"
                value={draft.heldAt ?? ""}
                disabled={busy}
                onChange={(e) => patchDraft({ heldAt: e.target.value })}
              />
            </label>
          </div>

          <fieldset className="meeting-recaps__section-field">
            <legend>{t("crm.meetings.recapSectionActionItems")}</legend>
            <p className="meeting-recaps__section-hint">{t("crm.meetings.recapActionItemsHint")}</p>
            <textarea
              value={draft.actionItems}
              rows={6}
              disabled={busy}
              placeholder={t("crm.meetings.recapActionItemsPlaceholder")}
              onChange={(e) => patchDraft({ actionItems: e.target.value })}
            />
          </fieldset>

          <fieldset className="meeting-recaps__section-field">
            <legend>{t("crm.meetings.recapSectionResources")}</legend>
            <p className="meeting-recaps__section-hint">{t("crm.meetings.recapResourcesHint")}</p>
            <textarea
              value={draft.resources}
              rows={4}
              disabled={busy}
              placeholder={t("crm.meetings.recapResourcesPlaceholder")}
              onChange={(e) => patchDraft({ resources: e.target.value })}
            />
          </fieldset>

          <fieldset className="meeting-recaps__section-field">
            <legend>{t("crm.meetings.recapSectionSummary")}</legend>
            <p className="meeting-recaps__section-hint">{t("crm.meetings.recapSummaryHint")}</p>
            <textarea
              value={draft.summary}
              rows={5}
              disabled={busy}
              placeholder={t("crm.meetings.recapSummaryPlaceholder")}
              onChange={(e) => patchDraft({ summary: e.target.value })}
            />
          </fieldset>

          <fieldset className="meeting-recaps__section-field">
            <legend>{t("crm.meetings.recapSectionRecording")}</legend>
            <label className="meeting-recaps__field">
              <span>{t("crm.meetings.recapRecordingLabel")}</span>
              <input
                type="url"
                value={draft.recordingUrl ?? ""}
                disabled={busy}
                placeholder={t("crm.meetings.recapRecordingPlaceholder")}
                onChange={(e) => patchDraft({ recordingUrl: e.target.value })}
              />
            </label>
          </fieldset>

          <div className="meeting-recaps__form-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || !isMeetingRecapDraftValid(draft)}
              onClick={() => void submitRecap()}
            >
              {t("crm.meetings.recapPublish")}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={resetForm}>
              {t("crm.meetings.recapCancel")}
            </button>
          </div>
          {error ? <p className="meeting-recaps__error">{error}</p> : null}
        </div>
      ) : null}

      {visibleRecaps.length === 0 ? (
        <p className="meeting-recaps__empty">{t("crm.meetings.recapsEmpty")}</p>
      ) : (
        <ul className="meeting-recaps__list">
          {visibleRecaps.map((recap) => (
            <li key={recap.id} className="meeting-recap-card">
              <div className="meeting-recap-card__head">
                <div>
                  <h4 className="meeting-recap-card__title">{recap.title}</h4>
                  {recap.heldAt ? (
                    <p className="meeting-recap-card__date">
                      {t("crm.meetings.recapHeldOn", { date: formatRecapDate(recap.heldAt, locale) })}
                    </p>
                  ) : null}
                </div>
                {canEdit && onDelete ? (
                  <button
                    type="button"
                    className="meeting-recap-card__delete"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(t("crm.meetings.recapDeleteConfirm", { title: recap.title }))) return;
                      void onDelete(recap.id);
                    }}
                  >
                    {t("crm.meetings.recapDelete")}
                  </button>
                ) : null}
              </div>
              <MeetingRecapView
                body={recap.body}
                studentDisplayName={studentDisplayName}
                onOpenActionItems={onOpenActionItems}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
