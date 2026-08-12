import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../services/apiService";
import type { Client, FollowUp } from "../../types";

type SuivisClientsProps = {
  clients: Client[];
  followUps: FollowUp[];
  onRefresh: () => Promise<void>;
};

const emptyForm = {
  clientId: "",
  description: "",
  raisonParle: "",
  suivi: "",
  reponse: "",
  clientPhone: ""
};

export default function SuivisClients({ clients, followUps, onRefresh }: SuivisClientsProps) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const formOpen = showNewForm || editingId !== null;

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function closeForm() {
    resetForm();
    setShowNewForm(false);
  }

  function onClientChange(clientId: string) {
    const c = clients.find((x) => x._id === clientId);
    setForm((prev) => ({
      ...prev,
      clientId,
      clientPhone: c?.phone ?? prev.clientPhone
    }));
  }

  function loadRowForEdit(row: FollowUp) {
    setShowNewForm(false);
    setEditingId(row._id);
    setForm({
      clientId: row.client?._id ?? "",
      description: row.description ?? "",
      raisonParle: row.raisonParle ?? "",
      suivi: row.suivi ?? "",
      reponse: row.reponse ?? "",
      clientPhone: row.clientPhone ?? row.client?.phone ?? ""
    });
  }

  async function submit() {
    if (!form.clientId.trim()) {
      window.alert("Selectionnez un client.");
      return;
    }
    setSaving(true);
    try {
      const clientName = clients.find((c) => c._id === form.clientId)?.name ?? "";
      const title = `Suivi — ${clientName} — ${new Date().toLocaleDateString("fr-FR")}`;
      const body = {
        title,
        client: form.clientId,
        description: form.description.trim(),
        raisonParle: form.raisonParle.trim(),
        suivi: form.suivi.trim(),
        reponse: form.reponse.trim(),
        clientPhone: form.clientPhone.trim(),
        type: "Appel",
        status: "Ouvert",
        dueDate: new Date().toISOString()
      };
      if (editingId) {
        await api.put(`/followups/${editingId}`, body);
      } else {
        await api.post("/followups", body);
      }
      closeForm();
      await onRefresh();
    } catch {
      window.alert("Erreur lors de l'enregistrement du suivi.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id: string) {
    if (!window.confirm("Supprimer ce suivi ?")) return;
    try {
      await api.delete(`/followups/${id}`);
      if (editingId === id) closeForm();
      await onRefresh();
    } catch {
      window.alert("Suppression impossible.");
    }
  }

  return (
    <section className="suivis-clients-page">
      <header className="billing-header">
        <div>
          <h1>Suivis clients</h1>
          <p>Enregistrez les echanges, raisons et reponses pour chaque client.</p>
        </div>
        <button
          type="button"
          className="new-client-btn"
          onClick={() => {
            resetForm();
            setShowNewForm(true);
          }}
        >
          <Plus size={16} />
          Nouveau suivi
        </button>
      </header>

      {formOpen ? (
      <section className="settings-panel">
        <h2>{editingId ? "Modifier le suivi" : "Nouveau suivi"}</h2>
        <div className="settings-form-grid">
          <label>
            <span>Nom client</span>
            <select
              value={form.clientId}
              onChange={(e) => onClientChange(e.target.value)}
              aria-label="Nom du client"
            >
              <option value="">Selectionner un client</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Telephone</span>
            <input
              value={form.clientPhone}
              onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
              placeholder="Numero du client"
            />
          </label>
          <label className="span-2">
            <span>Description</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Contexte ou resume"
            />
          </label>
          <label className="span-2">
            <span>Raison de l&apos;appel / du contact</span>
            <textarea
              rows={2}
              value={form.raisonParle}
              onChange={(e) => setForm({ ...form, raisonParle: e.target.value })}
              placeholder="Pourquoi ce contact ?"
            />
          </label>
          <label className="span-2">
            <span>Suivi</span>
            <textarea
              rows={2}
              value={form.suivi}
              onChange={(e) => setForm({ ...form, suivi: e.target.value })}
              placeholder="Actions prevues ou effectuees"
            />
          </label>
          <label className="span-2">
            <span>Reponse</span>
            <textarea
              rows={2}
              value={form.reponse}
              onChange={(e) => setForm({ ...form, reponse: e.target.value })}
              placeholder="Retour du client ou conclusion"
            />
          </label>
        </div>
        <div className="invoice-actions">
          <button type="button" className="new-client-btn" onClick={() => void submit()} disabled={saving}>
            {saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Ajouter le suivi"}
          </button>
          <button type="button" className="reports-export-btn" onClick={closeForm}>
            Annuler
          </button>
        </div>
      </section>
      ) : null}

      <div className="table-responsive">
      <table className="crm-data-table suivis-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Description</th>
            <th>Raison</th>
            <th>Suivi</th>
            <th>Reponse</th>
            <th>Telephone</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {followUps.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted">
                Aucun suivi enregistre.
              </td>
            </tr>
          ) : (
            followUps.map((row) => (
              <tr key={row._id}>
                <td>
                  <strong>{row.client?.name ?? "—"}</strong>
                </td>
                <td className="suivis-cell-text">{row.description || "—"}</td>
                <td className="suivis-cell-text">{row.raisonParle || "—"}</td>
                <td className="suivis-cell-text">{row.suivi || "—"}</td>
                <td className="suivis-cell-text">{row.reponse || "—"}</td>
                <td>{row.clientPhone || row.client?.phone || "—"}</td>
                <td>{row.dueDate ? new Date(row.dueDate).toLocaleDateString("fr-FR") : "—"}</td>
                <td>
                  <div className="actions">
                    <button type="button" title="Modifier" onClick={() => loadRowForEdit(row)}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" title="Supprimer" onClick={() => void removeRow(row._id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </section>
  );
}
