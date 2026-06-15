import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { verifyAlumniAccessCode } from "../../lib/alumniAccess";
import "./AlumniAccessModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AlumniAccessModal({ open, onClose, onSuccess }: Props) {
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!verifyAlumniAccessCode(password)) {
      setErr(t("alumni.access.errWrong"));
      return;
    }
    setErr(null);
    setPassword("");
    onSuccess();
  }

  function handleClose() {
    setPassword("");
    setErr(null);
    onClose();
  }

  return createPortal(
    <div
      className="alumni-access-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="alumni-access-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alumni-access-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="alumni-access-modal__close" onClick={handleClose} aria-label={t("alumni.access.close")}>
          ×
        </button>
        <p className="alumni-access-modal__eyebrow">{t("alumni.flow.eyebrow")}</p>
        <h2 id="alumni-access-title">{t("alumni.access.title")}</h2>
        <p className="alumni-access-modal__lead">{t("alumni.access.lead")}</p>
        <form className="alumni-access-modal__form" onSubmit={handleSubmit}>
          <label className="alumni-access-modal__label" htmlFor="alumni-access-password">
            {t("alumni.access.passwordLabel")}
          </label>
          <input
            id="alumni-access-password"
            type="password"
            className="alumni-access-modal__input"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErr(null);
            }}
            placeholder={t("alumni.access.passwordPlaceholder")}
            autoComplete="off"
            autoFocus
          />
          {err ? <p className="alumni-access-modal__err">{err}</p> : null}
          <button type="submit" className="btn btn-primary btn-block alumni-access-modal__submit">
            {t("alumni.access.submit")}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
