import { useLanguage } from "./LanguageContext";

export function LanguageToggle() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="lang-toggle" role="group" aria-label={t("lang.aria")}>
      <button
        type="button"
        className={`lang-toggle__btn${locale === "zh" ? " lang-toggle__btn--on" : ""}`}
        onClick={() => setLocale("zh")}
        aria-pressed={locale === "zh"}
      >
        {t("lang.zh")}
      </button>
      <span className="lang-toggle__sep" aria-hidden>
        |
      </span>
      <button
        type="button"
        className={`lang-toggle__btn${locale === "en" ? " lang-toggle__btn--on" : ""}`}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
      >
        {t("lang.en")}
      </button>
    </div>
  );
}
