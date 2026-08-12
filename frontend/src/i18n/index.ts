import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

export const SUPPORTED_LANGS = ["fr", "en", "ar"] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

const STORAGE_KEY = "alh-lang";

function readStoredLang(): AppLang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en" || stored === "ar") return stored;
  } catch {
    /* ignore */
  }
  return "fr";
}

export function applyDocumentLang(lang: string) {
  const isRtl = lang === "ar";
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  document.body.classList.toggle("lang-rtl", isRtl);
  document.body.classList.toggle("lang-ltr", !isRtl);
}

const initialLang = readStoredLang();
applyDocumentLang(initialLang);

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    ar: { translation: ar }
  },
  lng: initialLang,
  fallbackLng: "fr",
  interpolation: { escapeValue: false }
});

i18n.on("languageChanged", (lng) => {
  applyDocumentLang(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
});

export default i18n;
