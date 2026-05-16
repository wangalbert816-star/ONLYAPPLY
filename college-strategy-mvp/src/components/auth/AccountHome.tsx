import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  deleteApplication,
  getApplicationReports,
  listApplications,
  type ApplicationListItem,
  type SavedReportRow,
} from "../../lib/supabase/accounts";
import { formatSupabaseError } from "../../lib/supabase/errors";
import type { FormState, ReportPayload } from "../../types";
import { BrandLogo } from "../BrandLogo";
import "./AccountHome.css";

type Props = {
  unlockedApplicationIds: readonly string[];
  onBack: () => void;
  onOpenReport: (payload: {
    form: FormState;
    report: ReportPayload;
    applicationId: string;
    reportId: string;
    reportUnlocked: boolean;
  }) => void;
  onEditForm: (payload: { form: FormState; applicationId: string }) => void;
  onNewApplication: () => void;
  onOpenAppLinks: (e: MouseEvent<HTMLButtonElement>) => void;
};

export function AccountHome({
  unlockedApplicationIds,
  onBack,
  onOpenReport,
  onEditForm,
  onNewApplication,
  onOpenAppLinks,
}: Props) {
  const { t, locale } = useLanguage();
  const { user, signOut, configured } = useAuth();
  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportsByApp, setReportsByApp] = useState<Record<string, SavedReportRow[]>>({});
  const [loadingReports, setLoadingReports] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    if (!configured || !user) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await listApplications();
      setApps(list);
    } catch (e) {
      setErr(formatSupabaseError(e, t));
    } finally {
      setLoading(false);
    }
  }, [configured, user, t]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  async function toggleExpand(appId: string) {
    if (expandedId === appId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(appId);
    if (reportsByApp[appId]) return;
    setLoadingReports(appId);
    try {
      const { reports } = await getApplicationReports(appId);
      setReportsByApp((prev) => ({ ...prev, [appId]: reports }));
    } catch (e) {
      setErr(formatSupabaseError(e, t));
    } finally {
      setLoadingReports(null);
    }
  }

  async function handleDelete(appId: string) {
    if (!window.confirm(t("auth.accountDeleteConfirm"))) return;
    try {
      await deleteApplication(appId);
      setApps((prev) => prev.filter((a) => a.id !== appId));
      if (expandedId === appId) setExpandedId(null);
    } catch (e) {
      setErr(formatSupabaseError(e, t));
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="app account-home">
      <header className="account-home__head">
        <BrandLogo />
        <div className="account-home__head-actions">
          <button type="button" className="btn btn-secondary account-home__hub" onClick={onOpenAppLinks}>
            {t("appLinks.entry")}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            {t("auth.accountBack")}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
            {t("auth.signOut")}
          </button>
        </div>
      </header>

      <section className="card report-block">
        <h1 className="account-home__title">{t("auth.accountTitle")}</h1>
        <p className="account-home__lead">{t("auth.accountLead")}</p>
        {user?.email && <p className="account-home__email">{user.email}</p>}

        <button type="button" className="btn btn-primary account-home__new" onClick={onNewApplication}>
          {t("auth.accountNew")}
        </button>

        {err && <p className="account-home__err">{err}</p>}
        {loading && <p className="account-home__muted">{t("auth.accountLoading")}</p>}

        {!loading && apps.length === 0 && (
          <p className="account-home__empty">{t("auth.accountEmpty")}</p>
        )}

        <ul className="account-list">
          {apps.map((app) => (
            <li key={app.id} className="account-list__item">
              <div className="account-list__row">
                <button type="button" className="account-list__main" onClick={() => void toggleExpand(app.id)}>
                  <strong>{app.title}</strong>
                  <span className="account-list__meta">
                    {t("auth.accountReportCount", { n: app.report_count })} · {t("auth.accountUpdated", { date: formatDate(app.updated_at) })}
                  </span>
                </button>
                <div className="account-list__btns">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onEditForm({ form: app.form_state, applicationId: app.id })}
                  >
                    {t("auth.accountEditForm")}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm account-list__delete" onClick={() => void handleDelete(app.id)}>
                    {t("auth.accountDelete")}
                  </button>
                </div>
              </div>

              {expandedId === app.id && (
                <div className="account-list__reports">
                  {loadingReports === app.id && <p className="account-home__muted">{t("auth.accountLoading")}</p>}
                  {(reportsByApp[app.id] ?? []).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="account-report-row"
                      onClick={() =>
                        onOpenReport({
                          form: app.form_state,
                          report: r.report_payload,
                          applicationId: app.id,
                          reportId: r.id,
                          reportUnlocked: unlockedApplicationIds.includes(app.id) || r.report_unlocked,
                        })
                      }
                    >
                      <span>{formatDate(r.created_at)}</span>
                      <span className="account-report-row__cta">{t("auth.accountOpenReport")}</span>
                    </button>
                  ))}
                  {(reportsByApp[app.id] ?? []).length === 0 && loadingReports !== app.id && (
                    <p className="account-home__muted">{t("auth.accountNoReports")}</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
