import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  BarChart4,
  ClipboardList,
  Globe,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  Settings as SettingsIcon,
  Server,
  Trash2,
  Users,
  Eye,
  HandCoins,
  FileText,
  FileSpreadsheet,
  BriefcaseBusiness,
  Printer,
  FileDown,
  Shield,
  KeyRound,
  UserCog,
  UserRound,
  Wallet,
  X
} from "lucide-react";
import { api } from "./services/apiService";
import { useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/login/Login";
import ProfilPage from "./pages/profil/Profil";
import LanguageSwitcher from "./components/LanguageSwitcher/LanguageSwitcher";
import type {
  Bank,
  Client,
  ClientStatus,
  ClientType,
  Dashboard,
  FollowUp,
  InvoicePaymentDoc,
  PermissionDoc,
  ProformaRow,
  RoleDoc,
  Setting,
  UserDoc
} from "./types";
import { formatMoney, groupServicesByCategory, serviceLabel } from "./utils";
import { CLIENT_ACTIVITY_CATEGORIES } from "./constants/serviceCategories";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import DashboardPage from "./pages/dashboard/Dashboard";
import FacturesPage from "./pages/factures/Factures";
import ProformasPage from "./pages/proforma/Proformas";
import SuivisClientsPage from "./pages/suivis/SuivisClients";
import PaiementFacturePage from "./pages/paiement/PaiementFacture";
import DepensesPage, { type DepensesSubTab } from "./pages/depenses/DepensesPage";

function emptyNewClientForm() {
  return {
    clientType: "Entreprise" as ClientType,
    name: "",
    contactName: "",
    email: "",
    phone: "",
    location: "Djibouti",
    status: "Actif" as ClientStatus,
    serviceId: "",
    activityCategories: [] as string[]
  };
}

function emptyServiceForm() {
  return {
    name: "",
    description: "",
    price: ""
  };
}

function clientServiceName(client: Client): string {
  if (!client.service) return "";
  if (typeof client.service === "object" && ("designation" in client.service || "name" in client.service)) {
    return serviceLabel(client.service);
  }
  return "";
}

function clientActivityLabels(client: Client): string {
  const cats = client.activityCategories?.filter(Boolean) || [];
  return cats.length ? cats.join(", ") : "";
}

function toggleActivityCategory(categories: string[], category: string, checked: boolean) {
  if (checked) {
    return categories.includes(category) ? categories : [...categories, category];
  }
  return categories.filter((c) => c !== category);
}

function clientEntityNameKey(type: ClientType): string {
  if (type === "Gouvernemental") return "clients.entityGov";
  if (type === "Organisation") return "clients.entityOrg";
  if (type === "Particulier") return "clients.entityPerson";
  return "clients.entityCompany";
}

function nextServiceCode(existing: Array<{ code: string }>) {
  const max = existing.reduce((acc, s) => {
    const n = Number(String(s.code).replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `SRV-${String(max + 1).padStart(3, "0")}`;
}

type Tab =
  | "dashboard"
  | "clients"
  | "suivis"
  | "rapports"
  | "paiement-facture"
  | "facture"
  | "proforma"
  | "service"
  | "depenses"
  | "parametres"
  | "profil";

type ParametresSub = "configuration" | "banks" | "roles" | "permissions" | "users";

const defaultSettings: Setting = {
  companyName: "AL-HAKIM GROUP",
  companyEmail: "contact@geosomtech.com",
  companyPhone: "+253 XX XX XX XX",
  companyContactName: "",
  website: "https://geosomtech.com",
  address: "Djibouti",
  currency: "FDJ",
  expirationAlertEnabled: true,
  expirationAlertDays: 60,
  defaultBank: null,
  bankName: "",
  bankAccountHolder: "",
  bankIban: "",
  bankSwift: "",
  documentHeader: "",
  documentFooter: "",
  logoDataUrl: ""
};

function defaultBankSelectValue(s: Setting) {
  const r = s.defaultBank;
  if (!r) return "";
  if (typeof r === "object" && "_id" in r) return (r as Bank)._id;
  return String(r);
}

const navItems = [
  { key: "dashboard" as Tab, labelKey: "nav.dashboard", icon: LayoutGrid },
  { key: "clients" as Tab, labelKey: "nav.clients", icon: Users },
  { key: "suivis" as Tab, labelKey: "nav.followups", icon: ClipboardList },
  { key: "rapports" as Tab, labelKey: "nav.reports", icon: BarChart3 },
  { key: "paiement-facture" as Tab, labelKey: "nav.invoicePayment", icon: HandCoins },
  { key: "facture" as Tab, labelKey: "nav.invoice", icon: FileText },
  { key: "proforma" as Tab, labelKey: "nav.proforma", icon: FileSpreadsheet },
  { key: "service" as Tab, labelKey: "nav.service", icon: BriefcaseBusiness },
  { key: "depenses" as Tab, labelKey: "nav.expenses", icon: Wallet },
  { key: "parametres" as Tab, labelKey: "nav.settings", icon: SettingsIcon }
];

export default function App() {
  const { t } = useTranslation();
  const { user, isAuthenticated, login, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [authView, setAuthView] = useState<"app" | "login">("app");
  const [navOpen, setNavOpen] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [settings, setSettings] = useState<Setting>(defaultSettings);
  const [settingsSaveState, setSettingsSaveState] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientSaving, setNewClientSaving] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [newClientForm, setNewClientForm] = useState(emptyNewClientForm);
  const [services, setServices] = useState<
    Array<{
      _id: string;
      code: string;
      name: string;
      designation?: string;
      category?: string;
      description?: string;
      price: number;
    }>
  >([]);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [invoices, setInvoices] = useState<
    Array<{
      _id: string;
      invoiceId: string;
      reference: string;
      invoiceType?: string;
      client?: string | { _id: string };
      clientName: string;
      company: string;
      phone?: string;
      domainName?: string;
      expirationDate?: string | null;
      bank?: string | { _id: string };
      bankName: string;
      bankAccountNumber?: string;
      bankAccountHolder?: string;
      bankIban?: string;
      bankSwift?: string;
      amount?: number;
      remisePercent?: number;
      date: string;
      paymentStatus: string;
      paymentMethod: string;
      isValidated?: boolean;
      lines?: Array<{
        designation: string;
        description: string;
        quantite: number;
        prixUnitaire: number;
        montant: number;
      }>;
    }>
  >([]);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePaymentDoc[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankForm, setBankForm] = useState({
    name: "",
    accountNumberOrWallet: "",
    description: ""
  });
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankSaving, setBankSaving] = useState(false);
  const [permissions, setPermissions] = useState<PermissionDoc[]>([]);
  const [roles, setRoles] = useState<RoleDoc[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [proformas, setProformas] = useState<ProformaRow[]>([]);
  const [proformaToEdit, setProformaToEdit] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("openProformaId");
    } catch {
      return null;
    }
  });
  const [parametresSub, setParametresSub] = useState<ParametresSub>("configuration");
  const [depensesSub, setDepensesSub] = useState<DepensesSubTab>("categorie");
  const [newRole, setNewRole] = useState({ name: "", description: "", permissionIds: [] as string[] });
  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    roleId: "",
    active: true
  });
  const [newPermission, setNewPermission] = useState({
    key: "",
    label: "",
    category: "general"
  });

  async function loadAll() {
    const results = await Promise.allSettled([
      api.get("/dashboard"),
      api.get("/clients"),
      api.get("/followups"),
      api.get("/settings"),
      api.get("/billing/services"),
      api.get("/billing/invoices"),
      api.get("/billing/banks"),
      api.get("/permissions"),
      api.get("/roles"),
      api.get("/users"),
      api.get("/billing/proformas"),
      api.get("/billing/invoice-payments")
    ]);

    const dataOf = <T,>(index: number): T | undefined => {
      const r = results[index];
      return r.status === "fulfilled" ? (r.value.data as T) : undefined;
    };

    const d = dataOf<Dashboard>(0);
    const c = dataOf<Client[]>(1);
    const f = dataOf<FollowUp[]>(2);
    const s = dataOf<Partial<Setting>>(3);
    const servicesRes = dataOf<Array<{ _id: string; code: string; name: string; description?: string; price: number }>>(4);
    const invoicesRes = dataOf<typeof invoices>(5);
    const banksRes = dataOf<Bank[]>(6);
    const permsRes = dataOf<PermissionDoc[]>(7);
    const rolesRes = dataOf<RoleDoc[]>(8);
    const usersRes = dataOf<UserDoc[]>(9);
    const proformasRes = dataOf<ProformaRow[]>(10);
    const paymentsRes = dataOf<InvoicePaymentDoc[]>(11);

    if (d) setDashboard(d);
    if (c) setClients(c);
    if (f) setFollowUps(f);
    if (s) setSettings({ ...defaultSettings, ...s });
    if (servicesRes) setServices(servicesRes);
    if (invoicesRes) setInvoices(invoicesRes);
    if (banksRes) setBanks(banksRes);
    if (permsRes) setPermissions(permsRes);
    if (rolesRes) setRoles(rolesRes);
    if (usersRes) setUsers(usersRes);
    if (proformasRes) setProformas(proformasRes);
    if (paymentsRes) setInvoicePayments(paymentsRes);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (tab === "proforma") {
      void loadAll();
    }
  }, [tab]);

  useEffect(() => {
    if (navOpen) {
      document.body.classList.add("nav-drawer-open");
    } else {
      document.body.classList.remove("nav-drawer-open");
    }
    return () => document.body.classList.remove("nav-drawer-open");
  }, [navOpen]);

  const maxTopClientDev = useMemo(
    () => Math.max(...(dashboard?.topClients.map((c) => c.dev) || [1])),
    [dashboard]
  );

  async function saveSettings() {
    setIsSavingSettings(true);
    setSettingsSaveState(null);
    const body = { ...settings };
    const db = body.defaultBank;
    if (db && typeof db === "object" && "_id" in db) {
      body.defaultBank = (db as Bank)._id;
    }
    try {
      await api.put("/settings", body);
      await loadAll();
      setSettingsSaveState({ type: "success", message: "Configuration enregistree avec succes." });
    } catch (error: unknown) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Echec de sauvegarde. Verifiez les donnees puis reessayez.";
      setSettingsSaveState({ type: "error", message: msg || "Echec de sauvegarde." });
    } finally {
      setIsSavingSettings(false);
    }
  }

  function resetBankForm() {
    setBankForm({ name: "", accountNumberOrWallet: "", description: "" });
    setEditingBankId(null);
  }

  async function saveBank() {
    const name = bankForm.name.trim();
    const accountNumberOrWallet = bankForm.accountNumberOrWallet.trim();
    if (!name || !accountNumberOrWallet) {
      window.alert("Le nom de la banque et le numero de compte/wallet sont obligatoires.");
      return;
    }
    setBankSaving(true);
    try {
      const payload = {
        name,
        accountNumberOrWallet,
        description: bankForm.description.trim()
      };
      if (editingBankId) {
        await api.put(`/billing/banks/${editingBankId}`, payload);
      } else {
        await api.post("/billing/banks", payload);
      }
      resetBankForm();
      await loadAll();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data.message
          : "Impossible d'enregistrer la banque.";
      window.alert(message);
    } finally {
      setBankSaving(false);
    }
  }

  function editBank(bank: Bank) {
    setEditingBankId(bank._id);
    setBankForm({
      name: bank.name,
      accountNumberOrWallet: bank.accountNumberOrWallet || bank.iban || "",
      description: bank.description || ""
    });
    setParametresSub("banks");
  }

  async function deleteBank(id: string) {
    if (!window.confirm("Supprimer cette banque ?")) return;
    try {
      await api.delete(`/billing/banks/${id}`);
      if (editingBankId === id) resetBankForm();
      await loadAll();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data.message
          : "Impossible de supprimer la banque.";
      window.alert(message);
    }
  }

  async function createRole() {
    if (!newRole.name.trim()) return;
    await api.post("/roles", {
      name: newRole.name.trim(),
      description: newRole.description.trim(),
      permissions: newRole.permissionIds
    });
    setNewRole({ name: "", description: "", permissionIds: [] });
    await loadAll();
  }

  async function deleteRole(id: string) {
    if (!window.confirm("Supprimer ce role ?")) return;
    await api.delete(`/roles/${id}`);
    await loadAll();
  }

  async function createUser() {
    if (!newUser.fullName.trim() || !newUser.email.trim() || !newUser.roleId) return;
    await api.post("/users", {
      fullName: newUser.fullName.trim(),
      email: newUser.email.trim(),
      phone: newUser.phone.trim(),
      password: newUser.password || undefined,
      role: newUser.roleId,
      active: newUser.active
    });
    setNewUser({
      fullName: "",
      email: "",
      phone: "",
      password: "",
      roleId: "",
      active: true
    });
    await loadAll();
  }

  async function deleteUser(id: string) {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    await api.delete(`/users/${id}`);
    await loadAll();
  }

  async function createPermission() {
    if (!newPermission.key.trim() || !newPermission.label.trim()) return;
    await api.post("/permissions", {
      key: newPermission.key.trim(),
      label: newPermission.label.trim(),
      category: newPermission.category.trim() || "general"
    });
    setNewPermission({ key: "", label: "", category: "general" });
    await loadAll();
  }

  function exportReportCsv() {
    if (!dashboard) return;
    const rows = [
      ["AL-HAKIM GROUP CRM - Rapport global"],
      [`Genere le,${new Date().toLocaleDateString("fr-FR")}`],
      [],
      ["Indicateur", "Valeur"],
      ["CA Total Developpement", String(dashboard.caDevelopment)],
      ["CA Annuel Recurrent", String(dashboard.caAnnual)],
      ["Total clients", String(dashboard.totalClients)],
      ["Total suivis", String(dashboard.totalFollowUps)],
      ["Panier moyen", String(dashboard.averageRevenuePerClient)],
      [],
      [
        "Client",
        "Domaine",
        "Statut",
        "Hosting",
        "Maintenance",
        "Suivis",
        "CA Dev",
        "CA Annuel",
        "Total"
      ]
    ];
    reportClientRows.forEach((row) => {
      rows.push([
        row.client,
        row.domaine,
        row.statut,
        row.hosting,
        row.maintenance,
        String(row.suivi),
        String(row.dev),
        String(row.annuel),
        String(row.total)
      ]);
    });

    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rapport-crm-al-hakim-group.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportReportPdf() {
    if (!dashboard) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFillColor(16, 28, 78);
    doc.rect(0, 0, 297, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("Rapport executif CRM - AL-HAKIM GROUP", 14, 15);
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(10);
    doc.text(`Date de generation: ${new Date().toLocaleDateString("fr-FR")}`, 14, 31);

    autoTable(doc, {
      startY: 36,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [16, 28, 78] },
      head: [["Indicateur", "Valeur"]],
      body: [
        ["CA developpement", formatMoney(dashboard.caDevelopment, settings.currency)],
        ["CA annuel recurrent", formatMoney(dashboard.caAnnual, settings.currency)],
        ["Total clients", String(dashboard.totalClients)],
        ["Total suivis", String(dashboard.totalFollowUps)],
        ["Panier moyen", formatMoney(dashboard.averageRevenuePerClient, settings.currency)]
      ]
    });

    autoTable(doc, {
      startY: (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
        ? ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 52) + 8
        : 72,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.6 },
      headStyles: { fillColor: [30, 41, 59] },
      head: [[
        "Client",
        "Domaine",
        "Statut",
        "Hosting",
        "Maintenance",
        "Suivis",
        "CA Dev",
        "CA Annuel",
        "Total"
      ]],
      body: reportClientRows.map((row) => [
        row.client,
        row.domaine,
        row.statut,
        row.hosting,
        row.maintenance,
        String(row.suivi),
        formatMoney(row.dev, settings.currency),
        formatMoney(row.annuel, settings.currency),
        formatMoney(row.total, settings.currency)
      ])
    });

    doc.save(`rapport-pro-al-hakim-group-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportReportExcel() {
    if (!dashboard) return;
    const wb = XLSX.utils.book_new();
    const generated = new Date().toLocaleDateString("fr-FR");

    const wsSummary = XLSX.utils.aoa_to_sheet([
      ["AL-HAKIM GROUP - Rapport executif CRM"],
      [`Date de generation: ${generated}`],
      [],
      ["Indicateur", "Valeur"],
      ["CA developpement", dashboard.caDevelopment],
      ["CA annuel recurrent", dashboard.caAnnual],
      ["Total clients", dashboard.totalClients],
      ["Total suivis", dashboard.totalFollowUps],
      ["Panier moyen", dashboard.averageRevenuePerClient]
    ]);
    wsSummary["!cols"] = [{ wch: 34 }, { wch: 22 }];

    const wsClients = XLSX.utils.json_to_sheet(
      reportClientRows.map((row) => ({
        Client: row.client,
        Domaine: row.domaine,
        Statut: row.statut,
        Hosting: row.hosting,
        Maintenance: row.maintenance,
        Suivis: row.suivi,
        "CA Dev": row.dev,
        "CA Annuel": row.annuel,
        Total: row.total
      }))
    );
    wsClients["!cols"] = [
      { wch: 28 },
      { wch: 32 },
      { wch: 12 },
      { wch: 10 },
      { wch: 13 },
      { wch: 9 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 }
    ];
    wsClients["!autofilter"] = { ref: "A1:I1" };

    XLSX.utils.book_append_sheet(wb, wsSummary, "Synthese");
    XLSX.utils.book_append_sheet(wb, wsClients, "Portefeuille clients");
    XLSX.writeFile(wb, `rapport-pro-al-hakim-group-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function submitNewClient() {
    const name = newClientForm.name.trim();
    const contactName = newClientForm.contactName.trim();
    if (!name || !contactName) {
      alert("Le nom de l'entite et la personne de contact sont obligatoires.");
      return;
    }
    setNewClientSaving(true);
    try {
      const payload = {
        clientType: newClientForm.clientType,
        name,
        contactName,
        domain: "",
        email: newClientForm.email.trim(),
        phone: newClientForm.phone.trim(),
        location: newClientForm.location.trim() || "Djibouti",
        priceDev: 0,
        priceAnnual: 0,
        status: newClientForm.status,
        service: newClientForm.serviceId || null,
        activityCategories: newClientForm.activityCategories,
        hosting: false,
        maintenance: false
      };
      const response = editingClientId
        ? await api.put(`/clients/${editingClientId}`, payload)
        : await api.post("/clients", payload);
      if (selectedClient?._id === editingClientId) {
        setSelectedClient(response.data);
      }
      setNewClientForm(emptyNewClientForm());
      setEditingClientId(null);
      setShowNewClientForm(false);
      await loadAll();
    } catch {
      alert(
        editingClientId
          ? "Impossible de modifier le client. Verifiez les donnees et reessayez."
          : "Impossible de creer le client. Verifiez les donnees et reessayez."
      );
    } finally {
      setNewClientSaving(false);
    }
  }

  function openEditClient(client: Client) {
    const serviceId =
      typeof client.service === "object" && client.service
        ? client.service._id
        : typeof client.service === "string"
          ? client.service
          : "";
    setEditingClientId(client._id);
    setNewClientForm({
      clientType: client.clientType || "Entreprise",
      name: client.name,
      contactName: client.contactName || "",
      email: client.email || "",
      phone: client.phone || "",
      location: client.location || "Djibouti",
      status: client.status,
      serviceId,
      activityCategories: [...(client.activityCategories || [])]
    });
    setShowNewClientForm(true);
    setSelectedClient(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteClient(id: string) {
    if (!window.confirm("Supprimer ce client ?")) return;
    await api.delete(`/clients/${id}`);
    setSelectedClient((current) => (current?._id === id ? null : current));
    await loadAll();
  }

  function printClient(client: Client) {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      alert("Impossible d'ouvrir la fenetre d'impression.");
      return;
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Fiche client - ${client.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            p { margin: 0 0 14px; color: #6b7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
            td:first-child { width: 35%; color: #374151; font-weight: 600; background: #f9fafb; }
          </style>
        </head>
        <body>
          <h1>${client.name}</h1>
          <p>Fiche client - AL-HAKIM GROUP CRM</p>
          <table>
            <tr><td>Type de client</td><td>${client.clientType || "Entreprise"}</td></tr>
            <tr><td>Nom de l'entite</td><td>${client.name}</td></tr>
            <tr><td>Personne de contact</td><td>${client.contactName || "-"}</td></tr>
            <tr><td>Email</td><td>${client.email || "-"}</td></tr>
            <tr><td>Telephone</td><td>${client.phone || "-"}</td></tr>
            <tr><td>Localisation</td><td>${client.location || "-"}</td></tr>
            <tr><td>Domaines d'activite</td><td>${clientActivityLabels(client) || "-"}</td></tr>
            <tr><td>Service</td><td>${clientServiceName(client) || "-"}</td></tr>
            <tr><td>Statut</td><td>${client.status}</td></tr>
          </table>
          <script>
            window.onload = () => { window.print(); window.onafterprint = () => window.close(); };
          </script>
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
  }

  function exportClientPdf(client: Client) {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Fiche client - ${client.name}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString("fr-FR")}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [["Champ", "Valeur"]],
      body: [
        ["Type de client", client.clientType || "Entreprise"],
        ["Nom de l'entite", client.name],
        ["Personne de contact", client.contactName || "-"],
        ["Email", client.email || "-"],
        ["Telephone", client.phone || "-"],
        ["Localisation", client.location || "-"],
        ["Domaines d'activite", clientActivityLabels(client) || "-"],
        ["Service", clientServiceName(client) || "-"],
        ["Statut", client.status]
      ]
    });
    doc.save(`client-${client.name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  }

  async function submitService() {
    const name = serviceForm.name.trim();
    if (!name) {
      alert("Le nom du service est obligatoire.");
      return;
    }
    const description = serviceForm.description.trim();
    const price =
      serviceForm.price.trim() === "" ? 0 : Math.max(0, Number(serviceForm.price) || 0);
    setServiceSaving(true);
    try {
      let saved: { _id: string; code: string; name: string; description?: string; price: number };
      if (editingServiceId) {
        const res = await api.put(`/billing/services/${editingServiceId}`, {
          designation: name,
          name,
          description,
          price
        });
        saved = res.data;
        setServices((prev) => prev.map((s) => (s._id === saved._id ? saved : s)));
      } else {
        const res = await api.post("/billing/services", {
          code: nextServiceCode(services),
          designation: name,
          name,
          description,
          price
        });
        saved = res.data;
        setServices((prev) => [saved, ...prev.filter((s) => s._id !== saved._id)]);
      }
      setServiceForm(emptyServiceForm());
      setEditingServiceId(null);
      setShowServiceForm(false);
      try {
        await loadAll();
      } catch {
        // Le tableau est deja a jour via la reponse API
      }
    } catch (error: unknown) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
          "string"
          ? (error as { response: { data: { message: string } } }).response.data.message
          : "Impossible d'enregistrer le service. Verifiez que le backend tourne (port 5000).";
      alert(msg);
    } finally {
      setServiceSaving(false);
    }
  }

  function openNewServiceForm() {
    setEditingServiceId(null);
    setServiceForm(emptyServiceForm());
    setShowServiceForm(true);
  }

  function openEditService(service: {
    _id: string;
    name: string;
    designation?: string;
    description?: string;
    price: number;
  }) {
    setEditingServiceId(service._id);
    setServiceForm({
      name: serviceLabel(service),
      description: service.description || "",
      price: service.price ? String(service.price) : ""
    });
    setShowServiceForm(true);
  }

  async function deleteService(id: string) {
    if (!window.confirm("Supprimer ce service ?")) return;
    await api.delete(`/billing/services/${id}`);
    await loadAll();
  }

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const query = clientSearch.toLowerCase();
      const activity = (client.activityCategories || []).join(" ").toLowerCase();
      const matchesSearch =
        !query ||
        client.name.toLowerCase().includes(query) ||
        (client.contactName || "").toLowerCase().includes(query) ||
        (client.clientType || "").toLowerCase().includes(query) ||
        activity.includes(query) ||
        clientServiceName(client).toLowerCase().includes(query);
      const matchesStatus = !clientStatusFilter || client.status === clientStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clientSearch, clientStatusFilter, clients]);

  const followUpsByClientName = useMemo(() => {
    return followUps.reduce<Record<string, number>>((acc, item) => {
      const key = item.client?.name || "";
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [followUps]);

  const reportClientRows = useMemo(() => {
    return clients
      .map((client) => ({
        client: client.name,
        domaine: client.domain,
        statut: client.status,
        hosting: client.hosting ? "Oui" : "Non",
        maintenance: client.maintenance ? "Oui" : "Non",
        suivi: followUpsByClientName[client.name] || 0,
        dev: Number(client.priceDev || 0),
        annuel: Number(client.priceAnnual || 0),
        total: Number(client.priceDev || 0) + Number(client.priceAnnual || 0)
      }))
      .sort((a, b) => b.total - a.total);
  }, [clients, followUpsByClientName]);

  const currentNavLabel =
    tab === "profil"
      ? t("nav.profile")
      : t(navItems.find((n) => n.key === tab)?.labelKey ?? "common.brand");

  if (!isAuthenticated || authView === "login") {
    return (
      <LoginPage
        onLogin={async (email, password) => {
          await login(email, password);
          setAuthView("app");
          setTab("dashboard");
        }}
      />
    );
  }

  return (
    <div className={`layout${navOpen ? " layout--nav-open" : ""}`}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label={t("common.closeMenu")}
        onClick={() => setNavOpen(false)}
      />
      <aside className="sidebar" aria-label={t("common.mainNav")}>
        <div className="sidebar-head">
          <div className="sidebar-brand">
            <h2>{t("common.brand")}</h2>
            <p>{t("common.tagline")}</p>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            aria-label={t("common.closeMenu")}
            onClick={() => setNavOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTab(item.key);
                  setNavOpen(false);
                }}
                className={tab === item.key ? "active" : ""}
              >
                <span className="nav-item">
                  <Icon size={16} className="nav-icon" />
                  <span>{t(item.labelKey)}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <LanguageSwitcher variant="sidebar" />
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{user?.fullName || t("common.user")}</strong>
            <span>{user?.role?.name || user?.email || ""}</span>
          </div>
          <button
            type="button"
            className={tab === "profil" ? "active" : ""}
            onClick={() => {
              setTab("profil");
              setNavOpen(false);
            }}
          >
            <span className="nav-item">
              <UserRound size={16} className="nav-icon" />
              <span>{t("nav.profile")}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              setAuthView("login");
              setNavOpen(false);
            }}
          >
            <span className="nav-item">
              <LogOut size={16} className="nav-icon" />
              <span>{t("nav.logout")}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              setAuthView("login");
              setNavOpen(false);
            }}
          >
            <span className="nav-item">
              <LogIn size={16} className="nav-icon" />
              <span>{t("nav.login")}</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="layout-shell">
        <header className="mobile-top-bar">
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label={t("common.openMenu")}
            onClick={() => setNavOpen(true)}
          >
            <Menu size={22} />
          </button>
          <span className="mobile-top-bar-title">{currentNavLabel}</span>
        </header>
        <main className="content">
        {tab === "profil" && user ? (
          <ProfilPage user={user} onUserUpdated={refreshUser} />
        ) : null}

        {tab === "dashboard" && (
          <DashboardPage
            onNavigate={(next) => {
              setTab(next);
              setNavOpen(false);
            }}
          />
        )}

        {tab === "clients" && (
          <section className="clients-page">
            <header className="clients-header">
              <div>
                <h1>{t("clients.title")}</h1>
                <p>{t("clients.count", { count: clients.length })}</p>
              </div>
              <button
                type="button"
                className="new-client-btn"
                onClick={() => {
                  setEditingClientId(null);
                  setNewClientForm(emptyNewClientForm());
                  setShowNewClientForm(true);
                }}
              >
                <Plus size={16} />
                {t("clients.new")}
              </button>
            </header>

            {showNewClientForm && (
              <div className="settings-panel clients-new-panel">
                <h2>{editingClientId ? t("clients.edit") : t("clients.new")}</h2>
                <div className="settings-form-grid">
                  <label>
                    <span>{t("clients.clientType")} *</span>
                    <select
                      value={newClientForm.clientType}
                      onChange={(e) =>
                        setNewClientForm((f) => ({
                          ...f,
                          clientType: e.target.value as ClientType
                        }))
                      }
                    >
                      <option value="Organisation">{t("clients.organisation")}</option>
                      <option value="Gouvernemental">{t("clients.governmental")}</option>
                      <option value="Entreprise">{t("clients.company")}</option>
                      <option value="Particulier">{t("clients.individual")}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t(clientEntityNameKey(newClientForm.clientType))}</span>
                    <input
                      value={newClientForm.name}
                      onChange={(e) => setNewClientForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={
                        newClientForm.clientType === "Particulier"
                          ? "Ex. Ahmed Ali"
                          : "Ex. Acme Corp"
                      }
                      autoComplete="organization"
                    />
                  </label>
                  <label>
                    <span>{t("clients.contactName")} *</span>
                    <input
                      value={newClientForm.contactName}
                      onChange={(e) =>
                        setNewClientForm((f) => ({ ...f, contactName: e.target.value }))
                      }
                      placeholder="Ex. Mohamed Hassan"
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={newClientForm.email}
                      onChange={(e) => setNewClientForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="contact@exemple.com"
                    />
                  </label>
                  <label>
                    <span>{t("common.phone")}</span>
                    <input
                      value={newClientForm.phone}
                      onChange={(e) => setNewClientForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+253 ..."
                    />
                  </label>
                  <label className="span-2">
                    <span>{t("clients.location")}</span>
                    <input
                      value={newClientForm.location}
                      onChange={(e) => setNewClientForm((f) => ({ ...f, location: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>{t("common.status")}</span>
                    <select
                      value={newClientForm.status}
                      onChange={(e) =>
                        setNewClientForm((f) => ({ ...f, status: e.target.value as ClientStatus }))
                      }
                    >
                      <option value="Actif">{t("common.active")}</option>
                      <option value="Prospect">{t("common.prospect")}</option>
                      <option value="Inactif">{t("common.inactive")}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t("clients.serviceDesignation")}</span>
                    <select
                      value={newClientForm.serviceId}
                      onChange={(e) => {
                        const serviceId = e.target.value;
                        setNewClientForm((f) => ({
                          ...f,
                          serviceId
                        }));
                      }}
                    >
                      <option value="">{t("clients.noService")}</option>
                      {groupServicesByCategory(
                        newClientForm.activityCategories.length
                          ? services.filter((s) =>
                              newClientForm.activityCategories.includes(s.category || "")
                            )
                          : services
                      ).map(([category, items]) => (
                        <optgroup key={category} label={category}>
                          {items.map((s) => (
                            <option key={s._id} value={s._id}>
                              {serviceLabel(s)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <div className="span-2 clients-activity-block">
                    <span className="clients-activity-label">{t("clients.activityDomains")}</span>
                    <div className="clients-activity-checks">
                      {CLIENT_ACTIVITY_CATEGORIES.map((category) => (
                        <label key={category} className="check-row">
                          <input
                            type="checkbox"
                            checked={newClientForm.activityCategories.includes(category)}
                            onChange={(e) =>
                              setNewClientForm((f) => ({
                                ...f,
                                activityCategories: toggleActivityCategory(
                                  f.activityCategories,
                                  category,
                                  e.target.checked
                                )
                              }))
                            }
                          />
                          <span>{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="settings-actions clients-new-actions">
                  <button
                    type="button"
                    className="clients-cancel-btn"
                    disabled={newClientSaving}
                    onClick={() => {
                      setShowNewClientForm(false);
                      setEditingClientId(null);
                      setNewClientForm(emptyNewClientForm());
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="new-client-btn"
                    disabled={newClientSaving}
                    onClick={() => void submitNewClient()}
                  >
                    {newClientSaving
                      ? "Enregistrement..."
                      : editingClientId
                        ? "Mettre a jour le client"
                        : "Enregistrer le client"}
                  </button>
                </div>
              </div>
            )}

            <div className="clients-toolbar">
              <label className="search-box">
                <Search size={16} />
                <input
                  placeholder={t("clients.searchPlaceholder")}
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
              </label>
              <select
                className="status-filter"
                value={clientStatusFilter}
                onChange={(e) => setClientStatusFilter(e.target.value)}
                title={t("common.status")}
              >
                <option value="">{t("common.allStatuses")}</option>
                <option value="Actif">{t("common.active")}</option>
                <option value="Prospect">{t("common.prospect")}</option>
                <option value="Inactif">{t("common.inactive")}</option>
              </select>
            </div>

            <div className="table-responsive">
            <table className="crm-data-table">
              <thead>
                <tr>
                  <th>{t("clients.type")}</th>
                  <th>{t("clients.entity")}</th>
                  <th>{t("clients.contactPerson")}</th>
                  <th>{t("clients.activityDomains")}</th>
                  <th>{t("clients.service")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client._id}>
                    <td>
                      <span className="status-pill">
                        {client.clientType || "Entreprise"}
                      </span>
                    </td>
                    <td>
                      <div className="client-main">
                        <span className="avatar">{client.name.charAt(0)}</span>
                        <strong>{client.name}</strong>
                      </div>
                    </td>
                    <td>{client.contactName || <span className="muted">-</span>}</td>
                    <td>
                      {clientActivityLabels(client) || <span className="muted">-</span>}
                    </td>
                    <td>{clientServiceName(client) || <span className="muted">-</span>}</td>
                    <td><span className="status-pill">{client.status}</span></td>
                    <td>
                      <div className="actions">
                        <button title={t("common.print")} onClick={() => printClient(client)}>
                          <Printer size={15} />
                        </button>
                        <button title={t("reports.exportPdf")} onClick={() => exportClientPdf(client)}>
                          <FileDown size={15} />
                        </button>
                        <button title={t("common.view")} onClick={() => setSelectedClient(client)}>
                          <Eye size={15} />
                        </button>
                        <button title={t("common.edit")} onClick={() => openEditClient(client)}>
                          <Pencil size={15} />
                        </button>
                        <button title={t("common.delete")} onClick={() => void deleteClient(client._id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {selectedClient && (
              <div className="settings-panel client-view-panel">
                <div className="client-view-header">
                  <h2>Fiche client</h2>
                  <button type="button" className="clients-cancel-btn" onClick={() => setSelectedClient(null)}>
                    Fermer
                  </button>
                </div>
                <div className="client-view-grid">
                  <div>
                    <span>Type de client</span>
                    <strong>{selectedClient.clientType || "Entreprise"}</strong>
                  </div>
                  <div><span>Nom de l'entite</span><strong>{selectedClient.name}</strong></div>
                  <div>
                    <span>Personne de contact</span>
                    <strong>{selectedClient.contactName || "-"}</strong>
                  </div>
                  <div><span>Email</span><strong>{selectedClient.email || "-"}</strong></div>
                  <div><span>Telephone</span><strong>{selectedClient.phone || "-"}</strong></div>
                  <div><span>Localisation</span><strong>{selectedClient.location || "-"}</strong></div>
                  <div><span>Statut</span><strong>{selectedClient.status}</strong></div>
                  <div className="span-2">
                    <span>Domaines d&apos;activite</span>
                    <strong>{clientActivityLabels(selectedClient) || "-"}</strong>
                  </div>
                  <div>
                    <span>Service</span>
                    <strong>{clientServiceName(selectedClient) || "-"}</strong>
                  </div>
                </div>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="clients-cancel-btn"
                    onClick={() => openEditClient(selectedClient)}
                  >
                    Modifier
                  </button>
                  <button type="button" className="clients-cancel-btn" onClick={() => printClient(selectedClient)}>
                    Imprimer
                  </button>
                  <button type="button" className="new-client-btn" onClick={() => exportClientPdf(selectedClient)}>
                    Exporter PDF
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "suivis" && (
          <SuivisClientsPage clients={clients} followUps={followUps} onRefresh={loadAll} />
        )}

        {tab === "rapports" && dashboard && (
          <section className="reports-page">
            <header className="reports-header">
              <div>
                <h1>{t("reports.title")}</h1>
                <p>{t("reports.subtitle")}</p>
              </div>
              <div className="reports-export-actions">
                <button className="reports-export-btn" onClick={exportReportPdf}>
                  {t("reports.exportPdf")}
                </button>
                <button className="reports-export-btn" onClick={exportReportExcel}>
                  {t("reports.exportExcel")}
                </button>
                <button className="reports-export-btn reports-export-btn--light" onClick={exportReportCsv}>
                  {t("reports.exportCsv")}
                </button>
              </div>
            </header>

            <section className="reports-kpis">
              <article className="report-card">
                <h4>{t("dashboard.revenue")}</h4>
                <p>{formatMoney(dashboard.caDevelopment, settings.currency)}</p>
              </article>
              <article className="report-card">
                <h4>{t("dashboard.revenue")}</h4>
                <p>{formatMoney(dashboard.caAnnual, settings.currency)}</p>
              </article>
              <article className="report-card">
                <h4>{t("dashboard.totalClients")}</h4>
                <p>{dashboard.totalClients}</p>
              </article>
              <article className="report-card">
                <h4>{t("dashboard.followups")}</h4>
                <p>{dashboard.totalFollowUps}</p>
              </article>
            </section>

            <section className="reports-grid">
              <article className="report-panel">
                <h3>Statuts clients</h3>
                <div className="metric-row"><span>Actifs</span><strong>{dashboard.statusStats.actifs}</strong></div>
                <div className="progress"><div style={{ width: `${(dashboard.statusStats.actifs / Math.max(dashboard.totalClients, 1)) * 100}%` }} /></div>
                <div className="metric-row"><span>Prospects</span><strong>{dashboard.statusStats.prospects}</strong></div>
                <div className="progress"><div style={{ width: `${(dashboard.statusStats.prospects / Math.max(dashboard.totalClients, 1)) * 100}%` }} /></div>
                <div className="metric-row"><span>Inactifs</span><strong>{dashboard.statusStats.inactifs}</strong></div>
                <div className="progress"><div style={{ width: `${(dashboard.statusStats.inactifs / Math.max(dashboard.totalClients, 1)) * 100}%` }} /></div>
              </article>

              <article className="report-panel">
                <h3>Services</h3>
                <div className="metric-row service-row">
                  <span className="service-label service-hosting"><Server size={15} />Avec hebergement</span>
                  <strong>{dashboard.servicesStats.hosting} / {dashboard.totalClients}</strong>
                </div>
                <div className="metric-row service-row">
                  <span className="service-label service-domain"><Globe size={15} />Avec domaine</span>
                  <strong>{dashboard.servicesStats.domain} / {dashboard.totalClients}</strong>
                </div>
                <div className="metric-row service-row">
                  <span className="service-label service-maintenance"><BarChart4 size={15} />Avec maintenance</span>
                  <strong>{dashboard.servicesStats.maintenance} / {dashboard.totalClients}</strong>
                </div>
                <p className="avg-revenue">Revenu annuel moyen / client</p>
                <h4>{formatMoney(dashboard.averageRevenuePerClient, settings.currency)}</h4>
              </article>

              <article className="report-panel followups-panel">
                <h3>Types de suivis</h3>
                {followUps.length === 0 ? (
                  <p className="empty-text">Aucun suivi</p>
                ) : (
                  <p>{followUps.length} suivis enregistres</p>
                )}
              </article>
            </section>

            <section className="top-clients-panel">
              <h3>Top clients par CA developpement</h3>
              {dashboard.topClients.map((client, index) => (
                <div className="top-client-row" key={client.id}>
                  <div className="top-client-line">
                    <span>#{index + 1} {client.name}</span>
                    <strong>
                      {formatMoney(client.dev, settings.currency)}
                      <small> + {formatMoney(client.annual, settings.currency)}/an</small>
                    </strong>
                  </div>
                  <div className="progress"><div style={{ width: `${(client.dev / maxTopClientDev) * 100}%` }} /></div>
                </div>
              ))}
            </section>

            <section className="report-table-panel">
              <div className="report-table-header">
                <h3>Portefeuille clients detaille</h3>
                <p>Vue exploitable pour direction, finance et equipe commerciale.</p>
              </div>
              <div className="table-responsive">
                <table className="crm-data-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Domaine</th>
                      <th>Statut</th>
                      <th>Hosting</th>
                      <th>Maintenance</th>
                      <th>Suivis</th>
                      <th>CA Dev.</th>
                      <th>CA Annuel</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportClientRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="muted">
                          Aucun client a analyser.
                        </td>
                      </tr>
                    ) : (
                      reportClientRows.map((row) => (
                        <tr key={`${row.client}-${row.domaine}`}>
                          <td>{row.client}</td>
                          <td>{row.domaine}</td>
                          <td><span className="status-pill">{row.statut}</span></td>
                          <td>{row.hosting}</td>
                          <td>{row.maintenance}</td>
                          <td>{row.suivi}</td>
                          <td>{formatMoney(row.dev, settings.currency)}</td>
                          <td>{formatMoney(row.annuel, settings.currency)}</td>
                          <td><strong>{formatMoney(row.total, settings.currency)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

        {tab === "parametres" && (
          <section className="settings-page">
            <header className="settings-page-header">
              <div>
                <h1>{t("settings.title")}</h1>
                <p>{t("settings.configuration")}</p>
              </div>
            </header>

            <nav className="settings-subnav" aria-label={t("settings.title")}>
              <button
                type="button"
                className={parametresSub === "configuration" ? "active" : ""}
                onClick={() => setParametresSub("configuration")}
              >
                <SettingsIcon size={16} />
                {t("settings.configuration")}
              </button>
              <button
                type="button"
                className={parametresSub === "banks" ? "active" : ""}
                onClick={() => setParametresSub("banks")}
              >
                <Wallet size={16} />
                {t("settings.banks")}
              </button>
              <button
                type="button"
                className={parametresSub === "roles" ? "active" : ""}
                onClick={() => setParametresSub("roles")}
              >
                <Shield size={16} />
                {t("settings.roles")}
              </button>
              <button
                type="button"
                className={parametresSub === "permissions" ? "active" : ""}
                onClick={() => setParametresSub("permissions")}
              >
                <KeyRound size={16} />
                {t("settings.permissions")}
              </button>
              <button
                type="button"
                className={parametresSub === "users" ? "active" : ""}
                onClick={() => setParametresSub("users")}
              >
                <UserCog size={16} />
                {t("settings.users")}
              </button>
            </nav>

            {parametresSub === "configuration" && (
              <div className="settings-panel">
                <h2>{t("settings.configuration")}</h2>
                <p className="settings-hint">
                  Ces informations sont enregistrees en base et reutilisees sur les apercus factures, exports PDF et
                  documents.
                </p>
                <div className="settings-form-grid">
                  <label>
                    <span>Nom entreprise</span>
                    <input
                      value={settings.companyName}
                      onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Contact (personne / service)</span>
                    <input
                      value={settings.companyContactName}
                      onChange={(e) => setSettings({ ...settings, companyContactName: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={settings.companyEmail}
                      onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Telephone</span>
                    <input
                      value={settings.companyPhone}
                      onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                    />
                  </label>
                  <label className="span-2">
                    <span>Adresse</span>
                    <input
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Site web</span>
                    <input
                      value={settings.website}
                      onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Devise</span>
                    <input
                      value={settings.currency}
                      onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    />
                  </label>

                  <label className="span-2">
                    <span>Banque par defaut (liee au catalogue banques)</span>
                    <select
                      value={defaultBankSelectValue(settings)}
                      onChange={(e) => {
                        const id = e.target.value;
                        const b = banks.find((x) => x._id === id);
                        setSettings({
                          ...settings,
                          defaultBank: id || null,
                          bankName: b?.name ?? "",
                          bankAccountHolder: b?.accountHolder ?? "",
                          bankIban: b?.iban ?? "",
                          bankSwift: b?.swift ?? ""
                        });
                      }}
                    >
                      <option value="">— Aucune —</option>
                      {banks.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Nom banque (affichage / secours)</span>
                    <input
                      value={settings.bankName}
                      onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Titulaire du compte</span>
                    <input
                      value={settings.bankAccountHolder}
                      onChange={(e) => setSettings({ ...settings, bankAccountHolder: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>IBAN</span>
                    <input
                      value={settings.bankIban}
                      onChange={(e) => setSettings({ ...settings, bankIban: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>SWIFT / BIC</span>
                    <input
                      value={settings.bankSwift}
                      onChange={(e) => setSettings({ ...settings, bankSwift: e.target.value })}
                    />
                  </label>

                  <label className="span-2">
                    <span>En-tete des pages (factures, feuilles)</span>
                    <textarea
                      rows={3}
                      value={settings.documentHeader}
                      onChange={(e) => setSettings({ ...settings, documentHeader: e.target.value })}
                      placeholder="Texte affiche en haut des documents (si vide : nom entreprise)"
                    />
                  </label>
                  <label className="span-2">
                    <span>Pied de page des documents</span>
                    <textarea
                      rows={3}
                      value={settings.documentFooter}
                      onChange={(e) => setSettings({ ...settings, documentFooter: e.target.value })}
                      placeholder="Mentions legales, NIF, RCCM, etc."
                    />
                  </label>
                  <label className="span-2">
                    <span>Logo (image)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      aria-label="Importer le logo entreprise"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const reader = new FileReader();
                        reader.onload = () =>
                          setSettings({ ...settings, logoDataUrl: String(reader.result || "") });
                        reader.readAsDataURL(f);
                      }}
                    />
                    {settings.logoDataUrl ? (
                      <div className="logo-preview-wrap">
                        <img src={settings.logoDataUrl} alt="Apercu logo" className="logo-preview" />
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setSettings({ ...settings, logoDataUrl: "" })}
                        >
                          Retirer le logo
                        </button>
                      </div>
                    ) : null}
                  </label>

                  <label className="check-row span-2">
                    <input
                      type="checkbox"
                      checked={settings.expirationAlertEnabled}
                      onChange={(e) =>
                        setSettings({ ...settings, expirationAlertEnabled: e.target.checked })
                      }
                    />
                    <span>Alertes d&apos;expiration actives</span>
                  </label>
                  <label>
                    <span>Delai alerte (jours)</span>
                    <input
                      type="number"
                      min={1}
                      value={settings.expirationAlertDays}
                      onChange={(e) =>
                        setSettings({ ...settings, expirationAlertDays: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                </div>
                <div className="settings-actions">
                  {settingsSaveState ? (
                    <p
                      className={
                        settingsSaveState.type === "success"
                          ? "settings-save-success"
                          : "settings-save-error"
                      }
                    >
                      {settingsSaveState.message}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="new-client-btn"
                    onClick={() => void saveSettings()}
                    disabled={isSavingSettings}
                  >
                    {isSavingSettings ? "Enregistrement..." : "Enregistrer la configuration"}
                  </button>
                </div>
              </div>
            )}

            {parametresSub === "banks" && (
              <div className="settings-panel">
                <h2>{editingBankId ? "Modifier la banque" : "Ajouter une banque"}</h2>
                <p className="settings-hint">
                  Ces comptes sont enregistres en base et proposes dans le formulaire des depenses.
                </p>
                <div className="settings-form-grid">
                  <label>
                    <span>Nom banque *</span>
                    <input
                      value={bankForm.name}
                      onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                      placeholder="Ex. Salaam Bank"
                    />
                  </label>
                  <label>
                    <span>Numero compte ou wallet *</span>
                    <input
                      value={bankForm.accountNumberOrWallet}
                      onChange={(e) =>
                        setBankForm({ ...bankForm, accountNumberOrWallet: e.target.value })
                      }
                      placeholder="Numero de compte, IBAN ou wallet"
                    />
                  </label>
                  <label className="span-2">
                    <span>Description</span>
                    <textarea
                      rows={3}
                      value={bankForm.description}
                      onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })}
                      placeholder="Description optionnelle"
                    />
                  </label>
                </div>
                <div className="settings-actions">
                  {editingBankId ? (
                    <button type="button" className="clients-cancel-btn" onClick={resetBankForm}>
                      Annuler
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="new-client-btn"
                    disabled={bankSaving}
                    onClick={() => void saveBank()}
                  >
                    {bankSaving ? "Enregistrement..." : "Enregistrer la banque"}
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="crm-data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nom banque</th>
                        <th>Numero compte ou wallet</th>
                        <th>Description</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {banks.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="crm-empty">Aucune banque enregistree.</td>
                        </tr>
                      ) : (
                        banks.map((bank, index) => (
                          <tr key={bank._id}>
                            <td>{index + 1}</td>
                            <td><strong>{bank.name}</strong></td>
                            <td>{bank.accountNumberOrWallet || bank.iban || "-"}</td>
                            <td>{bank.description || "-"}</td>
                            <td>
                              <div className="actions">
                                <button type="button" title="Modifier" onClick={() => editBank(bank)}>
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  title="Supprimer"
                                  onClick={() => void deleteBank(bank._id)}
                                >
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
              </div>
            )}

            {parametresSub === "roles" && (
              <div className="settings-panel">
                <h2>Roles</h2>
                <p className="settings-hint">Chaque role regroupe des permissions applicables aux utilisateurs.</p>

                <div className="settings-form-grid role-editor">
                  <label className="span-2">
                    <span>Nom du role</span>
                    <input
                      value={newRole.name}
                      onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                    />
                  </label>
                  <label className="span-2">
                    <span>Description</span>
                    <input
                      value={newRole.description}
                      onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                    />
                  </label>
                  <div className="span-2 permission-pick">
                    <span>Permissions</span>
                    <div className="permission-chips">
                      {permissions.map((p) => (
                        <label key={p._id} className="perm-chip">
                          <input
                            type="checkbox"
                            checked={newRole.permissionIds.includes(p._id)}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setNewRole({
                                ...newRole,
                                permissionIds: on
                                  ? [...newRole.permissionIds, p._id]
                                  : newRole.permissionIds.filter((id) => id !== p._id)
                              });
                            }}
                          />
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <button type="button" className="new-client-btn" onClick={() => void createRole()}>
                  Ajouter le role
                </button>

                <div className="table-responsive">
                <table className="crm-data-table crm-data-table--settings">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Permissions</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((r) => (
                      <tr key={r._id}>
                        <td>
                          <strong>{r.name}</strong>
                          <div className="muted small">{r.description}</div>
                        </td>
                        <td>{r.permissions?.length ?? 0}</td>
                        <td>
                          <button type="button" className="link-btn danger" onClick={() => void deleteRole(r._id)}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {parametresSub === "permissions" && (
              <div className="settings-panel">
                <h2>Permissions</h2>
                <p className="settings-hint">Referentiel des droits. Cles stables pour evoluer le systeme.</p>

                <div className="settings-form-grid">
                  <label>
                    <span>Cle technique</span>
                    <input
                      value={newPermission.key}
                      onChange={(e) => setNewPermission({ ...newPermission, key: e.target.value })}
                      placeholder="ex: clients.write"
                    />
                  </label>
                  <label>
                    <span>Categorie</span>
                    <input
                      value={newPermission.category}
                      onChange={(e) => setNewPermission({ ...newPermission, category: e.target.value })}
                    />
                  </label>
                  <label className="span-2">
                    <span>Libelle</span>
                    <input
                      value={newPermission.label}
                      onChange={(e) => setNewPermission({ ...newPermission, label: e.target.value })}
                    />
                  </label>
                </div>
                <button type="button" className="new-client-btn" onClick={() => void createPermission()}>
                  Ajouter la permission
                </button>

                <div className="table-responsive">
                <table className="crm-data-table crm-data-table--settings">
                  <thead>
                    <tr>
                      <th>Cle</th>
                      <th>Libelle</th>
                      <th>Categorie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.map((p) => (
                      <tr key={p._id}>
                        <td><code>{p.key}</code></td>
                        <td>{p.label}</td>
                        <td>{p.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {parametresSub === "users" && (
              <div className="settings-panel">
                <h2>Utilisateurs</h2>
                <p className="settings-hint">Comptes rattaches a un role (mot de passe optionnel pour l&apos;instant).</p>

                <div className="settings-form-grid">
                  <label>
                    <span>Nom complet</span>
                    <input
                      value={newUser.fullName}
                      onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Telephone</span>
                    <input
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Role</span>
                    <select
                      value={newUser.roleId}
                      onChange={(e) => setNewUser({ ...newUser, roleId: e.target.value })}
                    >
                      <option value="">Selectionner</option>
                      {roles.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Mot de passe (optionnel)</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={newUser.active}
                      onChange={(e) => setNewUser({ ...newUser, active: e.target.checked })}
                    />
                    <span>Actif</span>
                  </label>
                </div>
                <button type="button" className="new-client-btn" onClick={() => void createUser()}>
                  Ajouter l&apos;utilisateur
                </button>

                <div className="table-responsive">
                <table className="crm-data-table crm-data-table--settings">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id}>
                        <td>{u.fullName}</td>
                        <td>{u.email}</td>
                        <td>{u.role?.name}</td>
                        <td>{u.active ? "Actif" : "Inactif"}</td>
                        <td>
                          <button type="button" className="link-btn danger" onClick={() => void deleteUser(u._id)}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "paiement-facture" && (
          <PaiementFacturePage
            clients={clients}
            banks={banks}
            settings={settings}
            invoices={invoices}
            invoicePayments={invoicePayments}
            currency={settings.currency}
            onRefresh={loadAll}
          />
        )}

        {tab === "facture" && (
          <FacturesPage
            clients={clients}
            services={services}
            currency={settings.currency}
            settings={settings}
            banks={banks}
            invoices={invoices}
            onRefresh={loadAll}
          />
        )}

        {tab === "proforma" && (
          <ProformasPage
            clients={clients}
            services={services}
            currency={settings.currency}
            settings={settings}
            banks={banks}
            proformas={proformas}
            invoices={invoices}
            initialEditProformaId={proformaToEdit}
            onProformaEditOpened={() => {
              try {
                sessionStorage.removeItem("openProformaId");
              } catch {
                /* ignore */
              }
              setProformaToEdit(null);
            }}
            onRefresh={loadAll}
          />
        )}

        {tab === "service" && (
          <section className="service-page">
            <header className="clients-header">
              <div>
                <h1>{t("services.title")}</h1>
                <p>{t("services.count", { count: services.length })}</p>
              </div>
              <button className="new-client-btn" type="button" onClick={openNewServiceForm}>
                <Plus size={16} />
                {t("services.new")}
              </button>
            </header>

            {showServiceForm && (
              <div className="settings-panel clients-new-panel">
                <h2>{editingServiceId ? t("services.edit") : t("services.new")}</h2>
                <div className="settings-form-grid">
                  <label className="span-2">
                    <span>{t("services.designation")} *</span>
                    <input
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ex. Fabrication et pose de porte en aluminium"
                      autoComplete="off"
                    />
                  </label>
                  <label className="span-2">
                    <span>Description</span>
                    <textarea
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Details du service (optionnel)"
                      rows={3}
                    />
                  </label>
                  <label>
                    <span>Prix (FDJ)</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={serviceForm.price}
                      onChange={(e) => setServiceForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder="Optionnel — laisser vide"
                    />
                  </label>
                </div>
                <div className="settings-actions clients-new-actions">
                  <button
                    type="button"
                    className="clients-cancel-btn"
                    disabled={serviceSaving}
                    onClick={() => {
                      setShowServiceForm(false);
                      setEditingServiceId(null);
                      setServiceForm(emptyServiceForm());
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="new-client-btn"
                    disabled={serviceSaving}
                    onClick={() => void submitService()}
                  >
                    {serviceSaving
                      ? "Enregistrement..."
                      : editingServiceId
                        ? "Enregistrer"
                        : "Enregistrer le service"}
                  </button>
                </div>
              </div>
            )}

            <div className="table-responsive">
            <table className="crm-data-table">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Designation</th>
                  <th>Categorie</th>
                  <th>Prix</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service._id}>
                    <td>{service.code}</td>
                    <td>{serviceLabel(service)}</td>
                    <td>{service.category || <span className="muted">-</span>}</td>
                    <td>
                      {service.price > 0
                        ? formatMoney(service.price, settings.currency)
                        : <span className="muted">-</span>}
                    </td>
                    <td>
                      <div className="actions">
                        <button title="Modifier" type="button" onClick={() => openEditService(service)}>
                          <Pencil size={15} />
                        </button>
                        <button title="Supprimer" type="button" onClick={() => void deleteService(service._id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        )}

        {tab === "depenses" && (
          <DepensesPage sub={depensesSub} onSubChange={setDepensesSub} banks={banks} />
        )}
        </main>
      </div>
    </div>
  );
}

