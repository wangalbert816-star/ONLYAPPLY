import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  adminErrorMessage,
  createAdminCounselor,
  createAdminEngagement,
  fetchAdminSession,
  listAdminCounselors,
  listAdminEngagements,
  listAdminGroupMessages,
  lookupAdminStudent,
  patchAdminCounselor,
  patchAdminEngagement,
  sendAdminGroupMessage,
  type AdminCaseMessage,
  type AdminCounselor,
  type AdminEngagement,
  type StudentLookupResult,
} from "../../lib/admin/crmAdminApi";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { LanguageToggle } from "../../i18n/LanguageToggle";
import { BrandLogo } from "../BrandLogo";
import { AdminLibraryPanel } from "./AdminLibraryPanel";
import { AdminRoadmapPanel } from "./AdminRoadmapPanel";
import { AdminEvalPanel } from "./AdminEvalPanel";
import "./AdminPortal.css";

type Props = {
  onBack: () => void;
};

type TabId = "counselors" | "engagements" | "groupChat" | "library" | "roadmap" | "eval";

const PHASES = ["onboarding", "planning", "essays", "applications", "done"] as const;
const STATUSES = ["active", "paused", "completed"] as const;

function formatWhen(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function engagementStatusLabel(status: string, t: (key: string) => string) {
  const key = `admin.engagements.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

type CounselorTeamEntry = { id: string; name: string; isPrimary: boolean };

function counselorTeamEntries(row: AdminEngagement): CounselorTeamEntry[] {
  const ids = row.counselorIds?.length ? row.counselorIds : [row.counselorId].filter(Boolean);
  const names = row.counselorNames?.length
    ? row.counselorNames
    : row.counselorName
      ? [row.counselorName]
      : [];
  return ids.map((id, idx) => ({
    id,
    name: names[idx] ?? row.counselorEmail ?? id.slice(0, 8),
    isPrimary: id === row.counselorId,
  }));
}

function AdminLangBar() {
  return (
    <div className="admin-portal__lang">
      <LanguageToggle />
    </div>
  );
}

export function AdminPortal({ onBack }: Props) {
  const { t, locale } = useLanguage();
  const { user, session, configured, loading: authLoading, signInWithGoogle, signInWithPassword } = useAuth();
  const [tab, setTab] = useState<TabId>("engagements");
  const [gate, setGate] = useState<"idle" | "loading" | "ok" | "forbidden" | "misconfigured">("idle");
  const [misconfigReason, setMisconfigReason] = useState<"service_role" | "admin_emails" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [counselors, setCounselors] = useState<AdminCounselor[]>([]);
  const [engagements, setEngagements] = useState<AdminEngagement[]>([]);
  const [busy, setBusy] = useState(false);
  const [groupChatEngagementId, setGroupChatEngagementId] = useState("");

  const token = session?.access_token ?? "";

  const refreshAll = useCallback(async () => {
    if (!token) return;
    const [c, e] = await Promise.all([listAdminCounselors(token), listAdminEngagements(token)]);
    setCounselors(c.counselors);
    setEngagements(e.engagements);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function verify() {
      if (authLoading) return;
      if (!user || !token) {
        if (!cancelled) setGate("idle");
        return;
      }
      setGate("loading");
      try {
        await fetchAdminSession(token);
        if (cancelled) return;
        setGate("ok");
        await refreshAll();
      } catch (e) {
        if (cancelled) return;
        const code = (e as Error & { code?: string }).code;
        if (code === "supabase_admin_missing") {
          setMisconfigReason("service_role");
          setGate("misconfigured");
        } else if (code === "crm_admin_not_configured") {
          setMisconfigReason("admin_emails");
          setGate("misconfigured");
        } else {
          setGate("forbidden");
        }
      }
    }
    void verify();
    return () => {
      cancelled = true;
    };
  }, [user, token, authLoading, refreshAll]);

  useEffect(() => {
    document.documentElement.setAttribute("data-hide-brand-wall", "");
    return () => {
      document.documentElement.removeAttribute("data-hide-brand-wall");
    };
  }, []);

  if (!configured) {
    return (
      <div className="admin-portal admin-portal--center">
        <AdminLangBar />
        <p>{t("crm.counselorAuth.notConfigured")}</p>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          {t("admin.back")}
        </button>
      </div>
    );
  }

  if (authLoading || (user && gate === "loading")) {
    return (
      <div className="admin-portal admin-portal--center">
        <AdminLangBar />
        <p>{t("admin.loading")}</p>
      </div>
    );
  }

  if (!user) {
    return <AdminSignIn onBack={onBack} signInWithGoogle={signInWithGoogle} signInWithPassword={signInWithPassword} />;
  }

  if (gate === "misconfigured") {
    const detail =
      misconfigReason === "service_role"
        ? t("admin.missingServiceRole")
        : misconfigReason === "admin_emails"
          ? t("admin.missingAdminEmails")
          : t("admin.notConfigured");
    return (
      <div className="admin-portal admin-portal--center">
        <AdminLangBar />
        <p>{detail}</p>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          {t("admin.back")}
        </button>
      </div>
    );
  }

  if (gate === "forbidden") {
    return (
      <div className="admin-portal admin-portal--center">
        <AdminLangBar />
        <p>{t("admin.forbidden")}</p>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          {t("admin.back")}
        </button>
      </div>
    );
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await refreshAll();
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      setNotice(adminErrorMessage(code, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-portal">
      <header className="admin-portal__head">
        <BrandLogo />
        <div>
          <p className="admin-portal__kicker">{t("admin.kicker")}</p>
          <h1>{t("admin.title")}</h1>
          <p className="admin-portal__lead">{t("admin.lead")}</p>
          <p className="admin-portal__email">{user.email}</p>
        </div>
        <div className="admin-portal__head-actions">
          <LanguageToggle />
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void refreshAll()}>
            {t("admin.refresh")}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            {t("admin.back")}
          </button>
        </div>
      </header>

      {notice ? <p className="admin-portal__notice">{notice}</p> : null}

      <nav className="admin-portal__tabs" aria-label={t("admin.title")}>
        <button type="button" className={tab === "engagements" ? "is-active" : undefined} onClick={() => setTab("engagements")}>
          {t("admin.tabs.engagements")}
        </button>
        <button type="button" className={tab === "counselors" ? "is-active" : undefined} onClick={() => setTab("counselors")}>
          {t("admin.tabs.counselors")}
        </button>
        <button type="button" className={tab === "groupChat" ? "is-active" : undefined} onClick={() => setTab("groupChat")}>
          {t("admin.groupChat.title")}
        </button>
        <button type="button" className={tab === "library" ? "is-active" : undefined} onClick={() => setTab("library")}>
          {t("admin.tabs.library")}
        </button>
        <button type="button" className={tab === "roadmap" ? "is-active" : undefined} onClick={() => setTab("roadmap")}>
          {t("admin.tabs.roadmap")}
        </button>
        <button type="button" className={tab === "eval" ? "is-active" : undefined} onClick={() => setTab("eval")}>
          {t("admin.tabs.eval")}
        </button>
      </nav>

      {tab === "engagements" ? (
        <AdminEngagementsPanel
          t={t}
          locale={locale}
          busy={busy}
          counselors={counselors.filter((c) => c.active)}
          allCounselors={counselors}
          engagements={engagements}
          token={token}
          onRun={runAction}
          onGroupChatError={(code) => setNotice(adminErrorMessage(code, t))}
        />
      ) : tab === "groupChat" ? (
        <AdminGroupChatPanel
          t={t}
          locale={locale}
          busy={busy}
          token={token}
          engagements={engagements}
          engagementId={groupChatEngagementId}
          onEngagementChange={setGroupChatEngagementId}
          onError={(code) => setNotice(adminErrorMessage(code, t))}
        />
      ) : tab === "library" ? (
        <AdminLibraryPanel token={token} busy={busy} onRun={runAction} />
      ) : tab === "roadmap" ? (
        <AdminRoadmapPanel token={token} busy={busy} onRun={runAction} />
      ) : tab === "eval" ? (
        <AdminEvalPanel token={token} busy={busy} onRun={runAction} />
      ) : (
        <AdminCounselorsPanel t={t} locale={locale} busy={busy} counselors={counselors} token={token} onRun={runAction} />
      )}
    </div>
  );
}

function AdminSignIn({
  onBack,
  signInWithGoogle,
  signInWithPassword,
}: {
  onBack: () => void;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
}) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="admin-portal admin-portal--center">
      <AdminLangBar />
      <div className="admin-portal__signin">
        <h1>{t("admin.title")}</h1>
        <p>{t("admin.signInRequired")}</p>
        {err ? <p className="admin-portal__notice">{err}</p> : null}
        <label>
          {t("crm.counselorAuth.email")}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label>
          {t("crm.counselorAuth.password")}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <div className="admin-portal__signin-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !email || !password}
            onClick={() => {
              setBusy(true);
              setErr(null);
              void signInWithPassword(email, password).then((r) => {
                setBusy(false);
                if (r.error) setErr(r.error);
              });
            }}
          >
            {t("crm.counselorAuth.signIn")}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void signInWithGoogle().then((r) => {
                setBusy(false);
                if (r.error) setErr(r.error);
              });
            }}
          >
            {t("auth.google")}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            {t("admin.back")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminCounselorsPanel({
  t,
  locale,
  busy,
  counselors,
  token,
  onRun,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: "zh" | "en";
  busy: boolean;
  counselors: AdminCounselor[];
  token: string;
  onRun: (action: () => Promise<void>) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [passwordEditId, setPasswordEditId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [profileEditId, setProfileEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCalendlyUrl, setEditCalendlyUrl] = useState("");
  const [editMeetingUrl, setEditMeetingUrl] = useState("");

  const passwordValid = password.trim().length >= 6;
  const resetPasswordValid = resetPassword.trim().length >= 6;
  const profileValid = editName.trim().length > 0 && editTitle.trim().length > 0;

  const startProfileEdit = (c: AdminCounselor) => {
    setPasswordEditId(null);
    setResetPassword("");
    setProfileEditId(c.id);
    setEditName(c.name);
    setEditTitle(c.title);
    setEditCalendlyUrl(c.calendlyUrl ?? "");
    setEditMeetingUrl(c.meetingUrl ?? "");
  };

  const cancelProfileEdit = () => {
    setProfileEditId(null);
    setEditName("");
    setEditTitle("");
    setEditCalendlyUrl("");
    setEditMeetingUrl("");
  };

  return (
    <div className="admin-portal__grid">
      <section className="admin-portal__panel">
        <h2>{t("admin.counselors.addTitle")}</h2>
        <div className="admin-portal__form">
          <label>
            {t("admin.counselors.email")}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </label>
          <label>
            {t("admin.counselors.name")}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            {t("admin.counselors.title")}
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            {t("admin.counselors.password")}
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
            />
            <span className="admin-portal__hint">{t("admin.counselors.passwordHint")}</span>
          </label>
          <label>
            {t("admin.counselors.meetingUrl")}
            <input
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/..."
            />
          </label>
          <label>
            {t("admin.counselors.calendly")}
            <input value={calendlyUrl} onChange={(e) => setCalendlyUrl(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !email || !name || !title || !passwordValid}
            onClick={() =>
              void onRun(async () => {
                await createAdminCounselor(token, {
                  email,
                  name,
                  title,
                  password: password.trim(),
                  calendlyUrl: calendlyUrl || undefined,
                  meetingUrl: meetingUrl || undefined,
                });
                setEmail("");
                setName("");
                setTitle("");
                setPassword("");
                setCalendlyUrl("");
                setMeetingUrl("");
              })
            }
          >
            {busy ? t("admin.counselors.adding") : t("admin.counselors.add")}
          </button>
        </div>
      </section>

      <section className="admin-portal__panel admin-portal__panel--wide">
        <h2>{t("admin.counselors.listTitle")}</h2>
        {counselors.length === 0 ? (
          <p className="admin-portal__muted">{t("admin.counselors.empty")}</p>
        ) : (
          <div className="admin-portal__table-wrap">
            <table className="admin-portal__table">
              <thead>
                <tr>
                  <th>{t("admin.counselors.name")}</th>
                  <th>{t("admin.counselors.email")}</th>
                  <th>{t("admin.counselors.title")}</th>
                  <th>{t("admin.counselors.meetingUrlCol")}</th>
                  <th>{t("admin.counselors.calendly")}</th>
                  <th>{t("admin.counselors.colAuth")}</th>
                  <th>{t("admin.engagements.colStatus")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {counselors.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {profileEditId === c.id ? (
                        <input
                          className="admin-portal__table-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      ) : (
                        localizeCrmText(c.name, locale, t)
                      )}
                    </td>
                    <td>{c.email}</td>
                    <td>
                      {profileEditId === c.id ? (
                        <input
                          className="admin-portal__table-input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      ) : (
                        localizeCrmText(c.title, locale, t)
                      )}
                    </td>
                    <td>
                      {profileEditId === c.id ? (
                        <input
                          className="admin-portal__table-input"
                          value={editMeetingUrl}
                          onChange={(e) => setEditMeetingUrl(e.target.value)}
                          placeholder="https://meet.google.com/..."
                        />
                      ) : c.meetingUrl ? (
                        <span className="admin-portal__muted" title={c.meetingUrl}>
                          Meet ✓
                        </span>
                      ) : (
                        <span className="admin-portal__muted">—</span>
                      )}
                    </td>
                    <td>
                      {profileEditId === c.id ? (
                        <input
                          className="admin-portal__table-input"
                          value={editCalendlyUrl}
                          onChange={(e) => setEditCalendlyUrl(e.target.value)}
                          placeholder="https://calendly.com/..."
                        />
                      ) : c.calendlyUrl ? (
                        <span className="admin-portal__muted" title={c.calendlyUrl}>
                          Calendly ✓
                        </span>
                      ) : (
                        <span className="admin-portal__muted">—</span>
                      )}
                    </td>
                    <td>{c.userId ? t("admin.counselors.authLinked") : t("admin.counselors.authMissing")}</td>
                    <td>{c.active ? t("admin.counselors.active") : t("admin.counselors.inactive")}</td>
                    <td className="admin-portal__row-actions">
                      {profileEditId === c.id ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busy || !profileValid}
                            onClick={() =>
                              void onRun(async () => {
                                await patchAdminCounselor(token, c.id, {
                                  name: editName.trim(),
                                  title: editTitle.trim(),
                                  calendlyUrl: editCalendlyUrl.trim(),
                                  meetingUrl: editMeetingUrl.trim(),
                                });
                                cancelProfileEdit();
                              })
                            }
                          >
                            {t("admin.engagements.edit")}
                          </button>
                          <button type="button" className="btn btn-secondary" disabled={busy} onClick={cancelProfileEdit}>
                            {t("admin.counselors.cancel")}
                          </button>
                        </>
                      ) : passwordEditId === c.id ? (
                        <div className="admin-portal__inline-password">
                          <input
                            type="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder={t("admin.counselors.password")}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busy || !resetPasswordValid || !c.email}
                            onClick={() =>
                              void onRun(async () => {
                                await patchAdminCounselor(token, c.id, {
                                  password: resetPassword.trim(),
                                  email: c.email ?? undefined,
                                });
                                setPasswordEditId(null);
                                setResetPassword("");
                              })
                            }
                          >
                            {busy ? t("admin.counselors.settingPassword") : t("admin.counselors.savePassword")}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busy}
                            onClick={() => {
                              setPasswordEditId(null);
                              setResetPassword("");
                            }}
                          >
                            {t("admin.counselors.cancel")}
                          </button>
                        </div>
                      ) : (
                        <>
                          {!c.userId && c.email ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={busy}
                              onClick={() =>
                                void onRun(async () => {
                                  await patchAdminCounselor(token, c.id, { linkAuth: true, email: c.email ?? undefined });
                                })
                              }
                            >
                              {t("admin.counselors.linkAuth")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busy}
                            onClick={() => startProfileEdit(c)}
                          >
                            {t("admin.counselors.editProfile")}
                          </button>
                          {c.email ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={busy}
                              onClick={() => {
                                setProfileEditId(null);
                                setPasswordEditId(c.id);
                                setResetPassword("");
                              }}
                            >
                              {t("admin.counselors.setPassword")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busy}
                            onClick={() =>
                              void onRun(async () => {
                                await patchAdminCounselor(token, c.id, { active: !c.active });
                              })
                            }
                          >
                            {c.active ? t("admin.counselors.inactive") : t("admin.counselors.active")}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AdminEngagementsPanel({
  t,
  locale,
  busy,
  counselors,
  allCounselors,
  engagements,
  token,
  onRun,
  onGroupChatError,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: "zh" | "en";
  busy: boolean;
  counselors: AdminCounselor[];
  allCounselors: AdminCounselor[];
  engagements: AdminEngagement[];
  token: string;
  onRun: (action: () => Promise<void>) => Promise<void>;
  onGroupChatError: (code?: string) => void;
}) {
  const [studentEmail, setStudentEmail] = useState("");
  const [lookup, setLookup] = useState<StudentLookupResult | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [createPlaceholder, setCreatePlaceholder] = useState(true);
  const [placeholderLocale, setPlaceholderLocale] = useState<"en" | "zh">("en");
  const [counselorId, setCounselorId] = useState("");
  const [phase, setPhase] = useState<(typeof PHASES)[number]>("planning");
  const [planLabel, setPlanLabel] = useState("");
  const [nextMeetingLabel, setNextMeetingLabel] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editCounselorId, setEditCounselorId] = useState("");
  const [addCollaboratorIdByEngagement, setAddCollaboratorIdByEngagement] = useState<Record<string, string>>({});
  const [editStatus, setEditStatus] = useState<(typeof STATUSES)[number]>("active");
  const [editPhase, setEditPhase] = useState<(typeof PHASES)[number]>("planning");
  const [expandedGroupChatId, setExpandedGroupChatId] = useState<string | null>(null);
  const counselorSelectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!counselorId && counselors[0]) setCounselorId(counselors[0].id);
  }, [counselors, counselorId]);

  return (
    <div className="admin-portal__stack">
      <section className="admin-portal__panel">
        <h2>{t("admin.engagements.createTitle")}</h2>
        <div className="admin-portal__form admin-portal__form--inline">
          <label>
            {t("admin.engagements.studentEmail")}
            <input value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} type="email" />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || !studentEmail.trim()}
            onClick={() =>
              void onRun(async () => {
                const result = await lookupAdminStudent(token, studentEmail.trim());
                setLookup(result);
                if (result.applications[0]) setApplicationId(result.applications[0].id);
                else setApplicationId("");
                if (result.applications[0]?.locale === "zh" || result.applications[0]?.locale === "en") {
                  setPlaceholderLocale(result.applications[0].locale);
                }
              })
            }
          >
            {t("admin.engagements.lookup")}
          </button>
        </div>
        {lookup ? (
          <p className="admin-portal__muted">
            {lookup.found
              ? t("admin.engagements.lookupFound", { n: lookup.applications.length })
              : t("admin.engagements.lookupNotFound")}
          </p>
        ) : null}
        <div className="admin-portal__form">
          <label>
            {t("admin.engagements.application")}
            <select
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              disabled={!lookup?.applications.length}
            >
              <option value="">{t("admin.engagements.noApplications")}</option>
              {lookup?.applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {localizeCrmText(app.title, locale, t)} ({app.locale})
                </option>
              ))}
            </select>
          </label>
          <label className="admin-portal__check">
            <input
              type="checkbox"
              checked={createPlaceholder}
              onChange={(e) => setCreatePlaceholder(e.target.checked)}
            />
            {t("admin.engagements.createPlaceholder")}
          </label>
          <label>
            {t("admin.engagements.placeholderLocale")}
            <select value={placeholderLocale} onChange={(e) => setPlaceholderLocale(e.target.value as "en" | "zh")}>
              <option value="en">{t("lang.en")}</option>
              <option value="zh">{t("lang.zh")}</option>
            </select>
          </label>
          <label>
            {t("admin.engagements.counselor")}
            <select value={counselorId} onChange={(e) => setCounselorId(e.target.value)}>
              {counselors.map((c) => (
                <option key={c.id} value={c.id}>
                  {localizeCrmText(c.name, locale, t)} ({c.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("admin.engagements.phase")}
            <select value={phase} onChange={(e) => setPhase(e.target.value as (typeof PHASES)[number])}>
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {t(`crm.phase.${p}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("admin.engagements.planLabel")}
            <input value={planLabel} onChange={(e) => setPlanLabel(e.target.value)} />
          </label>
          <label>
            {t("admin.engagements.nextMeeting")}
            <input value={nextMeetingLabel} onChange={(e) => setNextMeetingLabel(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !studentEmail.trim() || !counselorId}
            onClick={() =>
              void onRun(async () => {
                await createAdminEngagement(token, {
                  studentEmail: studentEmail.trim(),
                  counselorId,
                  applicationId: applicationId || null,
                  createPlaceholderApplication: createPlaceholder,
                  placeholderLocale,
                  phase,
                  planLabel: planLabel || undefined,
                  nextMeetingLabel: nextMeetingLabel || undefined,
                });
              })
            }
          >
            {busy ? t("admin.engagements.creating") : t("admin.engagements.create")}
          </button>
        </div>
      </section>

      <section className="admin-portal__panel">
        <h2>{t("admin.engagements.listTitle")}</h2>
        {engagements.length === 0 ? (
          <p className="admin-portal__muted">{t("admin.engagements.empty")}</p>
        ) : (
          <div className="admin-portal__table-wrap">
            <table className="admin-portal__table">
              <thead>
                <tr>
                  <th>{t("admin.engagements.colStudent")}</th>
                  <th>{t("admin.engagements.colCounselor")}</th>
                  <th>{t("admin.engagements.colApp")}</th>
                  <th>{t("admin.engagements.colStatus")}</th>
                  <th>{t("admin.engagements.colPhase")}</th>
                  <th>{t("admin.engagements.colUpdated")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {engagements.map((row) => (
                  <Fragment key={row.id}>
                    <tr>
                    <td>{row.studentEmail}</td>
                    <td>
                      {(row.counselorNames?.length ? row.counselorNames : [row.counselorName ?? row.counselorEmail ?? ""])
                        .filter(Boolean)
                        .join(", ")}
                    </td>
                    <td>{localizeCrmText(row.applicationTitle, locale, t)}</td>
                    <td>
                      {editId === row.id ? (
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as (typeof STATUSES)[number])}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {engagementStatusLabel(s, t)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        engagementStatusLabel(row.status, t)
                      )}
                    </td>
                    <td>
                      {editId === row.id ? (
                        <select
                          value={editPhase}
                          onChange={(e) => setEditPhase(e.target.value as (typeof PHASES)[number])}
                        >
                          {PHASES.map((p) => (
                            <option key={p} value={p}>
                              {t(`crm.phase.${p}`)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        t(`crm.phase.${row.phase as (typeof PHASES)[number]}`)
                      )}
                    </td>
                    <td>{formatWhen(row.updatedAt, locale)}</td>
                    <td className="admin-portal__row-actions admin-portal__row-actions--engagements">
                      <div className="admin-portal__counselor-team">
                        <p className="admin-portal__counselor-team-title">{t("admin.engagements.teamTitle")}</p>
                        <ul className="admin-portal__counselor-team-list">
                          {counselorTeamEntries(row).map((entry) => (
                            <li key={entry.id} className="admin-portal__counselor-team-item">
                              <span className="admin-portal__counselor-team-name">
                                {localizeCrmText(entry.name, locale, t)}
                              </span>
                              <span
                                className={
                                  entry.isPrimary
                                    ? "admin-portal__counselor-team-role is-primary"
                                    : "admin-portal__counselor-team-role"
                                }
                              >
                                {entry.isPrimary
                                  ? t("admin.engagements.rolePrimary")
                                  : t("admin.engagements.roleCollaborator")}
                              </span>
                              {editId === row.id && !entry.isPrimary ? (
                                <button
                                  type="button"
                                  className="admin-portal__counselor-team-remove"
                                  disabled={busy}
                                  onClick={() =>
                                    void onRun(async () => {
                                      await patchAdminEngagement(token, row.id, { removeCounselorId: entry.id });
                                    })
                                  }
                                >
                                  {t("admin.engagements.removeCollaborator", { name: entry.name })}
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {editId === row.id ? (
                        <>
                          <label className="admin-portal__counselor-field">
                            <span>{t("admin.engagements.changePrimary")}</span>
                            <select
                              ref={counselorSelectRef}
                              value={editCounselorId}
                              onChange={(e) => setEditCounselorId(e.target.value)}
                            >
                              {allCounselors.filter((c) => c.active || c.id === row.counselorId).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {localizeCrmText(c.name, locale, t)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="admin-portal__counselor-add">
                            <select
                              value={addCollaboratorIdByEngagement[row.id] ?? ""}
                              onChange={(e) =>
                                setAddCollaboratorIdByEngagement((prev) => ({ ...prev, [row.id]: e.target.value }))
                              }
                            >
                              <option value="">{t("admin.engagements.addCollaborator")}</option>
                              {allCounselors
                                .filter((c) => c.active && !(row.counselorIds ?? []).includes(c.id))
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {localizeCrmText(c.name, locale, t)}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={busy || !(addCollaboratorIdByEngagement[row.id] ?? "")}
                              onClick={() =>
                                void onRun(async () => {
                                  const nextId = addCollaboratorIdByEngagement[row.id] ?? "";
                                  if (!nextId) return;
                                  await patchAdminEngagement(token, row.id, { addCounselorId: nextId });
                                  setAddCollaboratorIdByEngagement((prev) => ({ ...prev, [row.id]: "" }));
                                })
                              }
                            >
                              {t("admin.engagements.add")}
                            </button>
                          </div>
                          <div className="admin-portal__row-actions-btns">
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={busy}
                              onClick={() =>
                                void onRun(async () => {
                                  await patchAdminEngagement(token, row.id, {
                                    counselorId: editCounselorId,
                                    status: editStatus,
                                    phase: editPhase,
                                  });
                                  setEditId(null);
                                })
                              }
                            >
                              {t("admin.engagements.edit")}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditId(null)}>
                              {t("crm.console.cancel")}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="admin-portal__counselor-add">
                            <select
                              value={addCollaboratorIdByEngagement[row.id] ?? ""}
                              onChange={(e) =>
                                setAddCollaboratorIdByEngagement((prev) => ({ ...prev, [row.id]: e.target.value }))
                              }
                            >
                              <option value="">{t("admin.engagements.addCollaborator")}</option>
                              {allCounselors
                                .filter((c) => c.active && !(row.counselorIds ?? []).includes(c.id))
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {localizeCrmText(c.name, locale, t)}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={busy || !(addCollaboratorIdByEngagement[row.id] ?? "")}
                              onClick={() =>
                                void onRun(async () => {
                                  const nextId = addCollaboratorIdByEngagement[row.id] ?? "";
                                  if (!nextId) return;
                                  await patchAdminEngagement(token, row.id, { addCounselorId: nextId });
                                  setAddCollaboratorIdByEngagement((prev) => ({ ...prev, [row.id]: "" }));
                                })
                              }
                            >
                              {t("admin.engagements.add")}
                            </button>
                          </div>
                          <div className="admin-portal__row-actions-btns">
                          <button
                            type="button"
                            className={`btn btn-secondary${expandedGroupChatId === row.id ? " is-active" : ""}`}
                            onClick={() =>
                              setExpandedGroupChatId(expandedGroupChatId === row.id ? null : row.id)
                            }
                          >
                            {expandedGroupChatId === row.id
                              ? t("admin.engagements.closeGroupChat")
                              : t("admin.engagements.openGroupChat")}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setEditId(row.id);
                              setEditCounselorId(row.counselorId);
                              setEditStatus(row.status as (typeof STATUSES)[number]);
                              setEditPhase(row.phase as (typeof PHASES)[number]);
                              window.setTimeout(() => counselorSelectRef.current?.focus(), 0);
                            }}
                          >
                            {t("admin.engagements.changeCounselor")}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busy || row.status === "closed"}
                            onClick={() => {
                              if (!window.confirm(t("admin.engagements.endConfirm"))) return;
                              void onRun(async () => {
                                await patchAdminEngagement(token, row.id, { status: "closed" });
                              });
                            }}
                          >
                            {t("admin.engagements.endEngagement")}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setEditId(row.id);
                              setEditCounselorId(row.counselorId);
                              setEditStatus(row.status as (typeof STATUSES)[number]);
                              setEditPhase(row.phase as (typeof PHASES)[number]);
                              setAddCollaboratorIdByEngagement((prev) => ({ ...prev, [row.id]: "" }));
                            }}
                          >
                            {t("admin.engagements.edit")}
                          </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                  {expandedGroupChatId === row.id ? (
                    <tr className="admin-portal__chat-row">
                      <td colSpan={7}>
                        <div className="admin-portal__chat-inline">
                          <p className="admin-portal__muted">{t("admin.groupChat.lead")}</p>
                          <AdminGroupChatThread
                            t={t}
                            locale={locale}
                            busy={busy}
                            token={token}
                            engagementId={row.id}
                            onError={onGroupChatError}
                          />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function authorRoleLabel(role: AdminCaseMessage["authorRole"], t: (key: string) => string) {
  switch (role) {
    case "student":
      return t("admin.groupChat.roleStudent");
    case "counselor":
      return t("admin.groupChat.roleCounselor");
    case "admin":
      return t("admin.groupChat.roleAdmin");
    default:
      return t("admin.groupChat.roleSystem");
  }
}

function AdminGroupChatThread({
  t,
  locale,
  busy,
  token,
  engagementId,
  onError,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: "zh" | "en";
  busy: boolean;
  token: string;
  engagementId: string;
  onError: (code?: string) => void;
}) {
  const [messages, setMessages] = useState<AdminCaseMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");

  const loadMessages = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !engagementId) {
        setMessages([]);
        return;
      }
      if (!opts?.silent) setLoading(true);
      try {
        const res = await listAdminGroupMessages(token, engagementId);
        setMessages(res.messages);
      } catch (e) {
        const code = (e as Error & { code?: string }).code;
        if (!opts?.silent) onError(code);
        if (!opts?.silent) setMessages([]);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [token, engagementId, onError],
  );

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!engagementId) return;
    const timer = window.setInterval(() => {
      void loadMessages({ silent: true });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [engagementId, loadMessages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !engagementId || sending) return;
    setSending(true);
    try {
      await sendAdminGroupMessage(token, engagementId, body);
      setDraft("");
      await loadMessages({ silent: true });
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      onError(code);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="admin-portal__chat-toolbar">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!engagementId || loading}
          onClick={() => void loadMessages()}
        >
          {t("admin.groupChat.refresh")}
        </button>
      </div>
      {loading ? (
        <p className="admin-portal__muted">{t("admin.loading")}</p>
      ) : messages.length === 0 ? (
        <p className="admin-portal__muted">{t("admin.groupChat.empty")}</p>
      ) : (
        <ul className="admin-portal__chat-timeline">
          {[...messages].reverse().map((message) => (
            <li key={message.id} className={`is-${message.authorRole}`}>
              <div className="admin-portal__chat-head">
                <span>
                  {formatWhen(message.createdAt, locale)} · {authorRoleLabel(message.authorRole, t)} ·{" "}
                  {message.authorLabel}
                </span>
              </div>
              <p>{message.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="admin-portal__chat-compose">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("admin.groupChat.placeholder")}
          rows={3}
          disabled={!engagementId || sending || busy}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void send()}
          disabled={!engagementId || !draft.trim() || sending || busy}
        >
          {sending ? t("admin.groupChat.sending") : t("admin.groupChat.send")}
        </button>
      </div>
    </>
  );
}
function AdminGroupChatPanel({
  t,
  locale,
  busy,
  token,
  engagements,
  engagementId,
  onEngagementChange,
  onError,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: "zh" | "en";
  busy: boolean;
  token: string;
  engagements: AdminEngagement[];
  engagementId: string;
  onEngagementChange: (id: string) => void;
  onError: (code?: string) => void;
}) {
  useEffect(() => {
    if (!engagementId && engagements[0]) onEngagementChange(engagements[0].id);
  }, [engagementId, engagements, onEngagementChange]);

  const selected = engagements.find((e) => e.id === engagementId);

  return (
    <div className="admin-portal__stack">
      <section className="admin-portal__panel">
        <h2>{t("admin.groupChat.title")}</h2>
        <p className="admin-portal__muted">{t("admin.groupChat.lead")}</p>
        {engagements.length === 0 ? (
          <p className="admin-portal__muted">{t("admin.engagements.empty")}</p>
        ) : (
          <>
            <label className="admin-portal__form">
              <span>{t("admin.groupChat.selectEngagement")}</span>
              <select value={engagementId} onChange={(e) => onEngagementChange(e.target.value)}>
                {engagements.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.studentEmail} · {localizeCrmText(row.applicationTitle, locale, t)}
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <p className="admin-portal__muted">
                {selected.studentEmail} ·{" "}
                {localizeCrmText(selected.counselorName ?? selected.counselorEmail ?? "", locale, t)}
              </p>
            ) : null}
            {engagementId ? (
              <AdminGroupChatThread
                t={t}
                locale={locale}
                busy={busy}
                token={token}
                engagementId={engagementId}
                onError={onError}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
