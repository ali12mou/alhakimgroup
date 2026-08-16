import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { LogIn } from "lucide-react";
import LanguageSwitcher from "../../components/LanguageSwitcher/LanguageSwitcher";
import "./Login.css";

type LoginProps = {
  onLogin: (email: string, password: string) => Promise<void>;
};

export default function Login({ onLogin }: LoginProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("admin@geosomtech.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message || "")
          : "";
      setError(message || t("login.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1>{t("common.brand")}</h1>
          <p>{t("common.slogan")}</p>
        </div>
        <h2>{t("login.title")}</h2>
        <p className="login-hint">{t("login.hint")}</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="login-form">
          <label>
            <span>{t("common.email")}</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@alhakimgroup.com"
              required
            />
          </label>
          <label>
            <span>{t("common.password")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          {error ? <p className="login-error">{error}</p> : null}
          <button type="submit" className="login-submit" disabled={loading}>
            <LogIn size={16} />
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>
        <LanguageSwitcher variant="login" />
      </div>
    </div>
  );
}
