import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { BrandLogo } from "../BrandLogo";
import "./CounselorLogin.css";

type Props = {
  onBack: () => void;
};

export function CounselorLogin({ onBack }: Props) {
  const { t } = useLanguage();
  const { configured, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!configured) {
      setError(t("crm.counselorAuth.notConfigured"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await signInWithPassword(email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error === "Invalid login credentials" ? t("crm.counselorAuth.badCredentials") : res.error);
    }
  }

  return (
    <div className="counselor-login">
      <div className="counselor-login__card">
        <BrandLogo />
        <p className="counselor-login__kicker">{t("crm.console.title")}</p>
        <h1>{t("crm.counselorAuth.title")}</h1>
        <p className="counselor-login__lead">{t("crm.counselorAuth.lead")}</p>
        <form onSubmit={(e) => void onSubmit(e)}>
          <label>
            <span>{t("crm.counselorAuth.email")}</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            <span>{t("crm.counselorAuth.password")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="counselor-login__error">{error}</p> : null}
          <div className="counselor-login__actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? t("crm.counselorAuth.signingIn") : t("crm.counselorAuth.signIn")}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              {t("crm.console.back")}
            </button>
          </div>
        </form>
        <p className="counselor-login__hint">{t("crm.counselorAuth.hint")}</p>
      </div>
    </div>
  );
}
