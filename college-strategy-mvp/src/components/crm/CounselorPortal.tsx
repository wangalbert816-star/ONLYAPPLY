import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { fetchCounselorByUserId, bootstrapDevCounselorProfile } from "../../lib/crm/supabaseCrm";
import { initCrmForUser, isCrmDemoUiEnabled, isSignedServiceEnabled } from "../../lib/crm/store";
import type { CrmEngagement } from "../../lib/crm/types";
import { isSupabaseConfigured } from "../../lib/supabase/client";
import { CounselorConsole } from "./CounselorConsole";
import { CounselorLogin } from "./CounselorLogin";

type Props = {
  onBack: () => void;
  onOpenStudentReport?: (engagement: CrmEngagement) => void;
};

const DEV_COUNSELOR_EMAILS = new Set(["weiyiwang603@gmail.com"]);

export function CounselorPortal({ onBack, onOpenStudentReport }: Props) {
  const { t } = useLanguage();
  const { user, configured, loading: authLoading, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isCounselor, setIsCounselor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function verify() {
      if (authLoading) return;
      if (!user) {
        setIsCounselor(false);
        setChecking(false);
        return;
      }
      setChecking(true);
      try {
        if (configured && isSupabaseConfigured()) {
          await initCrmForUser(user.id, "counselor");
          let profile = await fetchCounselorByUserId(user.id);
          if (
            !profile &&
            isCrmDemoUiEnabled() &&
            user.email &&
            DEV_COUNSELOR_EMAILS.has(user.email.toLowerCase())
          ) {
            profile = await bootstrapDevCounselorProfile();
          }
          if (!cancelled) setIsCounselor(Boolean(profile));
        } else if (!cancelled) {
          setIsCounselor(false);
        }
      } catch {
        if (!cancelled) setIsCounselor(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void verify();
    return () => {
      cancelled = true;
    };
  }, [user, configured, authLoading]);

  if (!isSignedServiceEnabled()) {
    return (
      <div className="counselor-console__empty-case" style={{ minHeight: "100vh", padding: "2rem" }}>
        {t("crm.counselorAuth.disabled")}
      </div>
    );
  }

  if (!configured || !isSupabaseConfigured()) {
    return (
      <div className="counselor-login">
        <div className="counselor-login__card">
          <p className="counselor-login__kicker">{t("crm.console.title")}</p>
          <h1>{t("crm.counselorAuth.title")}</h1>
          <p className="counselor-login__lead">{t("crm.counselorAuth.notConfigured")}</p>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            {t("crm.console.back")}
          </button>
        </div>
      </div>
    );
  }

  if (authLoading || (user && checking)) {
    return (
      <div className="counselor-console__empty-case" style={{ minHeight: "100vh", padding: "2rem" }}>
        {t("auth.accountLoading")}
      </div>
    );
  }

  if (!user) {
    return <CounselorLogin onBack={onBack} />;
  }

  if (!isCounselor) {
    return (
      <div className="counselor-login">
        <div className="counselor-login__card">
          <p className="counselor-login__kicker">{t("crm.console.title")}</p>
          <h1>{t("crm.counselorAuth.deniedTitle")}</h1>
          <p className="counselor-login__lead">{t("crm.counselorAuth.deniedLead")}</p>
          <div className="counselor-login__actions">
            <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
              {t("crm.counselorAuth.switchAccount")}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              {t("crm.console.back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <CounselorConsole onBack={onBack} onOpenStudentReport={onOpenStudentReport} />;
}
