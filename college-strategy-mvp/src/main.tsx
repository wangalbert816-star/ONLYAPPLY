import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { BrandWallBackground } from "./components/BrandWallBackground";
import { LanguageProvider } from "./i18n/LanguageContext";
import { AuthProvider } from "./auth/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <BrandWallBackground />
        <App />
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>,
);
