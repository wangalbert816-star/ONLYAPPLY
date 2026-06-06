import { AuthMenuButton } from "./auth/AuthMenuButton";
import { BrandLogo } from "./BrandLogo";
import { LanguageToggle } from "../i18n/LanguageToggle";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../auth/AuthContext";
import { useCrmStudentUnread } from "../lib/crm/useCrmStudentUnread";
import "../lib/crm/crmUnreadBadge.css";
import { useAuthChrome } from "../auth/AuthChromeContext";

type Props = {
  expertConsultLabel?: string;
  onExpertConsult?: () => void;
  onHome?: () => void;
};

export function AppTopChrome({ expertConsultLabel, onExpertConsult, onHome }: Props) {
  const { t } = useLanguage();
  const { configured, loading, user } = useAuth();
  const { onSignIn, onOpenAccount } = useAuthChrome();
  const unreadMessages = useCrmStudentUnread(user?.id);
  const showAuth = configured && !loading;
  const showConsult = Boolean(expertConsultLabel && onExpertConsult);

  return (
    <div
      className={`app-top-chrome${showConsult ? " app-top-chrome--with-consult" : ""}`}
      role="navigation"
      aria-label="Site"
    >
      <div className="app-top-chrome__start">
        {showAuth && (
          <AuthMenuButton
            onSignIn={onSignIn}
            onOpenAccount={onOpenAccount}
            unreadCount={unreadMessages}
          />
        )}
      </div>
      {showConsult && (
        <div className="app-top-chrome__center">
          <button type="button" className="app-top-chrome__consult btn btn-primary btn-cta-landing" onClick={onExpertConsult}>
            {expertConsultLabel}
          </button>
        </div>
      )}
      {!showConsult && (
        <div className="app-top-chrome__center" aria-label="OnlyApply">
          {onHome ? (
            <button type="button" className="app-top-chrome__home" onClick={onHome} aria-label={t("app.back")}>
              <BrandLogo className="app-top-chrome__logo" />
            </button>
          ) : (
            <BrandLogo className="app-top-chrome__logo" />
          )}
        </div>
      )}
      <div className="app-top-chrome__end">
        <LanguageToggle />
      </div>
    </div>
  );
}
