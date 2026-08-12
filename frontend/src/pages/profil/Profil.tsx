import { useEffect, useState, type FormEvent } from "react";
import { Save, UserRound } from "lucide-react";
import { api } from "../../services/apiService";
import { setCurrentAuthUser, type AuthUser } from "../../services/authService";
import "./Profil.css";

type ProfilProps = {
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
};

export default function Profil({ user, onUserUpdated }: ProfilProps) {
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
          <h1>Profil</h1>
          <p>Gerez vos informations personnelles et votre mot de passe.</p>
        </div>
        <div className="profil-avatar" aria-hidden>
          <UserRound size={28} />
        </div>
      </header>

      <div className="profil-grid">
        <article className="profil-card profil-card--summary">
          <h2>Compte</h2>
          <p><strong>Nom :</strong> {user.fullName}</p>
          <p><strong>Email :</strong> {user.email}</p>
          <p><strong>Role :</strong> {user.role?.name || "—"}</p>
          <p><strong>Telephone :</strong> {user.phone || "—"}</p>
        </article>

        <form className="profil-card" onSubmit={(e) => void handleSave(e)}>
          <h2>Modifier le profil</h2>
          <label>
            <span>Nom complet</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label>
            <span>Email</span>
            <input type="email" value={user.email} readOnly />
          </label>
          <label>
            <span>Telephone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+253 ..." />
          </label>
          <label>
            <span>Nouveau mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Laisser vide pour ne pas changer"
            />
          </label>
          <label>
            <span>Confirmer le mot de passe</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmation"
            />
          </label>
          {message ? (
            <p className={message.type === "ok" ? "profil-msg profil-msg--ok" : "profil-msg profil-msg--err"}>
              {message.text}
            </p>
          ) : null}
          <button type="submit" className="profil-save" disabled={saving}>
            <Save size={16} />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
      </div>
    </section>
  );
}
