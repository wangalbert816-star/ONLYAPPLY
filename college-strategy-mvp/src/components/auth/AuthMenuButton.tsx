import { useLanguage } from "../../i18n/LanguageContext";
import { useAuth } from "../../auth/AuthContext";

type Props = {
  onSignIn: () => void;
  onOpenAccount: () => void;
};

export function AuthMenuButton({ onSignIn, onOpenAccount }: Props) {
  const { t } = useLanguage();
  const { configured, loading, user } = useAuth();

  if (!configured || loading) return null;

  const label = user ? t("auth.myApplications") : t("auth.signIn");
  const onClick = user ? onOpenAccount : onSignIn;

  return (
    <div className="lang-toggle lang-toggle--solo" role="group" aria-label={label}>
      <button
        type="button"
        className={`lang-toggle__btn${user ? " lang-toggle__btn--on" : ""}`}
        onClick={onClick}
      >
        {label}
      </button>
    </div>
  );
}
