import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { BrandWallBackground } from "./components/BrandWallBackground";
import { LanguageProvider } from "./i18n/LanguageContext";
import { AuthProvider } from "./auth/AuthContext";

const rootEl = document.getElementById("root")!;
rootEl.setAttribute("translate", "no");

createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <BrandWallBackground />
          <App />
        </AuthProvider>
      </LanguageProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
