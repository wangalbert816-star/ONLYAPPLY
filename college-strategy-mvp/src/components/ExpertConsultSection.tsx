import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { apiUrl } from "../lib/apiBase";
import "./ExpertConsultSection.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  gapCount: number;
  applicationId?: string | null;
  reportId?: string | null;
};

export function ExpertConsultSection({ gapCount, applicationId = null, reportId = null }: Props) {
  const { t, locale } = useLanguage();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [wechat, setWechat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  const closeAfterSuccess = useCallback(() => {
    setEmail("");
    setWechat("");
    setSuccess(false);
    setOpen(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open || success) return;
    const id = window.requestAnimationFrame(() => {
      emailInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, success]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  function backdropDown(e: React.MouseEvent) {
    if (e.target === backdropRef.current) close();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || success) return;
    const em = email.trim();
    if (!em) {
      setError(t("report.expertConsult.errEmailRequired"));
      return;
    }
    if (!EMAIL_RE.test(em)) {
      setError(t("report.expertConsult.errEmailInvalid"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch(apiUrl("/api/consult-lead"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: em,
          wechat: wechat.trim() || undefined,
          locale,
          source: "report_advisor_support",
          applicationId: applicationId || undefined,
          reportId: reportId || undefined,
        }),
      });
      const raw = await res.text();
      let data: { error?: string } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as { error?: string };
        } catch {
          setError(t("report.expertConsult.errBadResponse"));
          return;
        }
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("report.expertConsult.errSubmit"));
        return;
      }
      setSuccess(true);
    } catch {
      setError(`${t("report.expertConsult.errNetwork")}\n${t("report.expertConsult.errNetworkHint")}`);
    } finally {
      setSubmitting(false);
    }
  }

  const riskText =
    gapCount > 0
      ? t("report.expertConsult.riskWithGaps", { n: gapCount })
      : t("report.expertConsult.riskNoGaps");

  const modal =
    open &&
    createPortal(
      <div
        ref={backdropRef}
        className="expert-consult-modal-backdrop"
        role="presentation"
        onMouseDown={backdropDown}
      >
        <div
          className="expert-consult-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 className="expert-consult-modal__title" id={titleId}>
            {t("report.expertConsult.modalTitle")}
          </h2>
          <p className="expert-consult-modal__lead">{t("report.expertConsult.modalLead")}</p>

          {success ? (
            <>
              <p className="expert-consult-modal__success">{t("report.expertConsult.success")}</p>
              <div className="expert-consult-modal__actions">
                <button type="button" className="btn btn-primary" onClick={closeAfterSuccess}>
                  {t("report.expertConsult.close")}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="expert-consult-email">{t("report.expertConsult.emailLabel")}</label>
                <input
                  ref={emailInputRef}
                  id="expert-consult-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => {
                    setEmail(ev.target.value);
                    setError(null);
                  }}
                  placeholder={t("report.expertConsult.emailPlaceholder")}
                />
              </div>
              <div className="field">
                <label htmlFor="expert-consult-wechat">
                  {t("report.expertConsult.wechatLabel")}{" "}
                  <span className="expert-consult-modal__optional">{t("report.expertConsult.optional")}</span>
                </label>
                <input
                  id="expert-consult-wechat"
                  name="wechat"
                  type="text"
                  autoComplete="off"
                  value={wechat}
                  onChange={(ev) => setWechat(ev.target.value.slice(0, 64))}
                  placeholder={t("report.expertConsult.wechatPlaceholder")}
                />
              </div>
              {error && <p className="expert-consult-modal__error">{error}</p>}
              <div className="expert-consult-modal__actions">
                <button type="button" className="btn btn-secondary" onClick={close}>
                  {t("report.expertConsult.cancel")}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? t("report.expertConsult.submitting") : t("report.expertConsult.submit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <section className="card report-block expert-consult" aria-labelledby="expert-consult-heading" data-no-pdf>
      <h2 className="expert-consult__title" id="expert-consult-heading">
        {t("report.expertConsult.sectionLabel")}
      </h2>
      <p className="expert-consult__risk">{riskText}</p>
      <p className="expert-consult__guide">{t("report.expertConsult.guide")}</p>
      <button type="button" className="expert-consult__cta" onClick={() => setOpen(true)}>
        {t("report.expertConsult.cta")}
      </button>
      {modal}
    </section>
  );
}
