import { useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../auth/AuthContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { mapAuthError } from "../../lib/authErrors";
import { LegalConsentLine, LegalLinks } from "../LegalLinks";
import "./AuthModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 登录成功后的提示（例如已自动保存） */
  successHint?: string | null;
  /** 打开「申请流程导航」全屏层（关闭弹窗后打开，避免被遮挡） */
  onOpenAppLinks?: (e: MouseEvent<HTMLButtonElement>) => void;
};

export function AuthModal({ open, onClose, successHint, onOpenAppLinks }: Props) {
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
      setErr(mapAuthError(res.error, t));
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
    if (res.error) setErr(mapAuthError(res.error, t));
  }

  return createPortal(
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal__close" onClick={onClose} aria-label={t("auth.close")}>
          ×
        </button>
        <h2 id="auth-modal-title">{t("auth.modalTitle")}</h2>
        <p className="auth-modal__lead">{t("auth.modalLead")}</p>

        {onOpenAppLinks && (
          <button
            type="button"
            className="auth-modal__app-links"
            onClick={(e) => {
              onOpenAppLinks(e);
              onClose();
            }}
          >
            {t("appLinks.entry")}
          </button>
        )}

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
            <button
              type="button"
              className="btn btn-block auth-modal__google"
              onClick={() => void handleGoogle()}
              disabled={busy}
            >
              <span className="auth-modal__google-icon" aria-hidden>
                G
              </span>
              {t("auth.google")}
            </button>
            <p className="auth-modal__google-hint">{t("auth.googleHint")}</p>
            {err && <p className="auth-modal__err">{err}</p>}
            <div className="auth-modal__divider">
              <span>{t("auth.or")}</span>
            </div>
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
              <button type="submit" className="btn btn-secondary btn-block" disabled={busy}>
                {t("auth.emailSubmit")}
              </button>
            </form>
            <LegalConsentLine />
            <LegalLinks className="auth-modal__legal-links" />
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
