import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n/LanguageContext";
import "./ExpertConsultSection.css";

export const EXPERT_CONSULT_CONTACT_EMAIL = "wangalbert816@gmail.com";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ExpertConsultContactModal({ open, onClose }: Props) {
  const { t } = useLanguage();
  const backdropRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const close = useCallback(() => onClose(), [onClose]);

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

  if (!open) return null;

  return createPortal(
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
          {t("app.expertConsult.modalTitle")}
        </h2>
        <p className="expert-consult-modal__lead">{t("app.expertConsult.modalLead")}</p>
        <p className="expert-consult-modal__email">
          <a href={`mailto:${EXPERT_CONSULT_CONTACT_EMAIL}`}>{EXPERT_CONSULT_CONTACT_EMAIL}</a>
        </p>
        <div className="expert-consult-modal__actions">
          <button type="button" className="btn btn-primary" onClick={close}>
            {t("app.expertConsult.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
