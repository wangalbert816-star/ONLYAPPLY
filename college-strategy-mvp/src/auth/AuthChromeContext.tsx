import { createContext, useContext, type ReactNode } from "react";

export type AuthChromeHandlers = {
  onSignIn: () => void;
  onOpenAccount: () => void;
};

const AuthChromeContext = createContext<AuthChromeHandlers | null>(null);

export function AuthChromeProvider({ value, children }: { value: AuthChromeHandlers; children: ReactNode }) {
  return <AuthChromeContext.Provider value={value}>{children}</AuthChromeContext.Provider>;
}

export function useAuthChrome(): AuthChromeHandlers {
  const ctx = useContext(AuthChromeContext);
  if (!ctx) throw new Error("useAuthChrome must be used within AuthChromeProvider");
  return ctx;
}
