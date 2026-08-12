import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Save, UserRound } from "lucide-react";
import { api } from "../../services/apiService";
import { setCurrentAuthUser, type AuthUser } from "../../services/authService";
import "./Profil.css";

type ProfilProps = {
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
};

export default function Profil({ user, onUserUpdated }: ProfilProps) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(user.fullName || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setFullName(user.fullName || "");
    setPhone(user.phone || "");
  }, [user]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (password && password !== confirm) {
      setMessage({ type: "err", text: "Les mots de passe ne correspondent pas." });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        fullName: fullName.trim(),
        phone: phone.trim()
      };
      if (password.trim()) payload.password = password.trim();
      const { data } = await api.put(`/users/${user._id}`, payload);
      const next: AuthUser = {
        _id: data._id,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || "",
        role: data.role
          ? { _id: data.role._id || data.role, name: data.role.name || user.role?.name || "—" }
          : user.role,
        active: data.active
      };
      setCurrentAuthUser(next);
      onUserUpdated(next);
      setPassword("");
      setConfirm("");
      setMessage({ type: "ok", text: "Profil mis a jour." });
    } catch {
      setMessage({ type: "err", text: "Impossible d'enregistrer le profil." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profil-page">
      <header className="profil-header">
        <div>
          <h1>{t("profile.title")}</h1>
          <p>{t("profile.subtitle")}</p>
        </div>
        <div className="profil-avatar" aria-hidden>
          <UserRound size={28} />
        </div>
      </header>

      <div className="profil-grid">
        <article className="profil-card profil-card--summary">
          <h2>{t("nav.login")}</h2>
          <p><strong>{t("common.name")} :</strong> {user.fullName}</p>
          <p><strong>{t("common.email")} :</strong> {user.email}</p>
          <p><strong>{t("profile.role")} :</strong> {user.role?.name || "—"}</p>
          <p><strong>{t("common.phone")} :</strong> {user.phone || "—"}</p>
        </article>

        <form className="profil-card" onSubmit={(e) => void handleSave(e)}>
          <h2>{t("profile.update")}</h2>
          <label>
            <span>{t("profile.fullName")}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label>
            <span>{t("common.email")}</span>
            <input type="email" value={user.email} readOnly />
          </label>
          <label>
            <span>{t("common.phone")}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+253 ..." />
          </label>
          <label>
            <span>{t("common.password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
            />
          </label>
          <label>
            <span>{t("common.password")}</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder=""
            />
          </label>
          {message ? (
            <p className={message.type === "ok" ? "profil-msg profil-msg--ok" : "profil-msg profil-msg--err"}>
              {message.text}
            </p>
          ) : null}
          <button type="submit" className="profil-save" disabled={saving}>
            <Save size={16} />
            {saving ? t("common.loading") : t("common.save")}
          </button>
        </form>
      </div>
    </section>
  );
}
