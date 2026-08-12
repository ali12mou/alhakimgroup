import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import "./Login.css";

type LoginProps = {
  onLogin: (email: string, password: string) => Promise<void>;
};

export default function Login({ onLogin }: LoginProps) {
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
      setError(message || "Connexion impossible. Verifiez vos identifiants.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1>AL-HAKIM GROUP</h1>
          <p>L&apos;excellence au service de vos projets.</p>
        </div>
        <h2>Connexion</h2>
        <p className="login-hint">Accedez a votre espace CRM &amp; Ventes.</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="login-form">
          <label>
            <span>Email</span>
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
            <span>Mot de passe</span>
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
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
        <p className="login-footer">Compte demo : admin@geosomtech.com / admin123</p>
      </div>
    </div>
  );
}
