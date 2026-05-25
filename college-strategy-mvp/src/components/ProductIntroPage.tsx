import { BrandLogo } from "./BrandLogo";
import { ProductIntroContent } from "./ProductIntroContent";
import { useLanguage } from "../i18n/LanguageContext";
import "./ProductIntroPage.css";

type Props = {
  onBack: () => void;
  onStart: () => void;
};

export function ProductIntroPage({ onBack, onStart }: Props) {
  const { t } = useLanguage();

  return (
    <div className="app app--intro">
      <header className="intro-header">
        <button type="button" className="intro-back" onClick={onBack}>
          {t("productIntro.back")}
        </button>
        <BrandLogo className="intro-logo" />
      </header>

      <ProductIntroContent variant="page" />

      <div className="intro-cta card">
        <button type="button" className="btn btn-primary btn-block" onClick={onStart}>
          {t("productIntro.startCta")}
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={onBack}>
          {t("productIntro.back")}
        </button>
      </div>
    </div>
  );
}
