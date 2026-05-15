import { useLanguage } from "../../i18n/LanguageContext";
import { useAuth } from "../../auth/AuthContext";
import "./AuthMenuButton.css";

type Props = {
  onSignIn: () => void;
  onOpenAccount: () => void;
};

export function AuthMenuButton({ onSignIn, onOpenAccount }: Props) {
  const { t } = useLanguage();
  const { configured, loading, user } = useAuth();

  if (!configured || loading) return null;

  if (user) {
    return (
      <button type="button" className="auth-menu-btn auth-menu-btn--signed-in" onClick={onOpenAccount}>
        {t("auth.myApplications")}
      </button>
    );
  }

  return (
    <button type="button" className="auth-menu-btn" onClick={onSignIn}>
      {t("auth.signIn")}
    </button>
  );
}
