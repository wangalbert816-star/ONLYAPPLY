import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SupplementaryNote } from "../types";
import { useLanguage } from "../i18n/LanguageContext";
import { buildGapTasks, stableGapsSignature } from "../lib/gapTaskMeta";
import { gapDimensionHint } from "../lib/gapDimensionHints";
import { REPORT_CONTENT_LOCALE } from "../lib/reportContentLocale";
import "./InformationGapsInteractive.css";

const STORAGE_PREFIX = "college_strategy_gaps_completion_v1_";

type Completion = { value: string; updatedAt: number };

function loadCompletions(key: string, validIds: Set<string>): Record<string, Completion> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, Completion> = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!validIds.has(id)) continue;
      if (v && typeof v === "object" && typeof (v as Completion).value === "string") {
        const c = v as Completion;
        out[id] = { value: c.value, updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : Date.now() };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveCompletions(key: string, data: Record<string, Completion>) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function InformationGapsInteractive({
  gaps,
  onRegenerate,
  isRegenerating,
  embedded = false,
}: {
  gaps: string[];
  onRegenerate?: (notes: SupplementaryNote[]) => Promise<void>;
  isRegenerating?: boolean;
  embedded?: boolean;
}) {
  const { t } = useLanguage();
  const reportLocale = REPORT_CONTENT_LOCALE;
  const tasks = useMemo(() => buildGapTasks(gaps, reportLocale), [gaps, reportLocale]);
  const validIds = useMemo(() => new Set(tasks.map((x) => x.id)), [tasks]);
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}${stableGapsSignature(gaps)}`,
    [gaps],
  );

  const [completions, setCompletions] = useState<Record<string, Completion>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    setCompletions(loadCompletions(storageKey, validIds));
  }, [storageKey, validIds]);

  const openTask = tasks.find((x) => x.id === openId) ?? null;

  const completedCount = useMemo(
    () => tasks.filter((task) => (completions[task.id]?.value || "").trim().length > 0).length,
    [tasks, completions],
  );
  const progressPct = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const hasTasks = tasks.length > 0;

  const closeModal = useCallback(() => {
    setOpenId(null);
    setDraft("");
    setModalError(null);
  }, []);

  useEffect(() => {
    if (!openId) return;
    const task = tasks.find((x) => x.id === openId);
    setDraft((task && completions[task.id]?.value) || "");
    setModalError(null);
    const id = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [openId, tasks, completions]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, closeModal]);

  function persist(next: Record<string, Completion>) {
    setCompletions(next);
    saveCompletions(storageKey, next);
  }

  function handleSave() {
    if (!openTask || isRegenerating) return;
    const v = draft.trim();
    const minLen = 3;
    if (v.length < minLen) {
      setModalError(t("report.gapsInteractive.minLenErr", { n: minLen }));
      return;
    }
    const next = {
      ...completions,
      [openTask.id]: { value: v, updatedAt: Date.now() },
    };
    persist(next);
    closeModal();
  }

  const minFilledBeforeRegen = tasks.length >= 2 ? 2 : 1;
  const canRunRegen =
    !!onRegenerate && completedCount >= minFilledBeforeRegen && !isRegenerating;

  function buildNotesFromCompletions(): SupplementaryNote[] {
    return tasks
      .map((task) => {
        const text = (completions[task.id]?.value || "").trim();
        if (!text) return null;
        return { topic: task.title, text };
      })
      .filter((x): x is SupplementaryNote => x !== null);
  }

  async function handleRegenerateClick() {
    if (!onRegenerate || !canRunRegen) return;
    const notes = buildNotesFromCompletions();
    if (notes.length === 0) return;
    await onRegenerate(notes);
  }

  function handleBackdropMouseDown(e: React.MouseEvent) {
    if (e.target === backdropRef.current) closeModal();
  }

  const modal =
    openTask &&
    createPortal(
      <div
        ref={backdropRef}
        className="gaps-modal-backdrop"
        role="presentation"
        onMouseDown={handleBackdropMouseDown}
      >
        <div
          className="gaps-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h3 className="gaps-modal__title" id={titleId}>
            {t("report.gapsInteractive.modalTitle", { title: openTask.title })}
          </h3>
          <p className="gaps-modal__meta">{t("report.gapsInteractive.modalMeta")}</p>
          <div>
            <span className="gaps-modal__label">{t("report.gapsInteractive.rawContext")}</span>
            <p className="gaps-card__preview" style={{ maxHeight: "none" }}>
              {openTask.rawLine}
            </p>
          </div>
          <div>
            <label className="gaps-modal__label" htmlFor="gaps-modal-input">
              {t("report.gapsInteractive.inputLabel")}
            </label>
            <textarea
              id="gaps-modal-input"
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setModalError(null);
              }}
              placeholder={t("report.gapsInteractive.placeholder")}
              rows={5}
            />
            {modalError && <p className="gaps-modal__error">{modalError}</p>}
          </div>
          <div className="gaps-modal__actions">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              {t("report.gapsInteractive.cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!!isRegenerating}>
              {t("report.gapsInteractive.save")}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  const Tag = embedded ? "div" : "section";
  const panelClass = embedded
    ? "gaps-panel gaps-panel--embedded card report-block"
    : "card report-block gaps-panel";

  return (
    <Tag
      className={panelClass}
      id="report-section-gaps"
      aria-labelledby={embedded ? undefined : "gaps-interactive-title"}
    >
      {!embedded && <h2 id="gaps-interactive-title">{t("report.gapsTitle")}</h2>}
      {hasTasks ? (
        <>
          <p className="gaps-panel__intro">{t("report.gapsInteractive.intro")}</p>

          <div className="gaps-progress" aria-label={t("report.gapsInteractive.ariaProgress")}>
            <div className="gaps-progress__row">
              <span className="gaps-progress__label">{t("report.gapsInteractive.completeness")}</span>
              <span className="gaps-progress__value">{t("report.gapsInteractive.percent", { n: progressPct })}</span>
            </div>
            <div className="gaps-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
              <div className="gaps-progress__fill" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="gaps-progress__hint">{t("report.gapsInteractive.progressHint")}</p>
          </div>

          {progressPct === 100 && <p className="gaps-all-done">{t("report.gapsInteractive.allDone")}</p>}

          <div className="gaps-list">
            {tasks.map((task) => {
              const filled = (completions[task.id]?.value || "").trim().length > 0;
              return (
                <article key={task.id} className={`gaps-card${filled ? " gaps-card--done" : ""}`}>
                  <div className="gaps-card__top">
                    <h3 className="gaps-card__title">{task.title}</h3>
                    <span className={`gaps-card__status${filled ? " gaps-card__status--done" : " gaps-card__status--todo"}`}>
                      {filled ? t("report.gapsInteractive.statusDone") : t("report.gapsInteractive.statusTodo")}
                    </span>
                  </div>
                  <p className="gaps-card__why">
                    <strong>{t("report.gapsInteractive.whyTitle")}</strong>
                    {task.whyNeeded}
                  </p>
                  <p className="gaps-card__impact">
                    <strong>{t("report.gapsInteractive.impactTitle")}</strong>
                    {task.impactIfMissing}
                  </p>
                  {gapDimensionHint(task.rawLine, reportLocale) && (
                    <p className="gaps-card__dimension-hint">{gapDimensionHint(task.rawLine, reportLocale)}</p>
                  )}
                  {!filled && (
                    <p className="gaps-card__preview">
                      <strong>{t("report.gapsInteractive.modelNote")}</strong>
                      {task.rawLine}
                    </p>
                  )}
                  {filled && (
                    <p className="gaps-card__preview">
                      <strong>{t("report.gapsInteractive.yourAnswer")}</strong>
                      {completions[task.id]!.value}
                    </p>
                  )}
                  <div className="gaps-card__actions" data-no-pdf>
                    <button
                      type="button"
                      className={`gaps-card__btn${filled ? " gaps-card__btn--ghost" : " gaps-card__btn--primary"}`}
                      onClick={() => setOpenId(task.id)}
                      disabled={!!isRegenerating}
                    >
                      {filled ? t("report.gapsInteractive.edit") : t("report.gapsInteractive.cta")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {onRegenerate && (
            <div className="gaps-regen-block" data-no-pdf>
              <button
                type="button"
                className="btn btn-primary gaps-regen-btn"
                onClick={() => void handleRegenerateClick()}
                disabled={!canRunRegen}
              >
                {t("report.gapsInteractive.regenCta")}
              </button>
              {completedCount > 0 && completedCount < minFilledBeforeRegen && tasks.length >= 2 && (
                <p className="gaps-regen-blocked">{t("report.gapsInteractive.regenBlocked", { need: minFilledBeforeRegen, have: completedCount })}</p>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="gaps-panel__empty">{t("report.gapsInteractive.emptyIntro")}</p>
      )}

      {modal}
    </Tag>
  );
}
