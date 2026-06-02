import { useLanguage } from "../../i18n/LanguageContext";
import { CrmUnreadBadge } from "../../lib/crm/CrmUnreadBadge";
import "../../lib/crm/crmUnreadBadge.css";
import { useAuth } from "../../auth/AuthContext";

type Props = {
  onSignIn: () => void;
  onOpenAccount: () => void;
  unreadCount?: number;
};

export function AuthMenuButton({ onSignIn, onOpenAccount, unreadCount = 0 }: Props) {
  const { t } = useLanguage();
  const { configured, loading, user } = useAuth();

  if (!configured || loading) return null;

  const label = user ? t("auth.myApplications") : t("auth.signIn");
  const onClick = user ? onOpenAccount : onSignIn;
  const unreadLabel =
    unreadCount > 0 ? t("crm.notifications.unreadMessages", { n: unreadCount }) : undefined;

  return (
    <div
      className="auth-menu-button-wrap lang-toggle lang-toggle--solo"
      role="group"
      aria-label={unreadLabel ? `${label}. ${unreadLabel}` : label}
    >
      <button
        type="button"
        className={`lang-toggle__btn${user ? " lang-toggle__btn--on" : ""}`}
        onClick={onClick}
      >
        {label}
      </button>
      {unreadCount > 0 ? (
        <CrmUnreadBadge count={unreadCount} className="crm-unread-badge--menu-corner crm-unread-badge--dot" label={unreadLabel} />
      ) : null}
    </div>
  );
}
