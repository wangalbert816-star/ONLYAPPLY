import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { BrandWallBackground } from "./components/BrandWallBackground";
import { LanguageProvider } from "./i18n/LanguageContext";
import { LanguageToggle } from "./i18n/LanguageToggle";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <BrandWallBackground />
      <LanguageToggle />
      <App />
    </LanguageProvider>
  </StrictMode>,
);
