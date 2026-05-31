import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  adminErrorMessage,
  createAdminCounselor,
  createAdminEngagement,
  fetchAdminSession,
  listAdminCounselors,
  listAdminEngagements,
  lookupAdminStudent,
  patchAdminCounselor,
  patchAdminEngagement,
  type AdminCounselor,
  type AdminEngagement,
  type StudentLookupResult,
} from "../../lib/admin/crmAdminApi";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import { BrandLogo } from "../BrandLogo";
import "./AdminPortal.css";

type Props = {
  onBack: () => void;
};

type TabId = "counselors" | "engagements";

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

export function AdminPortal({ onBack }: Props) {
  const { t, locale } = useLanguage();
  const { user, session, configured, loading: authLoading, signInWithGoogle, signInWithPassword } = useAuth();
  const [tab, setTab] = useState<TabId>("engagements");
  const [gate, setGate] = useState<"idle" | "loading" | "ok" | "forbidden" | "misconfigured">("idle");
  const [notice, setNotice] = useState<string | null>(null);

  const [counselors, setCounselors] = useState<AdminCounselor[]>([]);
  const [engagements, setEngagements] = useState<AdminEngagement[]>([]);
  const [busy, setBusy] = useState(false);

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
        if (code === "crm_admin_not_configured" || code === "supabase_admin_missing") {
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

  if (!configured) {
    return (
      <div className="admin-portal admin-portal--center">
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
        <p>{t("admin.loading")}</p>
      </div>
    );
  }

  if (!user) {
    return <AdminSignIn onBack={onBack} signInWithGoogle={signInWithGoogle} signInWithPassword={signInWithPassword} />;
  }

  if (gate === "misconfigured") {
    return (
      <div className="admin-portal admin-portal--center">
        <p>{t("admin.notConfigured")}</p>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          {t("admin.back")}
        </button>
      </div>
    );
  }

  if (gate === "forbidden") {
    return (
      <div className="admin-portal admin-portal--center">
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
          <p className="admin-portal__kicker">OnlyApply Admin</p>
          <h1>{t("admin.title")}</h1>
          <p className="admin-portal__lead">{t("admin.lead")}</p>
          <p className="admin-portal__email">{user.email}</p>
        </div>
        <div className="admin-portal__head-actions">
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
        />
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
            Google
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
  const [calendlyUrl, setCalendlyUrl] = useState("");

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
            {t("admin.counselors.calendly")}
            <input value={calendlyUrl} onChange={(e) => setCalendlyUrl(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !email || !name || !title}
            onClick={() =>
              void onRun(async () => {
                await createAdminCounselor(token, {
                  email,
                  name,
                  title,
                  calendlyUrl: calendlyUrl || undefined,
                });
                setEmail("");
                setName("");
                setTitle("");
                setCalendlyUrl("");
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
                  <th>Auth</th>
                  <th>{t("admin.engagements.colStatus")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {counselors.map((c) => (
                  <tr key={c.id}>
                    <td>{localizeCrmText(c.name, locale, t)}</td>
                    <td>{c.email}</td>
                    <td>{localizeCrmText(c.title, locale, t)}</td>
                    <td>{c.userId ? t("admin.counselors.authLinked") : t("admin.counselors.authMissing")}</td>
                    <td>{c.active ? t("admin.counselors.active") : t("admin.counselors.inactive")}</td>
                    <td className="admin-portal__row-actions">
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
                        onClick={() =>
                          void onRun(async () => {
                            await patchAdminCounselor(token, c.id, { active: !c.active });
                          })
                        }
                      >
                        {c.active ? t("admin.counselors.inactive") : t("admin.counselors.active")}
                      </button>
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
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: "zh" | "en";
  busy: boolean;
  counselors: AdminCounselor[];
  allCounselors: AdminCounselor[];
  engagements: AdminEngagement[];
  token: string;
  onRun: (action: () => Promise<void>) => Promise<void>;
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
  const [editStatus, setEditStatus] = useState<(typeof STATUSES)[number]>("active");
  const [editPhase, setEditPhase] = useState<(typeof PHASES)[number]>("planning");

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
              <option value="en">English</option>
              <option value="zh">中文</option>
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
                  <tr key={row.id}>
                    <td>{row.studentEmail}</td>
                    <td>{row.counselorName ?? row.counselorEmail}</td>
                    <td>{localizeCrmText(row.applicationTitle, locale, t)}</td>
                    <td>
                      {editId === row.id ? (
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as (typeof STATUSES)[number])}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        row.status
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
                    <td className="admin-portal__row-actions">
                      {editId === row.id ? (
                        <>
                          <select value={editCounselorId} onChange={(e) => setEditCounselorId(e.target.value)}>
                            {allCounselors.filter((c) => c.active || c.id === row.counselorId).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
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
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditId(row.id);
                            setEditCounselorId(row.counselorId);
                            setEditStatus(row.status as (typeof STATUSES)[number]);
                            setEditPhase(row.phase as (typeof PHASES)[number]);
                          }}
                        >
                          {t("admin.engagements.edit")}
                        </button>
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
