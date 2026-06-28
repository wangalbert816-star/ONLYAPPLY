import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "./strings";
import { getString, interpolate } from "./strings";

const STORAGE_KEY = "college-strategy-locale";

export type Translate = (path: string, vars?: Record<string, string | number>) => string;

type LanguageContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translate;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "zh";
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s === "en" ? "en" : "zh";
    } catch {
      // localStorage can throw (Safari private mode, blocked cookies); never crash boot.
      return "zh";
    }
  });

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-Hans";
  }, [locale]);

  const t = useMemo(
    () => (path: string, vars?: Record<string, string | number>) => {
      const raw = getString(locale, path);
      return vars ? interpolate(raw, vars) : raw;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const c = useContext(LanguageContext);
  if (!c) throw new Error("useLanguage must be used within LanguageProvider");
  return c;
}
