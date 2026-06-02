import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  downloadResumeBlob,
  generateResumeDocx,
  resumeDownloadFilename,
} from "../../lib/resume/buildResumeDocx";
import {
  createEmptyResumeForm,
  emptyActivity,
  emptyEducation,
  emptyHonor,
  emptyProject,
  emptyWork,
  hasResumeDraftContent,
  loadResumeDraftFromStorage,
  prefillResumeFromForm,
  saveResumeDraftToStorage,
} from "../../lib/resume/resumeForm";
import type { FormState } from "../../types";
import {
  isResumeServerSyncEnabled,
  loadRemoteResumeDraft,
  saveRemoteResumeDraft,
} from "../../lib/resume/supabaseResume";
import type { ResumeFormData } from "../../lib/resume/types";
import "./ResumeBuilder.css";

type Props = {
  form: FormState;
  userEmail?: string | null;
  displayName?: string | null;
  /** Engagement id — used for local cache key and server sync. */
  engagementId: string;
  editorRole?: "student" | "counselor";
  /** @deprecated use engagementId */
  storageKey?: string;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="resume-builder__field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextArea({
  label,
  labelHint,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  labelHint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="resume-builder__field resume-builder__field--full">
      <span className="resume-builder__field-label">
        <span className="resume-builder__field-label-title">{label}</span>
        {labelHint ? <span className="resume-builder__field-label-hint">{labelHint}</span> : null}
      </span>
      <textarea value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function EntryList<T>({
  title,
  entries,
  emptyLabel,
  addLabel,
  renderEntry,
  onAdd,
  defaultOpen = false,
}: {
  title: string;
  entries: T[];
  emptyLabel: string;
  addLabel: string;
  renderEntry: (entry: T, index: number) => ReactNode;
  onAdd: () => void;
  defaultOpen?: boolean;
}) {
  return (
    <details className="resume-builder__section" open={defaultOpen}>
      <summary>{title}</summary>
      {entries.length === 0 ? <p className="resume-builder__empty">{emptyLabel}</p> : null}
      <div className="resume-builder__entries">
        {entries.map((entry, index) => (
          <div key={index} className="resume-builder__entry">
            {renderEntry(entry, index)}
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-secondary btn-sm resume-builder__add" onClick={onAdd}>
        {addLabel}
      </button>
    </details>
  );
}

export function ResumeBuilder({
  form,
  userEmail,
  displayName,
  engagementId,
  editorRole = "student",
  storageKey,
}: Props) {
  const { t } = useLanguage();
  const persistKey = engagementId || storageKey || "";
  const loadKey = persistKey ? `${persistKey}:${editorRole}` : "";
  const formRef = useRef(form);
  formRef.current = form;
  const userEmailRef = useRef(userEmail);
  userEmailRef.current = userEmail;
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;
  const loadedKeyRef = useRef<string | null>(null);
  const lastSavedRef = useRef("");
  const [draft, setDraft] = useState<ResumeFormData>(() => createEmptyResumeForm());
  const [readyToPersist, setReadyToPersist] = useState(false);
  const [loading, setLoading] = useState(Boolean(persistKey));
  const [syncState, setSyncState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!persistKey) {
      const prefilled = prefillResumeFromForm(formRef.current, {
        email: userEmailRef.current,
        displayName: displayNameRef.current,
      });
      setDraft(prefilled);
      setReadyToPersist(true);
      setLoading(false);
      return;
    }

    if (loadedKeyRef.current === loadKey) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setReadyToPersist(false);

    void (async () => {
      const prefillFromProfile = () =>
        prefillResumeFromForm(formRef.current, {
          email: userEmailRef.current,
          displayName: displayNameRef.current,
        });

      try {
        const remote = isResumeServerSyncEnabled()
          ? await loadRemoteResumeDraft(persistKey, editorRole)
          : null;
        if (cancelled) return;

        if (remote && hasResumeDraftContent(remote)) {
          setDraft(remote);
          saveResumeDraftToStorage(persistKey, remote);
          lastSavedRef.current = JSON.stringify(remote);
          loadedKeyRef.current = loadKey;
          setReadyToPersist(true);
          return;
        }

        const local = loadResumeDraftFromStorage(persistKey);
        if (local && hasResumeDraftContent(local)) {
          setDraft(local);
          lastSavedRef.current = JSON.stringify(local);
          loadedKeyRef.current = loadKey;
          if (isResumeServerSyncEnabled()) {
            void saveRemoteResumeDraft(persistKey, local, editorRole).catch(() => {
              /* best-effort migrate local draft to server */
            });
          }
          setReadyToPersist(true);
          return;
        }

        const prefilled = prefillFromProfile();
        setDraft(prefilled);
        lastSavedRef.current = JSON.stringify(prefilled);
        loadedKeyRef.current = loadKey;
        setReadyToPersist(true);
      } catch {
        if (cancelled) return;
        const local = loadResumeDraftFromStorage(persistKey);
        const next =
          local && hasResumeDraftContent(local) ? local : prefillFromProfile();
        setDraft(next);
        lastSavedRef.current = JSON.stringify(next);
        loadedKeyRef.current = loadKey;
        setReadyToPersist(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [persistKey, editorRole, loadKey]);

  useEffect(() => {
    if (!persistKey || !readyToPersist) return;
    saveResumeDraftToStorage(persistKey, draft);

    if (!isResumeServerSyncEnabled()) return;

    const serialized = JSON.stringify(draft);
    if (serialized === lastSavedRef.current) return;

    setSyncState("saving");
    const timer = window.setTimeout(() => {
      void saveRemoteResumeDraft(persistKey, draft, editorRole)
        .then(() => {
          lastSavedRef.current = serialized;
          setSyncState("saved");
        })
        .catch(() => setSyncState("error"));
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draft, persistKey, readyToPersist, editorRole]);

  const patch = useCallback((updater: (prev: ResumeFormData) => ResumeFormData) => {
    setDraft((prev) => updater(prev));
    setError(null);
    setNotice(null);
  }, []);

  const prefill = () => {
    setDraft(prefillResumeFromForm(form, { email: userEmail, displayName }));
    setNotice(t("resume.prefilled"));
  };

  const generate = async () => {
    if (!draft.contact.fullName.trim()) {
      setError(t("resume.errors.nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const blob = await generateResumeDocx(draft);
      downloadResumeBlob(blob, resumeDownloadFilename(draft.contact.fullName));
      setNotice(t("resume.generated"));
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(raw === "resume_template_missing" ? t("resume.errors.templateMissing") : t("resume.errors.generateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const removeAt = <T,>(items: T[], index: number): T[] => items.filter((_, i) => i !== index);

  return (
    <section className="resume-builder" aria-labelledby="resume-builder-title">
      <div className="resume-builder__head">
        <div>
          <p className="resume-builder__kicker">{t("resume.kicker")}</p>
          <h2 id="resume-builder-title">{t("resume.title")}</h2>
          <p className="resume-builder__lead">
            {editorRole === "counselor" ? t("resume.counselorLead") : t("resume.lead")}
          </p>
          {loading ? <p className="resume-builder__sync resume-builder__sync--saving">{t("resume.loading")}</p> : null}
          {!loading && syncState === "saving" ? (
            <p className="resume-builder__sync resume-builder__sync--saving">{t("resume.saving")}</p>
          ) : null}
          {!loading && syncState === "saved" ? (
            <p className="resume-builder__sync resume-builder__sync--saved">{t("resume.saved")}</p>
          ) : null}
          {!loading && syncState === "error" ? (
            <p className="resume-builder__sync resume-builder__sync--error">{t("resume.saveFailed")}</p>
          ) : null}
        </div>
        <div className="resume-builder__head-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={prefill} disabled={busy || loading}>
            {t("resume.prefill")}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void generate()} disabled={busy || loading}>
            {busy ? t("resume.generating") : t("resume.generate")}
          </button>
        </div>
      </div>

      {!loading ? (
      <div className="resume-builder__sections">
        <details className="resume-builder__section" open>
          <summary>{t("resume.sections.contact")}</summary>
          <div className="resume-builder__grid">
            <Field label={t("resume.fields.fullName")} value={draft.contact.fullName} onChange={(v) => patch((d) => ({ ...d, contact: { ...d.contact, fullName: v } }))} />
            <Field label={t("resume.fields.cityState")} value={draft.contact.cityState} onChange={(v) => patch((d) => ({ ...d, contact: { ...d.contact, cityState: v } }))} />
            <Field label={t("resume.fields.phone")} value={draft.contact.phone} onChange={(v) => patch((d) => ({ ...d, contact: { ...d.contact, phone: v } }))} />
            <Field label={t("resume.fields.email")} value={draft.contact.email} onChange={(v) => patch((d) => ({ ...d, contact: { ...d.contact, email: v } }))} />
            <Field label={t("resume.fields.linkedIn")} value={draft.contact.linkedIn} onChange={(v) => patch((d) => ({ ...d, contact: { ...d.contact, linkedIn: v } }))} />
          </div>
        </details>

        <EntryList
          title={t("resume.sections.education")}
          entries={draft.educations}
          emptyLabel={t("resume.listEmpty")}
          addLabel={t("resume.addEducation")}
          defaultOpen
          onAdd={() => patch((d) => ({ ...d, educations: [...d.educations, emptyEducation()] }))}
          renderEntry={(_, index) => (
            <>
              <div className="resume-builder__entry-head">
                <strong>{t("resume.entryLabel", { n: index + 1 })}</strong>
                {draft.educations.length > 1 ? (
                  <button type="button" className="resume-builder__remove" onClick={() => patch((d) => ({ ...d, educations: removeAt(d.educations, index) }))}>
                    {t("resume.removeEntry")}
                  </button>
                ) : null}
              </div>
              <div className="resume-builder__grid">
                <Field label={t("resume.fields.highSchool")} value={draft.educations[index].highSchoolName} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], highSchoolName: v }; return { ...d, educations }; })} />
                <Field label={t("resume.fields.schoolCityState")} value={draft.educations[index].schoolCityState} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], schoolCityState: v }; return { ...d, educations }; })} />
                <Field label={t("resume.fields.graduation")} value={draft.educations[index].graduationMonthYear} placeholder={t("resume.placeholders.graduation")} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], graduationMonthYear: v }; return { ...d, educations }; })} />
                <Field label={t("resume.fields.gpa")} value={draft.educations[index].gpa} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], gpa: v }; return { ...d, educations }; })} />
                <Field label={t("resume.fields.rankNum")} value={draft.educations[index].rankNumerator} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], rankNumerator: v }; return { ...d, educations }; })} />
                <Field label={t("resume.fields.rankDen")} value={draft.educations[index].rankDenominator} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], rankDenominator: v }; return { ...d, educations }; })} />
                <Field label={t("resume.fields.satTotal")} value={draft.educations[index].satTotal} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], satTotal: v }; return { ...d, educations }; })} />
                <Field label={t("resume.fields.satMath")} value={draft.educations[index].satMath} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], satMath: v }; return { ...d, educations }; })} />
                <Field label={t("resume.fields.satEbrw")} value={draft.educations[index].satEbrw} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], satEbrw: v }; return { ...d, educations }; })} />
                <Field label={t("resume.fields.act")} value={draft.educations[index].actScore} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], actScore: v }; return { ...d, educations }; })} />
                <TextArea label={t("resume.fields.apCoursesLine")} value={draft.educations[index].apCoursesLine} placeholder={t("resume.placeholders.apCourses")} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], apCoursesLine: v }; return { ...d, educations }; })} />
                <TextArea label={t("resume.fields.courseworkLine")} value={draft.educations[index].courseworkLine} placeholder={t("resume.placeholders.coursework")} onChange={(v) => patch((d) => { const educations = [...d.educations]; educations[index] = { ...educations[index], courseworkLine: v }; return { ...d, educations }; })} />
              </div>
            </>
          )}
        />

        <EntryList
          title={t("resume.sections.honors")}
          entries={draft.honors}
          emptyLabel={t("resume.listEmpty")}
          addLabel={t("resume.addHonor")}
          onAdd={() => patch((d) => ({ ...d, honors: [...d.honors, emptyHonor()] }))}
          renderEntry={(_, index) => (
            <>
              <div className="resume-builder__entry-head">
                <strong>{t("resume.entryLabel", { n: index + 1 })}</strong>
                <button type="button" className="resume-builder__remove" onClick={() => patch((d) => ({ ...d, honors: removeAt(d.honors, index) }))}>
                  {t("resume.removeEntry")}
                </button>
              </div>
              <div className="resume-builder__grid">
                <Field label={t("resume.fields.awardName")} value={draft.honors[index].name} onChange={(v) => patch((d) => { const honors = [...d.honors]; honors[index] = { ...honors[index], name: v }; return { ...d, honors }; })} />
                <Field label={t("resume.fields.year")} value={draft.honors[index].year} onChange={(v) => patch((d) => { const honors = [...d.honors]; honors[index] = { ...honors[index], year: v }; return { ...d, honors }; })} />
                <Field label={t("resume.fields.issuer")} value={draft.honors[index].issuer} onChange={(v) => patch((d) => { const honors = [...d.honors]; honors[index] = { ...honors[index], issuer: v }; return { ...d, honors }; })} />
                <TextArea label={t("resume.fields.description")} value={draft.honors[index].description} onChange={(v) => patch((d) => { const honors = [...d.honors]; honors[index] = { ...honors[index], description: v }; return { ...d, honors }; })} />
              </div>
            </>
          )}
        />

        <EntryList
          title={t("resume.sections.activities")}
          entries={draft.activities}
          emptyLabel={t("resume.listEmpty")}
          addLabel={t("resume.addActivity")}
          onAdd={() => patch((d) => ({ ...d, activities: [...d.activities, emptyActivity()] }))}
          renderEntry={(_, index) => (
            <>
              <div className="resume-builder__entry-head">
                <strong>{t("resume.entryLabel", { n: index + 1 })}</strong>
                <button type="button" className="resume-builder__remove" onClick={() => patch((d) => ({ ...d, activities: removeAt(d.activities, index) }))}>
                  {t("resume.removeEntry")}
                </button>
              </div>
              <div className="resume-builder__grid">
                <Field label={t("resume.fields.organization")} value={draft.activities[index].organization} onChange={(v) => patch((d) => { const activities = [...d.activities]; activities[index] = { ...activities[index], organization: v }; return { ...d, activities }; })} />
                <Field label={t("resume.fields.dates")} value={draft.activities[index].dates} placeholder={t("resume.placeholders.activityDates")} onChange={(v) => patch((d) => { const activities = [...d.activities]; activities[index] = { ...activities[index], dates: v }; return { ...d, activities }; })} />
                <Field label={t("resume.fields.role")} value={draft.activities[index].role} onChange={(v) => patch((d) => { const activities = [...d.activities]; activities[index] = { ...activities[index], role: v }; return { ...d, activities }; })} />
                <Field label={t("resume.fields.hoursPerWeek")} value={draft.activities[index].hoursPerWeek} onChange={(v) => patch((d) => { const activities = [...d.activities]; activities[index] = { ...activities[index], hoursPerWeek: v }; return { ...d, activities }; })} />
                <Field label={t("resume.fields.weeksPerYear")} value={draft.activities[index].weeksPerYear} onChange={(v) => patch((d) => { const activities = [...d.activities]; activities[index] = { ...activities[index], weeksPerYear: v }; return { ...d, activities }; })} />
                <TextArea
                  label={t("resume.fields.entryDescription")}
                  labelHint={t("resume.fields.entryDescriptionHint")}
                  value={draft.activities[index].description}
                  onChange={(v) =>
                    patch((d) => {
                      const activities = [...d.activities];
                      activities[index] = { ...activities[index], description: v };
                      return { ...d, activities };
                    })
                  }
                  rows={4}
                />
              </div>
            </>
          )}
        />

        <EntryList
          title={t("resume.sections.work")}
          entries={draft.works}
          emptyLabel={t("resume.listEmpty")}
          addLabel={t("resume.addWork")}
          onAdd={() => patch((d) => ({ ...d, works: [...d.works, emptyWork()] }))}
          renderEntry={(_, index) => (
            <>
              <div className="resume-builder__entry-head">
                <strong>{t("resume.entryLabel", { n: index + 1 })}</strong>
                <button type="button" className="resume-builder__remove" onClick={() => patch((d) => ({ ...d, works: removeAt(d.works, index) }))}>
                  {t("resume.removeEntry")}
                </button>
              </div>
              <div className="resume-builder__grid">
                <Field label={t("resume.fields.company")} value={draft.works[index].company} onChange={(v) => patch((d) => { const works = [...d.works]; works[index] = { ...works[index], company: v }; return { ...d, works }; })} />
                <Field label={t("resume.fields.location")} value={draft.works[index].location} onChange={(v) => patch((d) => { const works = [...d.works]; works[index] = { ...works[index], location: v }; return { ...d, works }; })} />
                <Field label={t("resume.fields.role")} value={draft.works[index].title} onChange={(v) => patch((d) => { const works = [...d.works]; works[index] = { ...works[index], title: v }; return { ...d, works }; })} />
                <Field label={t("resume.fields.dates")} value={draft.works[index].dates} placeholder={t("resume.placeholders.workDates")} onChange={(v) => patch((d) => { const works = [...d.works]; works[index] = { ...works[index], dates: v }; return { ...d, works }; })} />
                <TextArea
                  label={t("resume.fields.entryDescription")}
                  labelHint={t("resume.fields.entryDescriptionHint")}
                  value={draft.works[index].description}
                  onChange={(v) =>
                    patch((d) => {
                      const works = [...d.works];
                      works[index] = { ...works[index], description: v };
                      return { ...d, works };
                    })
                  }
                  rows={4}
                />
              </div>
            </>
          )}
        />

        <EntryList
          title={t("resume.sections.project")}
          entries={draft.projects}
          emptyLabel={t("resume.listEmpty")}
          addLabel={t("resume.addProject")}
          onAdd={() => patch((d) => ({ ...d, projects: [...d.projects, emptyProject()] }))}
          renderEntry={(_, index) => (
            <>
              <div className="resume-builder__entry-head">
                <strong>{t("resume.entryLabel", { n: index + 1 })}</strong>
                <button type="button" className="resume-builder__remove" onClick={() => patch((d) => ({ ...d, projects: removeAt(d.projects, index) }))}>
                  {t("resume.removeEntry")}
                </button>
              </div>
              <div className="resume-builder__grid">
                <Field label={t("resume.fields.projectTitle")} value={draft.projects[index].title} onChange={(v) => patch((d) => { const projects = [...d.projects]; projects[index] = { ...projects[index], title: v }; return { ...d, projects }; })} />
                <Field label={t("resume.fields.year")} value={draft.projects[index].year} onChange={(v) => patch((d) => { const projects = [...d.projects]; projects[index] = { ...projects[index], year: v }; return { ...d, projects }; })} />
                <Field label={t("resume.fields.supervisor")} value={draft.projects[index].supervisor} onChange={(v) => patch((d) => { const projects = [...d.projects]; projects[index] = { ...projects[index], supervisor: v }; return { ...d, projects }; })} />
                <TextArea
                  label={t("resume.fields.entryDescription")}
                  labelHint={t("resume.fields.entryDescriptionHint")}
                  value={draft.projects[index].description}
                  onChange={(v) =>
                    patch((d) => {
                      const projects = [...d.projects];
                      projects[index] = { ...projects[index], description: v };
                      return { ...d, projects };
                    })
                  }
                  rows={4}
                />
              </div>
            </>
          )}
        />

        <details className="resume-builder__section">
          <summary>{t("resume.sections.skills")}</summary>
          <div className="resume-builder__grid">
            <TextArea label={t("resume.fields.technicalSkills")} value={draft.skills.technical} onChange={(v) => patch((d) => ({ ...d, skills: { ...d.skills, technical: v } }))} />
            <TextArea label={t("resume.fields.languages")} value={draft.skills.languages} onChange={(v) => patch((d) => ({ ...d, skills: { ...d.skills, languages: v } }))} />
            <TextArea label={t("resume.fields.interests")} value={draft.skills.interests} onChange={(v) => patch((d) => ({ ...d, skills: { ...d.skills, interests: v } }))} />
          </div>
        </details>
      </div>
      ) : null}

      <div className="resume-builder__footer">
        <button type="button" className="btn btn-primary" onClick={() => void generate()} disabled={busy || loading}>
          {busy ? t("resume.generating") : t("resume.generateDocx")}
        </button>
        {notice ? <p className="resume-builder__notice">{notice}</p> : null}
        {error ? <p className="resume-builder__error">{error}</p> : null}
      </div>
    </section>
  );
}
