import type { MouseEvent } from "react";
import { BrandLogo } from "./BrandLogo";
import { LegalLinks } from "./LegalLinks";
import { useLanguage } from "../i18n/LanguageContext";
import { SUPPORT_EMAIL } from "../lib/support";
import { isSignedServiceEnabled } from "../lib/crm/store";
import "./LandingSiteFooter.css";

type Props = {
  onStart: () => void;
  onStartAlumni: () => void;
  onOpenApplicationRoadmap: (e: MouseEvent<HTMLButtonElement>) => void;
  onOpenResources: (e: MouseEvent<HTMLButtonElement>) => void;
  onBookExpertConsult: () => void;
};

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function LandingSiteFooter({
  onStart,
  onStartAlumni,
  onOpenApplicationRoadmap,
  onOpenResources,
  onBookExpertConsult,
}: Props) {
  const { t } = useLanguage();
  const showCounselorLogin = isSignedServiceEnabled();
  const year = new Date().getFullYear();

  return (
    <footer className="landing-site-footer" role="contentinfo">
      <div className="landing-site-footer__inner">
        <div className="landing-site-footer__brand">
          <BrandLogo className="landing-site-footer__logo" />
        </div>

        <nav className="landing-site-footer__col" aria-label={t("landingReplica.footerColProduct")}>
          <h2 className="landing-site-footer__heading">{t("landingReplica.footerColProduct")}</h2>
          <ul className="landing-site-footer__links">
            <li>
              <button type="button" className="landing-site-footer__link" onClick={onStart}>
                {t("app.welcome.start")}
              </button>
            </li>
            <li>
              <button type="button" className="landing-site-footer__link" onClick={onStartAlumni}>
                {t("landingReplica.footerAlumniFeedback")}
              </button>
            </li>
            <li>
              <button type="button" className="landing-site-footer__link" onClick={onOpenApplicationRoadmap}>
                {t("landingReplica.navSampleReport")}
              </button>
            </li>
            <li>
              <button type="button" className="landing-site-footer__link" onClick={onOpenResources}>
                {t("landingReplica.navResources")}
              </button>
            </li>
            <li>
              <button type="button" className="landing-site-footer__link" onClick={() => scrollToId("landing-faq")}>
                {t("landingReplica.navFaq")}
              </button>
            </li>
          </ul>
        </nav>

        <nav className="landing-site-footer__col" aria-label={t("landingReplica.footerColSupport")}>
          <h2 className="landing-site-footer__heading">{t("landingReplica.footerColSupport")}</h2>
          <ul className="landing-site-footer__links">
            <li>
              <button type="button" className="landing-site-footer__link" onClick={() => scrollToId("landing-booking")}>
                {t("landingReplica.heroBookConsult")}
              </button>
            </li>
            <li>
              <button type="button" className="landing-site-footer__link" onClick={onBookExpertConsult}>
                {t("landingReplica.footerContact")}
              </button>
            </li>
            <li>
              <a className="landing-site-footer__link" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </li>
          </ul>
        </nav>

        <nav className="landing-site-footer__col" aria-label={t("landingReplica.footerColTeam")}>
          <h2 className="landing-site-footer__heading">{t("landingReplica.footerColTeam")}</h2>
          <ul className="landing-site-footer__links">
            {showCounselorLogin ? (
              <li>
                <a className="landing-site-footer__link" href="#counselor">
                  {t("landingReplica.footerCounselorLogin")}
                </a>
              </li>
            ) : null}
            <li>
              <a className="landing-site-footer__link" href="#admin">
                {t("landingReplica.footerAdminLogin")}
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="landing-site-footer__bottom">
        <p className="landing-site-footer__copy">
          {t("landingReplica.footerCopyright", { year: String(year) })}
        </p>
        <LegalLinks className="landing-site-footer__legal" />
      </div>
    </footer>
  );
}
