import { AuthMenuButton } from "./auth/AuthMenuButton";
import { LanguageToggle } from "../i18n/LanguageToggle";
import { useAuth } from "../auth/AuthContext";
import { useAuthChrome } from "../auth/AuthChromeContext";

export function AppTopChrome() {
  const { configured, loading } = useAuth();
  const { onSignIn, onOpenAccount } = useAuthChrome();
  const showAuth = configured && !loading;

  return (
    <div className="app-top-chrome" role="navigation" aria-label="Site">
      <div className="app-top-chrome__start">{showAuth && <AuthMenuButton onSignIn={onSignIn} onOpenAccount={onOpenAccount} />}</div>
      <div className="app-top-chrome__end">
        <LanguageToggle />
      </div>
    </div>
  );
}
