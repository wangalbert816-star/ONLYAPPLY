import { AuthMenuButton } from "./auth/AuthMenuButton";
import { LanguageToggle } from "../i18n/LanguageToggle";
import { useAuth } from "../auth/AuthContext";
import { useAuthChrome } from "../auth/AuthChromeContext";

type Props = {
  expertConsultLabel?: string;
  onExpertConsult?: () => void;
};

export function AppTopChrome({ expertConsultLabel, onExpertConsult }: Props) {
  const { configured, loading } = useAuth();
  const { onSignIn, onOpenAccount } = useAuthChrome();
  const showAuth = configured && !loading;
  const showConsult = Boolean(expertConsultLabel && onExpertConsult);

  return (
    <div
      className={`app-top-chrome${showConsult ? " app-top-chrome--with-consult" : ""}`}
      role="navigation"
      aria-label="Site"
    >
      <div className="app-top-chrome__start">{showAuth && <AuthMenuButton onSignIn={onSignIn} onOpenAccount={onOpenAccount} />}</div>
      {showConsult && (
        <div className="app-top-chrome__center">
          <button type="button" className="app-top-chrome__consult btn btn-primary btn-cta-landing" onClick={onExpertConsult}>
            {expertConsultLabel}
          </button>
        </div>
      )}
      <div className="app-top-chrome__end">
        <LanguageToggle />
      </div>
    </div>
  );
}
