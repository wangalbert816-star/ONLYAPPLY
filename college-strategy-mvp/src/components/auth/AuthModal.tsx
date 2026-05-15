import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import "./AuthModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 登录成功后的提示（例如已自动保存） */
  successHint?: string | null;
};

export function AuthModal({ open, onClose, successHint }: Props) {
  const { t } = useLanguage();
  const { configured, signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"form" | "email_sent">("form");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = await signInWithEmail(email);
    setBusy(false);
    if (res.error === "auth_not_configured") {
      setErr(t("auth.errNotConfigured"));
      return;
    }
    if (res.error === "email_required") {
      setErr(t("auth.errEmailRequired"));
      return;
    }
    if (res.error) {
      setErr(res.error);
      return;
    }
    setPhase("email_sent");
  }

  async function handleGoogle() {
    setErr(null);
    setBusy(true);
    const res = await signInWithGoogle();
    setBusy(false);
    if (res.error === "auth_not_configured") {
      setErr(t("auth.errNotConfigured"));
      return;
    }
    if (res.error) setErr(res.error);
  }

  return createPortal(
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal__close" onClick={onClose} aria-label={t("auth.close")}>
          ×
        </button>
        <h2 id="auth-modal-title">{t("auth.modalTitle")}</h2>
        <p className="auth-modal__lead">{t("auth.modalLead")}</p>

        {successHint && <p className="auth-modal__success">{successHint}</p>}

        {!configured ? (
          <p className="auth-modal__warn">{t("auth.errNotConfigured")}</p>
        ) : phase === "email_sent" ? (
          <div className="auth-modal__sent">
            <p>{t("auth.emailSent", { email: email.trim() })}</p>
            <button type="button" className="btn btn-secondary" onClick={() => setPhase("form")}>
              {t("auth.backToForm")}
            </button>
          </div>
        ) : (
          <>
            <form className="auth-modal__form" onSubmit={(e) => void handleEmail(e)}>
              <label className="auth-modal__label" htmlFor="auth-email">
                {t("auth.emailLabel")}
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                disabled={busy}
              />
              {err && <p className="auth-modal__err">{err}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {t("auth.emailSubmit")}
              </button>
            </form>
            <div className="auth-modal__divider">
              <span>{t("auth.or")}</span>
            </div>
            <button type="button" className="btn btn-secondary btn-block auth-modal__google" onClick={() => void handleGoogle()} disabled={busy}>
              {t("auth.google")}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
