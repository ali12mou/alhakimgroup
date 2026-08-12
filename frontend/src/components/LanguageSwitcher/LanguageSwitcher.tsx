import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { SUPPORTED_LANGS, type AppLang } from "../../i18n";
import "./LanguageSwitcher.css";

type Props = {
  variant?: "sidebar" | "login" | "compact";
};

export default function LanguageSwitcher({ variant = "sidebar" }: Props) {
  const { t, i18n } = useTranslation();
  const current = (SUPPORTED_LANGS.includes(i18n.language as AppLang)
    ? i18n.language
    : "fr") as AppLang;

  return (
    <div className={`lang-switcher lang-switcher--${variant}`} role="group" aria-label={t("common.language")}>
      {variant !== "compact" ? (
        <span className="lang-switcher-label">
          <Languages size={14} />
          {t("common.language")}
        </span>
      ) : null}
      <div className="lang-switcher-btns">
        {SUPPORTED_LANGS.map((code) => (
          <button
            key={code}
            type="button"
            className={current === code ? "active" : ""}
            onClick={() => void i18n.changeLanguage(code)}
            title={t(`lang.${code}`)}
            aria-pressed={current === code}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
