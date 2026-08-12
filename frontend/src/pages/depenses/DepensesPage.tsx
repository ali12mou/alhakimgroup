import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  FolderTree,
  Layers,
  Lock,
  Pencil,
  PieChart,
  Printer,
  Receipt,
  Trash2
} from "lucide-react";
import { api } from "../../services/apiService";
import type { Bank } from "../../types";
import "./DepensesPage.css";

export type DepensesSubTab = "categorie" | "depense" | "allocation" | "autres";

type DepensesPageProps = {
  sub: DepensesSubTab;
  onSubChange: (s: DepensesSubTab) => void;
  banks: Bank[];
};

const subNav: Array<{ key: DepensesSubTab; label: string; icon: typeof Receipt }> = [
  { key: "categorie", label: "Categorie depense", icon: FolderTree },
  { key: "depense", label: "Depense", icon: Receipt },
  { key: "allocation", label: "Allocation des depenses", icon: PieChart },
  { key: "autres", label: "Autres depenses", icon: Layers }
];

function formatDjf(amount: number) {
  return `DJF ${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format automatique : REF/YYYY-MM-DD/HH/mm */
function buildExpenseReference(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `REF/${yyyy}-${mm}-${dd}/${hh}/${min}`;
}

type ExpenseCategory = { id: string; name: string; description: string };
type ExpenseLine = {
  _id: string;
  reference: string;
  total: number;
  status: "Approuve" | "En attente" | "Rejete";
  expenseDate: string;
  bank: Bank;
  donor: string;
  responsible: string;
  reason: string;
};
type AllocationRow = {
  id: string;
  name: string;
  dateLabel: string;
  amount: number;
  typeLabel: string;
  locked: boolean;
};
type AutreDepense = {
  id: string;
  expenseId: string;
  date: string;
  amount: number;
  status: "En attente" | "Approuve";
};

const PAGE_OPTIONS = [5, 10, 25, 50] as const;

function PaginationFooter(props: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const { total, page, pageSize, onPage } = props;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  return (
    <div className="depenses-footer">
      <span>
        Affichage de {total === 0 ? 0 : start} a {end} sur {total} entrees
      </span>
      <div className="depenses-pagination">
        <button type="button" disabled={safePage <= 1} onClick={() => onPage(safePage - 1)} aria-label="Page precedente">
          &lt;
        </button>
        <button type="button" className="depenses-page-current" disabled>
          {safePage}
        </button>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPage(safePage + 1)}
          aria-label="Page suivante"
        >
          &gt;
        </button>
      </div>
    </div>
  );
}

function Toolbar(props: {
  pageSize: number;
  onPageSize: (n: number) => void;
  search: string;
  onSearch: (s: string) => void;
}) {
  return (
    <div className="depenses-toolbar">
      <div className="depenses-toolbar-left">
        <span>Afficher</span>
        <select
          value={props.pageSize}
          onChange={(e) => props.onPageSize(Number(e.target.value))}
          aria-label="Nombre de lignes par page"
        >
          {PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="depenses-search">
        <input
          type="search"
          placeholder="Rechercher ici"
          value={props.search}
          onChange={(e) => props.onSearch(e.target.value)}
          aria-label="Rechercher"
        />
      </div>
    </div>
  );
}

function CategoriesView() {
  const [rows, setRows] = useState<ExpenseCategory[]>([
    { id: "1", name: "Fishing Fleet", description: "-" },
    { id: "2", name: "Transportation", description: "-" }
  ]);
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  function resetPage() {
    setPage(1);
  }

  function addCategory() {
    const name = draftName.trim();
    if (!name) return;
    setRows((prev) => [
      ...prev,
      { id: String(Date.now()), name, description: draftDesc.trim() || "-" }
    ]);
    setDraftName("");
    setDraftDesc("");
    setShowAdd(false);
    resetPage();
  }

  function removeCategory(id: string) {
    if (!window.confirm("Supprimer cette categorie ?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    resetPage();
  }

  return (
    <div className="depenses-card">
      <div className="depenses-card-head">
        <h2>Gerer les Types de Depenses</h2>
        <div className="depenses-actions">
          <button type="button" className="depenses-btn depenses-btn--primary" onClick={() => setShowAdd((v) => !v)}>
            Ajouter Nouveau
          </button>
        </div>
      </div>

      {showAdd ? (
        <div className="depenses-add-form">
          <label>
            <span>Nom de la categorie</span>
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Ex. Marketing" />
          </label>
          <label>
            <span>Description</span>
            <input value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} placeholder="Optionnel" />
          </label>
          <div className="depenses-add-form-actions">
            <button type="button" className="depenses-btn depenses-btn--primary" onClick={addCategory}>
              Enregistrer
            </button>
            <button
              type="button"
              className="depenses-btn depenses-btn--ghost"
              onClick={() => {
                setShowAdd(false);
                setDraftName("");
                setDraftDesc("");
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      <Toolbar
        pageSize={pageSize}
        onPageSize={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        search={search}
        onSearch={(s) => {
          setSearch(s);
          setPage(1);
        }}
      />

      <div className="table-responsive">
        <table className="crm-data-table">
          <thead>
            <tr>
              <th>Categorie de depense</th>
              <th>Description</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="crm-empty">
                  Aucune categorie ne correspond a la recherche.
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>{r.description}</td>
                  <td>
                    <div className="depenses-icon-actions">
                      <button type="button" className="depenses-icon-btn depenses-icon-btn--edit" title="Modifier">
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="depenses-icon-btn depenses-icon-btn--delete"
                        title="Supprimer"
                        onClick={() => removeCategory(r.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationFooter total={filtered.length} page={safePage} pageSize={pageSize} onPage={setPage} />
    </div>
  );
}

function DepensesListeView({ banks }: { banks: Bank[] }) {
  const [rows, setRows] = useState<ExpenseLine[]>([]);
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewLine, setViewLine] = useState<ExpenseLine | null>(null);
  const [autoRef, setAutoRef] = useState(buildExpenseReference);
  const [draftAmount, setDraftAmount] = useState("");
  const [draftDate, setDraftDate] = useState(new Date().toISOString().slice(0, 10));
  const [draftBank, setDraftBank] = useState("");
  const [draftDonor, setDraftDonor] = useState("");
  const [draftResponsible, setDraftResponsible] = useState("");
  const [draftReason, setDraftReason] = useState("");

  useEffect(() => {
    if (!showAdd || editingId) return;
    setAutoRef(buildExpenseReference());
    const timer = window.setInterval(() => setAutoRef(buildExpenseReference()), 15_000);
    return () => window.clearInterval(timer);
  }, [showAdd, editingId]);

  async function loadExpenses() {
    const response = await api.get("/expenses/lines");
    setRows(response.data);
  }

  useEffect(() => {
    void loadExpenses();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.reference.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        r.expenseDate.includes(q) ||
        r.bank?.name?.toLowerCase().includes(q) ||
        r.donor?.toLowerCase().includes(q) ||
        r.responsible?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q) ||
        String(r.total).includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  async function addLine() {
    if (!draftBank || !draftDonor.trim() || !draftResponsible.trim() || !draftReason.trim()) {
      window.alert("Banque, donneur, responsable et raison sont obligatoires.");
      return;
    }
    const total = Number(draftAmount.replace(",", ".")) || 0;
    setSaving(true);
    try {
      const payload = {
        total,
        expenseDate: draftDate,
        bank: draftBank,
        donor: draftDonor.trim(),
        responsible: draftResponsible.trim(),
        reason: draftReason.trim()
      };
      if (editingId) {
        const response = await api.put(`/expenses/lines/${editingId}`, payload);
        setRows((prev) => prev.map((row) => (row._id === editingId ? response.data : row)));
      } else {
        const response = await api.post("/expenses/lines", payload);
        setRows((prev) => [response.data, ...prev]);
        setPage(1);
      }
      closeForm();
    } catch {
      window.alert("Impossible d'enregistrer la depense.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLine(id: string) {
    if (!window.confirm("Supprimer cette depense ?")) return;
    await api.delete(`/expenses/lines/${id}`);
    setRows((prev) => prev.filter((r) => r._id !== id));
    setPage(1);
  }

  function closeForm() {
    setShowAdd(false);
    setEditingId(null);
    setDraftAmount("");
    setDraftBank("");
    setDraftDonor("");
    setDraftResponsible("");
    setDraftReason("");
    setDraftDate(new Date().toISOString().slice(0, 10));
    setAutoRef(buildExpenseReference());
  }

  function openNewForm() {
    setViewLine(null);
    closeForm();
    setShowAdd(true);
  }

  function openEditForm(line: ExpenseLine) {
    setViewLine(null);
    setEditingId(line._id);
    setAutoRef(line.reference);
    setDraftAmount(String(line.total));
    setDraftDate(line.expenseDate.slice(0, 10));
    setDraftBank(line.bank?._id || "");
    setDraftDonor(line.donor || "");
    setDraftResponsible(line.responsible || "");
    setDraftReason(line.reason || "");
    setShowAdd(true);
  }

  return (
    <div className="depenses-card">
      <div className="depenses-card-head">
        <h2>Gerer les Depenses</h2>
        <div className="depenses-actions">
          <button type="button" className="depenses-btn depenses-btn--primary" onClick={openNewForm}>
            Ajouter Nouveau
          </button>
        </div>
      </div>

      {showAdd ? (
        <div className="depenses-add-form">
          <h3>{editingId ? "Modifier la depense" : "Nouvelle depense"}</h3>
          <label>
            <span>Reference (automatique)</span>
            <input value={autoRef} readOnly title="Generee automatiquement : REF/date/heure/minute" />
          </label>
          <label>
            <span>Montant total (DJF)</span>
            <input value={draftAmount} onChange={(e) => setDraftAmount(e.target.value)} placeholder="140" />
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
          </label>
          <label>
            <span>Compte banque *</span>
            <select value={draftBank} onChange={(e) => setDraftBank(e.target.value)}>
              <option value="">Selectionner une banque</option>
              {banks.map((bank) => (
                <option key={bank._id} value={bank._id}>
                  {bank.name} — {bank.accountNumberOrWallet || bank.iban}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Donneur *</span>
            <input
              value={draftDonor}
              onChange={(e) => setDraftDonor(e.target.value)}
              placeholder="Nom du donneur"
            />
          </label>
          <label>
            <span>Responsable *</span>
            <input
              value={draftResponsible}
              onChange={(e) => setDraftResponsible(e.target.value)}
              placeholder="Nom du responsable"
            />
          </label>
          <label className="depenses-form-wide">
            <span>Raison *</span>
            <textarea
              value={draftReason}
              onChange={(e) => setDraftReason(e.target.value)}
              placeholder="Raison de la depense"
              rows={3}
            />
          </label>
          <div className="depenses-add-form-actions">
            <button
              type="button"
              className="depenses-btn depenses-btn--primary"
              onClick={() => void addLine()}
              disabled={saving}
            >
              {saving ? "Enregistrement..." : editingId ? "Mettre a jour" : "Enregistrer"}
            </button>
            <button
              type="button"
              className="depenses-btn depenses-btn--ghost"
              onClick={closeForm}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {viewLine ? (
        <div className="depenses-detail">
          <div className="depenses-detail-head">
            <h3>Detail de la depense</h3>
            <button type="button" className="depenses-btn depenses-btn--ghost" onClick={() => setViewLine(null)}>
              Fermer
            </button>
          </div>
          <div className="depenses-detail-grid">
            <div><span>Reference</span><strong>{viewLine.reference}</strong></div>
            <div><span>Montant total</span><strong>{formatDjf(viewLine.total)}</strong></div>
            <div>
              <span>Banque</span>
              <strong>{viewLine.bank?.name || "-"}</strong>
              <small>{viewLine.bank?.accountNumberOrWallet || viewLine.bank?.iban || ""}</small>
            </div>
            <div><span>Donneur</span><strong>{viewLine.donor || "-"}</strong></div>
            <div><span>Responsable</span><strong>{viewLine.responsible || "-"}</strong></div>
            <div><span>Statut</span><strong>{viewLine.status}</strong></div>
            <div><span>Date</span><strong>{new Date(viewLine.expenseDate).toLocaleDateString("fr-FR")}</strong></div>
            <div className="depenses-detail-wide"><span>Raison</span><strong>{viewLine.reason || "-"}</strong></div>
          </div>
          <div className="depenses-add-form-actions">
            <button type="button" className="depenses-btn depenses-btn--primary" onClick={() => openEditForm(viewLine)}>
              Modifier
            </button>
          </div>
        </div>
      ) : null}

      <Toolbar
        pageSize={pageSize}
        onPageSize={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        search={search}
        onSearch={(s) => {
          setSearch(s);
          setPage(1);
        }}
      />

      <div className="table-responsive">
        <table className="crm-data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Reference</th>
              <th>Montant total</th>
              <th>Banque</th>
              <th>Donneur</th>
              <th>Responsable</th>
              <th>Raison</th>
              <th>Statut</th>
              <th>Date de la depense</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="crm-empty">
                  Aucune depense.
                </td>
              </tr>
            ) : (
              pageRows.map((r, i) => (
                <tr key={r._id}>
                  <td>{(safePage - 1) * pageSize + i + 1}</td>
                  <td className="crm-mono-id">{r.reference}</td>
                  <td>{formatDjf(r.total)}</td>
                  <td>
                    <strong>{r.bank?.name || "-"}</strong>
                    <small className="depenses-bank-account">
                      {r.bank?.accountNumberOrWallet || r.bank?.iban || ""}
                    </small>
                  </td>
                  <td>{r.donor || "-"}</td>
                  <td>{r.responsible || "-"}</td>
                  <td>{r.reason || "-"}</td>
                  <td>
                    <span
                      className={
                        r.status === "Approuve"
                          ? "depenses-badge depenses-badge--approved"
                          : r.status === "En attente"
                            ? "depenses-badge depenses-badge--pending"
                            : "depenses-badge"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>{new Date(r.expenseDate).toLocaleDateString("fr-FR")}</td>
                  <td>
                    <div className="depenses-icon-actions">
                      <button
                        type="button"
                        className="depenses-icon-btn depenses-icon-btn--view"
                        title="Voir"
                        onClick={() => {
                          closeForm();
                          setViewLine(r);
                        }}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        className="depenses-icon-btn depenses-icon-btn--edit"
                        title="Modifier"
                        onClick={() => openEditForm(r)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="depenses-icon-btn depenses-icon-btn--delete"
                        title="Supprimer"
                        onClick={() => void removeLine(r._id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationFooter total={filtered.length} page={safePage} pageSize={pageSize} onPage={setPage} />
    </div>
  );
}

function AllocationsView() {
  const [rows] = useState<AllocationRow[]>([
    {
      id: "1",
      name: "March_2026",
      dateLabel: "March_2026",
      amount: 500000,
      typeLabel: "Depenses recurrentes",
      locked: true
    }
  ]);
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.typeLabel.toLowerCase().includes(q) ||
        String(r.amount).includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  return (
    <div className="depenses-card">
      <div className="depenses-card-head">
        <h2>Gerer l&apos;attribution des depenses</h2>
        <div className="depenses-actions">
          <button type="button" className="depenses-btn depenses-btn--primary" onClick={() => window.alert("Formulaire d'ajout : a brancher sur l'API.")}>
            Ajouter Nouveau
          </button>
        </div>
      </div>

      <Toolbar
        pageSize={pageSize}
        onPageSize={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        search={search}
        onSearch={(s) => {
          setSearch(s);
          setPage(1);
        }}
      />

      <div className="table-responsive">
        <table className="crm-data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Date</th>
              <th>Montant</th>
              <th>Type d&apos;allocation</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                </td>
                <td>{r.dateLabel}</td>
                <td>{r.amount.toLocaleString("fr-FR")}</td>
                <td>
                  <span className="depenses-badge depenses-badge--allocation">{r.typeLabel}</span>
                </td>
                <td>
                  {r.locked ? (
                    <span className="depenses-locked">
                      <Lock size={16} aria-hidden />
                      Verrouille
                    </span>
                  ) : (
                    <div className="depenses-icon-actions">
                      <button type="button" className="depenses-icon-btn depenses-icon-btn--edit" title="Modifier">
                        <Pencil size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationFooter total={filtered.length} page={safePage} pageSize={pageSize} onPage={setPage} />
    </div>
  );
}

function AutresDepensesView() {
  const [rows, setRows] = useState<AutreDepense[]>([
    { id: "1", expenseId: "EXP00001", date: "2026-03-07", amount: 12000, status: "Approuve" },
    { id: "2", expenseId: "EXP00002", date: "2026-03-08", amount: 50000, status: "En attente" }
  ]);
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [draftAmount, setDraftAmount] = useState("");
  const [draftDate, setDraftDate] = useState(new Date().toISOString().slice(0, 10));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.expenseId.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        r.date.includes(q) ||
        String(r.amount).includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  function printListe() {
    window.print();
  }

  function addAutre() {
    const amount = Number(draftAmount.replace(",", ".")) || 0;
    const n = rows.length + 1;
    setRows((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        expenseId: `EXP${String(n + 2).padStart(5, "0")}`,
        date: draftDate,
        amount,
        status: "En attente"
      }
    ]);
    setDraftAmount("");
    setShowAdd(false);
    setPage(1);
  }

  function removeAutre(id: string) {
    if (!window.confirm("Supprimer cette depense ?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    setPage(1);
  }

  return (
    <div className="depenses-card">
      <div className="depenses-card-head">
        <h2>Gerer les autres depenses</h2>
        <div className="depenses-actions">
          <button type="button" className="depenses-btn depenses-btn--primary" onClick={printListe}>
            <Printer size={16} />
            Imprimer le service
          </button>
          <button type="button" className="depenses-btn depenses-btn--secondary" onClick={() => setShowAdd((v) => !v)}>
            Ajouter Nouveau...
          </button>
        </div>
      </div>

      {showAdd ? (
        <div className="depenses-add-form">
          <label>
            <span>Montant (DJF)</span>
            <input value={draftAmount} onChange={(e) => setDraftAmount(e.target.value)} placeholder="50000" />
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
          </label>
          <div className="depenses-add-form-actions">
            <button type="button" className="depenses-btn depenses-btn--primary" onClick={addAutre}>
              Enregistrer
            </button>
            <button
              type="button"
              className="depenses-btn depenses-btn--ghost"
              onClick={() => {
                setShowAdd(false);
                setDraftAmount("");
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      <Toolbar
        pageSize={pageSize}
        onPageSize={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        search={search}
        onSearch={(s) => {
          setSearch(s);
          setPage(1);
        }}
      />

      <div className="table-responsive">
        <table className="crm-data-table">
          <thead>
            <tr>
              <th>ID de depense</th>
              <th>Date de la depense</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="crm-empty">
                  Aucune autre depense.
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.id}>
                  <td className="crm-mono-id">{r.expenseId}</td>
                  <td>{r.date}</td>
                  <td>{formatDjf(r.amount)}</td>
                  <td>
                    <span
                      className={
                        r.status === "Approuve"
                          ? "depenses-badge depenses-badge--approved"
                          : "depenses-badge depenses-badge--pending"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <div className="depenses-icon-actions">
                      <button type="button" className="depenses-icon-btn depenses-icon-btn--view" title="Voir">
                        <Eye size={16} />
                      </button>
                      <button type="button" className="depenses-icon-btn depenses-icon-btn--edit" title="Modifier">
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="depenses-icon-btn depenses-icon-btn--delete"
                        title="Supprimer"
                        onClick={() => removeAutre(r.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                      <button type="button" className="depenses-icon-btn depenses-icon-btn--print" title="Imprimer">
                        <Printer size={16} />
                      </button>
                      <button type="button" className="depenses-icon-btn depenses-icon-btn--approve" title="Approuver">
                        <CheckCircle2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationFooter total={filtered.length} page={safePage} pageSize={pageSize} onPage={setPage} />
    </div>
  );
}

export default function DepensesPage({ sub, onSubChange, banks }: DepensesPageProps) {
  return (
    <section className="settings-page depenses-page">
      <header className="settings-page-header">
        <div>
          <h1>Depenses</h1>
          <p>Categories, depenses courantes, allocations analytiques et postes exceptionnels.</p>
        </div>
      </header>

      <nav className="settings-subnav" aria-label="Sous-menus depenses">
        {subNav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={sub === item.key ? "active" : ""}
              onClick={() => onSubChange(item.key)}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {sub === "categorie" && <CategoriesView />}
      {sub === "depense" && <DepensesListeView banks={banks} />}
      {sub === "allocation" && <AllocationsView />}
      {sub === "autres" && <AutresDepensesView />}
    </section>
  );
}

