import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Eye, FileDown, Mail, MessageCircle, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "../../services/apiService";
import type { Bank, Client, Setting } from "../../types";
import { addLogoToPdf, formatMoney, resolveCompanyBank, serviceLabel } from "../../utils";
import {
  CLIENT_ACTIVITY_CATEGORIES,
  type ClientActivityCategory
} from "../../constants/serviceCategories";
import "./Factures.css";

type ServiceRow = {
  _id: string;
  code: string;
  name: string;
  designation?: string;
  category?: string;
  price: number;
};

type InvoiceUnit = "U" | "m" | "m²";

const INVOICE_UNITS: InvoiceUnit[] = ["U", "m", "m²"];

type InvoiceLine = {
  service?: string | null;
  designation: string;
  category: string;
  description: string;
  quantite: number;
  largeur?: number;
  longueur?: number;
  unite: InvoiceUnit;
  prixUnitaire: number;
  montant: number;
};

type InvoiceApi = {
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
  lines?: InvoiceLine[];
};

type FormState = {
  clientId: string;
  nomClient: string;
  entreprise: string;
  telephone: string;
  bankId: string;
  remisePercent: number;
};

const initialForm: FormState = {
  clientId: "",
  nomClient: "",
  entreprise: "",
  telephone: "",
  bankId: "",
  remisePercent: 0
};

type LineFormState = {
  category: ClientActivityCategory;
  serviceId: string;
  description: string;
  quantite: number;
  largeur: number;
  longueur: number;
  unite: InvoiceUnit;
  prixUnitaire: number;
};

function emptyLineForm(): LineFormState {
  return {
    category: CLIENT_ACTIVITY_CATEGORIES[0],
    serviceId: "",
    description: "",
    quantite: 1,
    largeur: 0,
    longueur: 0,
    unite: "U",
    prixUnitaire: 0
  };
}

function needsDimensions(unite: InvoiceUnit) {
  return unite === "m" || unite === "m²";
}

/** Affichage Unite : "125m*140m" si dimensions, sinon U / m / m² */
function formatUniteMeasure(line: { unite?: string; largeur?: number; longueur?: number }) {
  const unite = normalizeUnite(line.unite);
  if (needsDimensions(unite)) {
    const largeur = Number(line.largeur) || 0;
    const longueur = Number(line.longueur) || 0;
    if (largeur > 0 && longueur > 0) return `${largeur}m*${longueur}m`;
  }
  return unite;
}

function normalizeUnite(value: unknown): InvoiceUnit {
  return INVOICE_UNITS.includes(value as InvoiceUnit) ? (value as InvoiceUnit) : "U";
}

function normalizeCategory(value: unknown): string {
  return (CLIENT_ACTIVITY_CATEGORIES as readonly string[]).includes(String(value || ""))
    ? String(value)
    : "";
}

function clampRemisePercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}

function calcInvoiceTotals(lines: Array<{ montant: number }>, remisePercent: unknown) {
  const subtotal = lines.reduce((sum, l) => sum + (Number(l.montant) || 0), 0);
  const remise = clampRemisePercent(remisePercent);
  const discountAmount = Math.round((subtotal * remise) / 100);
  const net = Math.max(0, subtotal - discountAmount);
  return { subtotal, remisePercent: remise, discountAmount, net };
}

function invoiceLinesOf(row: InvoiceApi): InvoiceLine[] {
  if (!Array.isArray(row.lines)) return [];
  return row.lines.map((line) => ({
    ...line,
    category: normalizeCategory(line.category) || normalizeCategory(row.invoiceType) || "",
    unite: normalizeUnite(line.unite),
    quantite: Number(line.quantite) || 0,
    largeur: Number(line.largeur) || 0,
    longueur: Number(line.longueur) || 0,
    prixUnitaire: Number(line.prixUnitaire) || 0,
    montant: Number(line.montant) || 0
  }));
}

function summarizeInvoiceType(lines: InvoiceLine[]): string {
  const cats = [...new Set(lines.map((l) => l.category).filter(Boolean))];
  if (cats.length === 0) return "Mixte";
  if (cats.length === 1) return cats[0];
  return "Mixte";
}

/** Reference = date du jour (YYYYMMDD) + compteur facture sur 6 chiffres */
function nextInvoiceReference(existingInvoices: Array<{ reference?: string }>, now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const datePart = `${y}${m}${d}`;
  const prefix = `${datePart}-`;
  let maxSeq = 0;
  for (const inv of existingInvoices) {
    const ref = String(inv.reference || "");
    if (!ref.startsWith(prefix)) continue;
    const n = Number(ref.slice(prefix.length).replace(/\D/g, "").slice(0, 6));
    if (Number.isFinite(n)) maxSeq = Math.max(maxSeq, n);
  }
  if (maxSeq === 0) {
    maxSeq = existingInvoices.length;
  }
  const seq = String(maxSeq + 1).padStart(6, "0");
  return `${datePart}-${seq}`;
}

/** jsPDF n'affiche pas correctement les espaces fins (U+202F) de toLocaleString("fr-FR") */
function formatMoneyPdf(value: number, currency = "FDJ") {
  const n = Math.round(value)
    .toLocaleString("fr-FR")
    .replace(/[\u202f\u00a0]/g, " ");
  return `${n} ${currency}`;
}

type FacturesProps = {
  clients: Client[];
  services: ServiceRow[];
  currency: string;
  settings: Setting;
  banks: Bank[];
  invoices: InvoiceApi[];
  onRefresh: () => Promise<void>;
};

export default function Factures({
  clients,
  services,
  currency,
  settings,
  banks,
  invoices,
  onRefresh
}: FacturesProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(initialForm);
  const [lineForm, setLineForm] = useState<LineFormState>(emptyLineForm);
  const [lignes, setLignes] = useState<InvoiceLine[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewRow, setPreviewRow] = useState<InvoiceApi | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  useEffect(() => {
    if (!previewRow) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewRow(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewRow]);

  const servicesForType = useMemo(
    () => services.filter((s) => (s.category || "") === lineForm.category),
    [services, lineForm.category]
  );

  const selectedService = useMemo(
    () => servicesForType.find((s) => s._id === lineForm.serviceId) ?? null,
    [lineForm.serviceId, servicesForType]
  );

  const lineMontant = useMemo(
    () => Math.max(0, Number(lineForm.quantite) || 0) * Math.max(0, Number(lineForm.prixUnitaire) || 0),
    [lineForm.quantite, lineForm.prixUnitaire]
  );

  const formTotals = useMemo(
    () => calcInvoiceTotals(lignes, form.remisePercent),
    [lignes, form.remisePercent]
  );

  function updateLineUnite(unite: InvoiceUnit) {
    if (!needsDimensions(unite)) {
      setLineForm({ ...lineForm, unite, largeur: 0, longueur: 0 });
      return;
    }
    setLineForm({ ...lineForm, unite });
  }

  function updateLineDimension(field: "largeur" | "longueur", raw: number) {
    const value = Math.max(0, raw || 0);
    setLineForm({ ...lineForm, [field]: value });
  }

  function defaultBankId() {
    const ref = settings.defaultBank;
    if (ref && typeof ref === "object" && "_id" in ref) return ref._id;
    if (typeof ref === "string") return ref;
    return banks.find((b) => b.name === settings.bankName)?._id || banks[0]?._id || "";
  }

  function blankForm(): FormState {
    return { ...initialForm, bankId: defaultBankId() };
  }

  function resetForm() {
    setForm(blankForm());
    setLineForm(emptyLineForm());
    setLignes([]);
    setEditingId(null);
    setShowInvoiceForm(false);
  }

  function openNewInvoiceForm() {
    if (editingId) {
      if (!window.confirm("Abandonner la modification en cours pour creer une nouvelle facture ?")) return;
    } else if (invoiceFormVisible) {
      const hasDraft =
        form.nomClient.trim() !== "" ||
        form.entreprise.trim() !== "" ||
        form.telephone.trim() !== "" ||
        lignes.length > 0;
      if (hasDraft && !window.confirm("Effacer le brouillon actuel et recommencer ?")) return;
    }
    setForm(blankForm());
    setLineForm(emptyLineForm());
    setLignes([]);
    setEditingId(null);
    setShowInvoiceForm(true);
  }

  function closeInvoiceForm() {
    if (editingId) {
      resetForm();
      return;
    }
    const hasDraft =
      form.nomClient.trim() !== "" ||
      form.entreprise.trim() !== "" ||
      form.telephone.trim() !== "" ||
      lignes.length > 0;
    if (hasDraft && !window.confirm("Fermer le formulaire sans enregistrer ?")) return;
    resetForm();
  }

  const invoiceFormVisible = showInvoiceForm || editingId !== null;

  function addLine() {
    const largeur = needsDimensions(lineForm.unite) ? Math.max(0, Number(lineForm.largeur) || 0) : 0;
    const longueur = needsDimensions(lineForm.unite) ? Math.max(0, Number(lineForm.longueur) || 0) : 0;
    const quantite = Math.max(0.01, Number(lineForm.quantite) || 0);
    const prixUnitaire = Math.max(0, Number(lineForm.prixUnitaire) || 0);
    if (!selectedService || quantite <= 0) {
      window.alert("Veuillez selectionner un service et une quantite.");
      return;
    }
    if (needsDimensions(lineForm.unite) && (largeur <= 0 || longueur <= 0)) {
      window.alert("Veuillez saisir la largeur et la longueur.");
      return;
    }
    setLignes((prev) => [
      ...prev,
      {
        service: selectedService._id,
        designation: serviceLabel(selectedService),
        category: lineForm.category,
        description: "",
        quantite,
        largeur,
        longueur,
        unite: lineForm.unite,
        prixUnitaire,
        montant: quantite * prixUnitaire
      }
    ]);
    setLineForm((prev) => ({
      ...emptyLineForm(),
      category: prev.category
    }));
  }

  function removeLine(index: number) {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  }

  async function upsertFacture() {
    const nomClient = form.nomClient.trim();
    const entreprise = form.entreprise.trim();
    const telephone = form.telephone.trim();
    if (!nomClient || !entreprise || !telephone) {
      window.alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (lignes.length === 0) {
      window.alert("Ajoutez au moins une designation.");
      return;
    }

    const { remisePercent, net } = calcInvoiceTotals(lignes, form.remisePercent);
    const bankId = form.bankId || defaultBankId();
    const bank = banks.find((b) => b._id === bankId);
    const companyBank = resolveCompanyBank(settings, banks);
    const now = new Date();
    const generatedId = `FAC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${now.getTime()}`;
    const existing = editingId ? invoices.find((i) => i._id === editingId) : undefined;

    const payload = {
      invoiceId: existing?.invoiceId ?? generatedId,
      reference: existing?.reference ?? nextInvoiceReference(invoices, now),
      invoiceType: summarizeInvoiceType(lignes),
      client: form.clientId || null,
      clientName: nomClient,
      company: entreprise,
      phone: telephone,
      domainName: "",
      expirationDate: null,
      bank: bank?._id || null,
      bankName: bank?.name || companyBank.name || settings.bankName || "Compte entreprise",
      bankAccountNumber: bank?.accountNumberOrWallet || "",
      bankAccountHolder: bank?.accountHolder || companyBank.accountHolder || "",
      bankIban: bank?.iban || companyBank.iban || "",
      bankSwift: bank?.swift || companyBank.swift || "",
      amount: net,
      remisePercent,
      isValidated: existing?.isValidated ?? false,
      lines: lignes,
      date: existing?.date ?? now.toISOString(),
      paymentStatus: existing?.paymentStatus ?? "En attente",
      paymentMethod: existing?.paymentMethod ?? "Virement bancaire"
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/billing/invoices/${editingId}`, payload);
      } else {
        await api.post("/billing/invoices", payload);
      }
      resetForm();
      await onRefresh();
    } catch {
      window.alert("Erreur lors de l'enregistrement de la facture.");
    } finally {
      setSaving(false);
    }
  }

  async function editFacture(row: InvoiceApi) {
    let toEdit = row;
    if (row.isValidated) {
      if (
        !window.confirm(
          "Cette facture est validee. Pour la modifier, elle sera remise en brouillon. Continuer ?"
        )
      ) {
        return;
      }
      try {
        await api.put(`/billing/invoices/${row._id}`, { isValidated: false });
        await onRefresh();
        toEdit = { ...row, isValidated: false };
      } catch {
        window.alert("Impossible de remettre la facture en brouillon.");
        return;
      }
    }
    setEditingId(toEdit._id);
    setShowInvoiceForm(true);
    setForm({
      clientId:
        typeof toEdit.client === "object" && toEdit.client
          ? toEdit.client._id
          : typeof toEdit.client === "string"
            ? toEdit.client
            : "",
      nomClient: toEdit.clientName,
      entreprise: toEdit.company,
      telephone: toEdit.phone || "",
      bankId:
        typeof toEdit.bank === "object" && toEdit.bank
          ? toEdit.bank._id
          : typeof toEdit.bank === "string"
            ? toEdit.bank
            : banks.find((b) => b.name === toEdit.bankName)?._id || defaultBankId(),
      remisePercent: clampRemisePercent(toEdit.remisePercent)
    });
    const loadedLines = invoiceLinesOf(toEdit);
    setLignes(loadedLines);
    setLineForm({
      ...emptyLineForm(),
      category: (loadedLines[0]?.category as ClientActivityCategory) || CLIENT_ACTIVITY_CATEGORIES[0]
    });
  }

  async function deleteFacture(row: InvoiceApi) {
    if (row.isValidated) {
      window.alert("Suppression refusee: la facture est deja validee.");
      return;
    }
    if (!window.confirm("Supprimer cette facture ?")) return;
    await api.delete(`/billing/invoices/${row._id}`);
    if (editingId === row._id) resetForm();
    await onRefresh();
  }

  async function validateFacture(row: InvoiceApi) {
    if (row.isValidated) return;
    await api.put(`/billing/invoices/${row._id}`, { isValidated: true });
    await onRefresh();
  }

  function escapeHtml(value: string) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function buildFactureHtml(row: InvoiceApi) {
    const companyName = settings.companyName || "AL-HAKIM GROUP";
    const tagline = "L'excellence au service de vos projets.";
    const defaultBank = resolveCompanyBank(settings, banks);
    const bank = {
      name: row.bankName || defaultBank.name,
      accountNumber: row.bankAccountNumber || "",
      accountHolder: row.bankAccountHolder || defaultBank.accountHolder,
      iban: row.bankIban || defaultBank.iban,
      swift: row.bankSwift || defaultBank.swift
    };
    const bankHolder = bank.accountHolder || companyName;
    const logoHtml = settings.logoDataUrl
      ? `<img class="logo" src="${settings.logoDataUrl}" alt="logo" />`
      : `<div class="logo-fallback">${companyName.charAt(0)}</div>`;
    const lines = invoiceLinesOf(row);
    const dateLabel = new Date(row.date).toLocaleDateString("fr-FR");
    const totals = calcInvoiceTotals(lines, row.remisePercent);
    const subtotalLabel = formatMoneyPdf(totals.subtotal, currency);
    const discountLabel = formatMoneyPdf(totals.discountAmount, currency);
    const total = formatMoneyPdf(totals.net, currency);
    const acompte = formatMoneyPdf(totals.net * 0.5, currency);
    const soldeTravaux = formatMoneyPdf(totals.net * 0.45, currency);
    const soldeFinal = formatMoneyPdf(totals.net * 0.05, currency);
    const currencyLabel =
      currency.toUpperCase() === "FDJ" ? "Franc Djiboutien (FDJ)" : currency;
    const reference = row.reference?.trim() || "—";
    const contactLine = [
      settings.companyEmail || "contact@geosomtech.com",
      settings.companyPhone || "+253 77 26 10 01",
      settings.address || "Djibouti"
    ].join(" | ");

    const rowsHtml = lines
      .map(
        (line, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${escapeHtml(line.category || "—")}</td>
        <td>${escapeHtml(line.designation)}</td>
        <td class="center">${escapeHtml(formatUniteMeasure(line))}</td>
        <td class="num">${line.quantite}</td>
        <td class="num">${formatMoneyPdf(line.prixUnitaire, currency)}</td>
        <td class="num">${formatMoneyPdf(line.montant, currency)}</td>
      </tr>`
      )
      .join("");

    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Facture ${escapeHtml(row.invoiceId)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      margin: 0;
      color: #0f172a;
      background: #e8eef3;
      font-family: Arial, Helvetica, "Segoe UI", sans-serif;
    }
    .sheet {
      width: 210mm;
      max-width: 100%;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .top-bar {
      height: 8px;
      flex-shrink: 0;
      background: #101C4E !important;
    }
    .content {
      flex: 1;
      padding: 16mm 14mm 12mm;
    }
    .header {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 14px;
      align-items: start;
      padding-bottom: 14px;
      border-bottom: 2px solid #101C4E;
      margin-bottom: 16px;
    }
    .brand { display: flex; gap: 14px; align-items: center; min-width: 0; }
    .logo, .logo-fallback {
      width: 96px; height: 96px; object-fit: contain;
      border-radius: 12px; border: 1px solid #dbe4ee; background: #fff;
      flex-shrink: 0;
    }
    .logo-fallback {
      display: grid; place-items: center;
      font-size: 36px; font-weight: 800; color: #101C4E;
    }
    .brand h1 {
      margin: 0; font-size: 20px; letter-spacing: 0.03em;
      text-transform: uppercase; color: #101C4E;
    }
    .brand .tagline {
      margin: 4px 0 0; color: #64748b; font-size: 11px; font-style: italic;
    }
    .brand .contact { margin: 6px 0 0; color: #64748b; font-size: 11px; }
    .doc-title { text-align: right; }
    .doc-title .badge {
      display: inline-block; padding: 7px 16px; border-radius: 999px;
      background: #101C4E !important; color: #fff !important;
      font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
    }
    .doc-title .num {
      margin: 10px 0 4px; font-size: 14px; font-weight: 700; color: #0f172a;
    }
    .doc-title .meta { margin: 0; color: #64748b; font-size: 11px; }
    .grid-2 {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;
    }
    .card {
      border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 12px 14px; background: #f8fafc !important;
    }
    .card h3 {
      margin: 0 0 8px; font-size: 11px; letter-spacing: 0.06em;
      text-transform: uppercase; color: #101C4E; font-weight: 800;
    }
    .card p { margin: 0 0 5px; font-size: 12px; color: #334155; }
    .card strong { color: #0f172a; }
    table.lines {
      width: 100%; border-collapse: collapse; margin-top: 4px;
      table-layout: fixed;
    }
    table.lines th, table.lines td {
      padding: 8px 8px; font-size: 11px; vertical-align: middle;
      border-bottom: 1px solid #e5e7eb; word-wrap: break-word;
    }
    table.lines th {
      background: #101C4E !important; color: #fff !important;
      text-align: left; font-size: 9px; letter-spacing: 0.04em;
      text-transform: uppercase; white-space: nowrap;
    }
    table.lines th:first-child { border-radius: 8px 0 0 0; }
    table.lines th:last-child { border-radius: 0 8px 0 0; }
    table.lines col.c-nu { width: 5%; }
    table.lines col.c-type { width: 18%; }
    table.lines col.c-des { width: 24%; }
    table.lines col.c-unite { width: 14%; }
    table.lines col.c-qte { width: 8%; }
    table.lines col.c-prix { width: 15%; }
    table.lines col.c-montant { width: 16%; }
    table.lines td.num, table.lines th.num {
      text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    table.lines td.center, table.lines th.center { text-align: center; white-space: nowrap; }
    tbody tr:nth-child(even) { background: #f8fafc !important; }
    .totals {
      margin-top: 14px; display: flex; justify-content: flex-end;
    }
    .totals-box {
      min-width: 280px; max-width: 100%;
      border: 1px solid #B2B7C6; border-radius: 10px;
      overflow: hidden; background: #EEF0F8 !important;
    }
    .totals-box .row {
      display: flex; justify-content: space-between; align-items: center; gap: 24px;
      padding: 10px 16px; font-size: 13px; color: #334155;
      line-height: 1.35;
    }
    .totals-box .row.total {
      font-weight: 800; color: #101C4E; font-size: 14px;
      border-top: 1px solid #B2B7C6;
      background: #E4E8F2 !important;
      padding: 12px 16px;
    }
    .totals-box .row span:last-child {
      white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    .schedule {
      margin-top: 16px; border: 1px solid #bfdbfe; border-radius: 10px;
      padding: 12px 14px; background: #eff6ff !important;
    }
    .schedule h3 {
      margin: 0 0 10px; font-size: 11px; letter-spacing: 0.06em;
      text-transform: uppercase; color: #1d4ed8; font-weight: 800;
    }
    .schedule-rows { display: grid; gap: 8px; }
    .schedule-row {
      display: flex; justify-content: space-between; align-items: center;
      gap: 16px; font-size: 12px; color: #334155; line-height: 1.4;
    }
    .schedule-row strong {
      color: #1e3a8a; white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    .bank-conditions {
      display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 16px;
    }
    .conditions-box {
      border: 1px solid #B2B7C6;
      border-radius: 10px;
      overflow: hidden;
      background: #fff !important;
    }
    .conditions-box .conditions-head {
      margin: 0;
      padding: 9px 14px;
      background: #101C4E !important;
      color: #fff !important;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 800;
    }
    table.conditions {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 0;
    }
    table.conditions th,
    table.conditions td {
      padding: 9px 14px;
      font-size: 12px;
      vertical-align: middle;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }
    table.conditions tr:last-child td { border-bottom: none; }
    table.conditions tr:nth-child(even) td { background: #f8fafc !important; }
    table.conditions td.label {
      width: 28%;
      font-weight: 700;
      color: #101C4E;
      white-space: nowrap;
    }
    table.conditions td.value {
      width: 72%;
      color: #334155;
      line-height: 1.45;
    }
    .signature {
      margin-top: 26px; display: flex; justify-content: space-between;
      gap: 20px; align-items: flex-end;
    }
    .signature .left p { margin: 0 0 5px; font-size: 12px; color: #64748b; }
    .signature .thanks {
      margin-top: 10px !important; color: #101C4E !important;
      font-weight: 800; font-size: 13px !important;
    }
    .signature .right { min-width: 200px; text-align: center; }
    .signature .right strong {
      display: block; margin-bottom: 40px; color: #101C4E;
    }
    .signature .stamp {
      border-top: 1px solid #94a3b8; padding-top: 6px;
      font-size: 11px; color: #64748b;
    }
    .footer {
      margin-top: 22px; padding-top: 10px; border-top: 1px solid #e2e8f0;
      text-align: center; color: #64748b; font-size: 10px;
    }
    @media (max-width: 720px) {
      body { background: #fff; }
      .sheet { width: 100%; min-height: auto; }
      .content { padding: 18px 14px 14px; }
      .header { grid-template-columns: 1fr; gap: 12px; }
      .doc-title { text-align: left; }
      .brand h1 { font-size: 16px; }
      .grid-2, .bank-conditions { grid-template-columns: 1fr; }
      .totals { justify-content: stretch; }
      .totals-box { min-width: 0; width: 100%; }
      table.lines { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; table-layout: auto; }
      table.lines th, table.lines td { font-size: 10px; padding: 7px 6px; }
      .signature { flex-direction: column; align-items: stretch; gap: 22px; }
      .signature .right { min-width: 0; text-align: left; }
      .signature .right strong { margin-bottom: 36px; text-align: left; }
    }
    @media print {
      html, body {
        background: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      .sheet { width: auto; min-height: auto; margin: 0; box-shadow: none; }
      .top-bar, .doc-title .badge, .card, th, tbody tr:nth-child(even),
      .totals-box, .totals-box .row.total, .schedule,
      .conditions-box .conditions-head, table.conditions tr:nth-child(even) td {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top-bar"></div>
    <div class="content">
      <div class="header">
        <div class="brand">
          ${logoHtml}
          <div>
            <h1>${escapeHtml(companyName)}</h1>
            <p class="tagline">${escapeHtml(tagline)}</p>
            <p class="contact">${escapeHtml(contactLine)}</p>
          </div>
        </div>
        <div class="doc-title">
          <span class="badge">FACTURE</span>
          <p class="num">N° ${escapeHtml(row.invoiceId)}</p>
          <p class="meta">Date d'emission : ${dateLabel}</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Facture a</h3>
          <p><strong>Client :</strong> ${escapeHtml(row.clientName)}</p>
          <p><strong>Entreprise :</strong> ${escapeHtml(row.company)}</p>
          <p><strong>Telephone :</strong> ${escapeHtml(row.phone || "—")}</p>
        </div>
        <div class="card">
          <h3>Details de la facture</h3>
          <p><strong>Type :</strong> ${escapeHtml(summarizeInvoiceType(lines) || row.invoiceType || "Mixte")}</p>
          <p><strong>Devise :</strong> ${escapeHtml(currencyLabel)}</p>
          <p><strong>Reference :</strong> ${escapeHtml(reference)}</p>
          <p><strong>Remise :</strong> ${totals.remisePercent}%</p>
          ${
            row.invoiceType === "Domaine"
              ? `<p><strong>Domaine :</strong> ${escapeHtml(row.domainName || "—")}</p>
                 <p><strong>Expiration :</strong> ${
                   row.expirationDate
                     ? new Date(row.expirationDate).toLocaleDateString("fr-FR")
                     : "—"
                 }</p>`
              : ""
          }
        </div>
      </div>

      <table class="lines">
        <colgroup>
          <col class="c-nu" />
          <col class="c-type" />
          <col class="c-des" />
          <col class="c-unite" />
          <col class="c-qte" />
          <col class="c-prix" />
          <col class="c-montant" />
        </colgroup>
        <thead>
          <tr>
            <th class="center">Nu</th>
            <th>Type</th>
            <th>Designation</th>
            <th class="center">Unite</th>
            <th class="num">Qte</th>
            <th class="num">Prix unit.</th>
            <th class="num">Montant</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="7">Aucune ligne</td></tr>`}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-box">
          <div class="row"><span>Sous-total</span><span>${subtotalLabel}</span></div>
          <div class="row"><span>Remise (${totals.remisePercent}%)</span><span>- ${discountLabel}</span></div>
          <div class="row total"><span>NET A PAYER</span><span>${total}</span></div>
        </div>
      </div>

      <div class="schedule">
        <h3>Echeancier de paiement</h3>
        <div class="schedule-rows">
          <div class="schedule-row">
            <span>Acompte (50%) a la commande</span>
            <strong>${acompte}</strong>
          </div>
          <div class="schedule-row">
            <span>Solde (45%) dans le temps travaux</span>
            <strong>${soldeTravaux}</strong>
          </div>
          <div class="schedule-row">
            <span>Solde (5%) apres le travail</span>
            <strong>${soldeFinal}</strong>
          </div>
        </div>
      </div>

      <div class="bank-conditions">
        <div class="conditions-box">
          <h3 class="conditions-head">Conditions</h3>
          <table class="conditions">
            <tbody>
              <tr>
                <td class="label">Paiement</td>
                <td class="value">50% a la commande · 45% pendant les travaux · 5% apres le travail</td>
              </tr>
              <tr>
                <td class="label">Reglement</td>
                <td class="value">Virement bancaire</td>
              </tr>
              <tr>
                <td class="label">Libelle</td>
                <td class="value">Indiquer le n° de facture dans le libelle du virement</td>
              </tr>
              <tr>
                <td class="label">Devise</td>
                <td class="value">Prix exprimes en ${escapeHtml(currencyLabel)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="signature">
        <div class="left">
          <p>Fait a ${escapeHtml(settings.address || "Djibouti")}, le ${dateLabel}</p>
          <p>${escapeHtml(bankHolder)}</p>
          <p class="thanks">Merci de votre confiance !</p>
        </div>
        <div class="right">
          <strong>${escapeHtml(companyName)}</strong>
          <div class="stamp">Signature &amp; cachet</div>
        </div>
      </div>

      <div class="footer">
        ${escapeHtml(companyName)} · ${escapeHtml(settings.address || "Djibouti")} · ${escapeHtml(settings.website || "https://geosomtech.com")} · ${escapeHtml(settings.companyEmail || "")} · ${escapeHtml(settings.companyPhone || "")}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  function sendViaWhatsApp(row: InvoiceApi) {
    const message = [
      `Bonjour ${row.clientName},`,
      "",
      `Voici votre facture ${row.invoiceId}.`,
      `Entreprise : ${row.company}`,
      `Net a payer : ${formatMoney(row.amount || 0, currency)}`,
      "Paiement : 50% a la commande, 45% pendant les travaux, 5% apres le travail",
      "",
      `${settings.companyName} — ${settings.companyPhone || ""}`
    ].join("\n");
    const phone = String(row.phone || "").replace(/[^\d]/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function sendViaEmail(row: InvoiceApi) {
    const linesText = invoiceLinesOf(row)
      .map((l) => `- ${l.designation} | Qt: ${l.quantite} | ${formatMoney(l.montant, currency)}`)
      .join("\n");
    const subject = `Facture ${row.invoiceId} — ${row.company}`;
    const body = [
      `Bonjour ${row.clientName},`,
      "",
      "Veuillez trouver le resume de votre facture.",
      `N° : ${row.invoiceId}`,
      `Net a payer : ${formatMoney(row.amount || 0, currency)}`,
      "",
      "Details :",
      linesText,
      "",
      "Cordialement,",
      settings.companyName
    ].join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function exportFacturePdf(row: InvoiceApi) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const defaultBank = resolveCompanyBank(settings, banks);
    const bank = {
      name: row.bankName || defaultBank.name,
      accountNumber: row.bankAccountNumber || "",
      accountHolder: row.bankAccountHolder || defaultBank.accountHolder,
      iban: row.bankIban || defaultBank.iban,
      swift: row.bankSwift || defaultBank.swift
    };
    const companyName = settings.companyName || "AL-HAKIM GROUP";
    const bankHolder = bank.accountHolder || companyName;
    const dateLabel = new Date(row.date).toLocaleDateString("fr-FR");
    const pageW = doc.internal.pageSize.getWidth();
    const lines = invoiceLinesOf(row);
    const totals = calcInvoiceTotals(lines, row.remisePercent);
    const subtotalLabel = formatMoneyPdf(totals.subtotal, currency);
    const discountLabel = formatMoneyPdf(totals.discountAmount, currency);
    const total = formatMoneyPdf(totals.net, currency);
    const acompte = formatMoneyPdf(totals.net * 0.5, currency);
    const soldeTravaux = formatMoneyPdf(totals.net * 0.45, currency);
    const soldeFinal = formatMoneyPdf(totals.net * 0.05, currency);
    const reference = row.reference?.trim() || "—";

    doc.setFillColor(16, 28, 78);
    doc.rect(0, 0, pageW, 8, "F");

    if (settings.logoDataUrl) addLogoToPdf(doc, settings.logoDataUrl, 14, 12, 34, 34);

    const leftX = settings.logoDataUrl ? 54 : 14;
    doc.setTextColor(16, 28, 78);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(companyName.toUpperCase(), leftX, 22);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text("L'excellence au service de vos projets.", leftX, 28);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `${settings.companyEmail || "contact@geosomtech.com"} | ${settings.companyPhone || "+253 77 26 10 01"} | ${settings.address || "Djibouti"}`,
      leftX,
      34
    );

    doc.setFillColor(16, 28, 78);
    doc.roundedRect(148, 14, 48, 9, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("FACTURE", 172, 20, { align: "center" });
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(`N° ${row.invoiceId}`, 196, 28, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date d'emission : ${dateLabel}`, 196, 33, { align: "right" });

    doc.setDrawColor(16, 28, 78);
    doc.setLineWidth(0.6);
    doc.line(14, 38, pageW - 14, 38);

    const boxY = 44;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, boxY, 88, 28, 2, 2, "FD");
    doc.roundedRect(108, boxY, 88, 28, 2, 2, "FD");
    doc.setTextColor(16, 28, 78);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("FACTURE A", 18, boxY + 7);
    doc.text("DETAILS DE LA FACTURE", 112, boxY + 7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    doc.text(`Client : ${row.clientName}`, 18, boxY + 13);
    doc.text(`Entreprise : ${row.company}`, 18, boxY + 18);
    doc.text(`Telephone : ${row.phone || "—"}`, 18, boxY + 23);
    doc.text(`Devise : ${currency === "FDJ" ? "Franc Djiboutien (FDJ)" : currency}`, 112, boxY + 13);
    doc.text(`Type : ${summarizeInvoiceType(lines) || row.invoiceType || "Mixte"}`, 112, boxY + 18);
    doc.text(`Reference : ${reference}`, 112, boxY + 23);

    autoTable(doc, {
      startY: 80,
      head: [["Nu", "Type", "Designation", "Unite", "Qte", "Prix unit.", "Montant"]],
      body: lines.map((line, index) => [
        String(index + 1),
        line.category || "—",
        line.designation,
        formatUniteMeasure(line),
        String(line.quantite),
        formatMoneyPdf(line.prixUnitaire, currency),
        formatMoneyPdf(line.montant, currency)
      ]),
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        textColor: [51, 65, 85],
        overflow: "linebreak",
        valign: "middle"
      },
      headStyles: {
        fillColor: [16, 28, 78],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7.5,
        overflow: "ellipsize",
        valign: "middle"
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 32 },
        2: { cellWidth: 42 },
        3: { cellWidth: 28, halign: "center" },
        4: { cellWidth: 14, halign: "right" },
        5: { cellWidth: 26, halign: "right", overflow: "ellipsize" },
        6: { cellWidth: 30, halign: "right", overflow: "ellipsize" }
      },
      margin: { left: 14, right: 14 }
    });

    const docExt = doc as typeof doc & { lastAutoTable?: { finalY: number } };
    let y = (docExt.lastAutoTable?.finalY ?? 110) + 8;

    doc.setFillColor(238, 240, 248);
    doc.setDrawColor(178, 183, 198);
    doc.roundedRect(118, y, 78, 30, 2, 2, "FD");
    doc.setDrawColor(178, 183, 198);
    doc.line(118, y + 10, 196, y + 10);
    doc.line(118, y + 19, 196, y + 19);
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Sous-total", 122, y + 7);
    doc.text(subtotalLabel, 192, y + 7, { align: "right" });
    doc.text(`Remise (${totals.remisePercent}%)`, 122, y + 16);
    doc.text(`- ${discountLabel}`, 192, y + 16, { align: "right" });
    doc.setTextColor(16, 28, 78);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("NET A PAYER", 122, y + 25.5);
    doc.text(total, 192, y + 25.5, { align: "right" });

    y += 36;
    doc.setFillColor(238, 240, 245);
    doc.setDrawColor(178, 183, 198);
    doc.roundedRect(14, y, 182, 34, 2, 2, "FD");
    doc.setTextColor(4, 49, 166);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("ECHEANCIER DE PAIEMENT", 18, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    doc.text("Acompte (50%) a la commande", 18, y + 15);
    doc.setFont("helvetica", "bold");
    doc.text(acompte, 192, y + 15, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text("Solde (45%) dans le temps travaux", 18, y + 22);
    doc.setFont("helvetica", "bold");
    doc.text(soldeTravaux, 192, y + 22, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text("Solde (5%) apres le travail", 18, y + 29);
    doc.setFont("helvetica", "bold");
    doc.text(soldeFinal, 192, y + 29, { align: "right" });

    y += 40;
    autoTable(doc, {
      startY: y,
      head: [[{ content: "CONDITIONS", colSpan: 2, styles: { halign: "left" } }]],
      body: [
        ["Paiement", "50% a la commande · 45% pendant les travaux · 5% apres le travail"],
        ["Reglement", "Virement bancaire"],
        ["Libelle", "Indiquer le n° de facture dans le libelle du virement"],
        ["Devise", `Prix exprimes en ${currency === "FDJ" ? "Franc Djiboutien (FDJ)" : currency}`]
      ],
      styles: {
        fontSize: 8,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        textColor: [51, 65, 85],
        valign: "middle",
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [16, 28, 78],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }
      },
      bodyStyles: { fillColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 36, fontStyle: "bold", textColor: [16, 28, 78] },
        1: { cellWidth: 146 }
      },
      margin: { left: 14, right: 14 },
      theme: "grid"
    });

    y = (docExt.lastAutoTable?.finalY ?? y + 40) + 10;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(`Fait a ${settings.address || "Djibouti"}, le ${dateLabel}`, 14, y);
    doc.text(bankHolder, 14, y + 6);
    doc.setTextColor(16, 28, 78);
    doc.setFont("helvetica", "bold");
    doc.text("Merci de votre confiance !", 14, y + 13);
    doc.text(companyName, 150, y);
    doc.setDrawColor(148, 163, 184);
    doc.line(140, y + 18, 196, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Signature & cachet", 168, y + 23, { align: "center" });

    doc.setFontSize(8);
    doc.text(
      `${companyName} · ${settings.address || "Djibouti"} · ${settings.website || "https://geosomtech.com"} · ${settings.companyEmail || ""} · ${settings.companyPhone || ""}`,
      pageW / 2,
      285,
      { align: "center" }
    );

    doc.save(`facture-${row.invoiceId}.pdf`);
  }

  function viewFacture(row: InvoiceApi) {
    setPreviewRow(row);
  }

  function closePreview() {
    setPreviewRow(null);
  }

  function printFromPreview() {
    const iframe = previewIframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }

  /** Ouvre une fenetre dediee pour un vrai apercu d'impression navigateur. */
  function printFacture(row: InvoiceApi) {
    const html = buildFactureHtml(row);
    const win = window.open("", "_blank", "noopener,noreferrer,width=920,height=1100");
    if (!win) {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.position = "fixed";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.left = "-9999px";
      document.body.appendChild(iframe);
      const idoc = iframe.contentDocument;
      if (!idoc) {
        document.body.removeChild(iframe);
        return;
      }
      idoc.open();
      idoc.write(html);
      idoc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {
            /* ignore */
          }
        }, 800);
      }, 250);
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 350);
  }

  return (
    <section className="invoice-page invoice-pro">
      <header className="invoice-pro-hero">
        <div className="invoice-pro-hero-inner">
          <div>
            <span className="invoice-pro-badge">{t("common.brand")} · {t("invoices.title")}</span>
            <h1>{t("invoices.title")}</h1>
            <p>{t("invoices.subtitle")}</p>
          </div>
          <div className="invoice-hero-actions">
            {invoiceFormVisible ? (
              <button type="button" className="invoice-btn-hero invoice-btn-hero--outline" onClick={closeInvoiceForm}>
                {t("invoices.closeForm")}
              </button>
            ) : null}
            <button type="button" className="invoice-btn-hero" onClick={openNewInvoiceForm}>
              <Plus size={18} />
              {t("invoices.new")}
            </button>
          </div>
        </div>
      </header>

      {!invoiceFormVisible ? (
        <div className="invoice-form-placeholder">
          <p dangerouslySetInnerHTML={{ __html: t("invoices.placeholder") }} />
        </div>
      ) : (
      <section className="invoice-form-card">
        <h2>{editingId ? t("invoices.edit") : t("invoices.new")}</h2>
        <p className="invoice-section-hint" style={{ marginTop: 0 }}>
          Vous pouvez ajouter plusieurs lignes avec des types et designations differents sur la meme facture.
        </p>
        <div className="invoice-form-grid">
          <label>
            <span>Client enregistre</span>
            <select
              value={form.clientId}
              onChange={(e) => {
                const clientId = e.target.value;
                const client = clients.find((c) => c._id === clientId);
                setForm({
                  ...form,
                  clientId,
                  nomClient: client?.contactName || client?.name || "",
                  entreprise: client?.name || "",
                  telephone: client?.phone || ""
                });
              }}
            >
              <option value="">Saisie libre / nouveau client</option>
              {clients.map((client) => (
                <option key={client._id} value={client._id}>
                  {client.name} — {client.contactName || "Sans contact"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Personne de contact *</span>
            <input value={form.nomClient} onChange={(e) => setForm({ ...form, nomClient: e.target.value })} placeholder="Nom du client" />
          </label>
          <label>
            <span>Entreprise / organisation *</span>
            <input value={form.entreprise} onChange={(e) => setForm({ ...form, entreprise: e.target.value })} placeholder="Entreprise" />
          </label>
          <label>
            <span>Telephone *</span>
            <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+253 ..." />
          </label>
          <label>
            <span>Type de facture *</span>
            <select
              value={lineForm.category}
              onChange={(e) => {
                const category = e.target.value as ClientActivityCategory;
                setLineForm({
                  ...lineForm,
                  category,
                  serviceId: "",
                  prixUnitaire: 0
                });
              }}
            >
              {CLIENT_ACTIVITY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Service (designation) *</span>
            <select
              value={lineForm.serviceId}
              onChange={(e) => {
                const serviceId = e.target.value;
                const service = servicesForType.find((s) => s._id === serviceId);
                setLineForm({
                  ...lineForm,
                  serviceId,
                  prixUnitaire: service?.price || lineForm.prixUnitaire || 0
                });
              }}
            >
              <option value="">Selectionner un service</option>
              {servicesForType.map((service) => (
                <option key={service._id} value={service._id}>
                  {serviceLabel(service)}
                  {service.price > 0 ? ` (${formatMoney(service.price, currency)})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Quantite</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={lineForm.quantite}
              onChange={(e) =>
                setLineForm({ ...lineForm, quantite: Math.max(0.01, Number(e.target.value) || 1) })
              }
            />
          </label>
          <label>
            <span>Unite</span>
            <select
              value={lineForm.unite}
              onChange={(e) => updateLineUnite(e.target.value as InvoiceUnit)}
            >
              {INVOICE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
          {needsDimensions(lineForm.unite) ? (
            <>
              <label>
                <span>Largeur (m)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={lineForm.largeur || ""}
                  onChange={(e) => updateLineDimension("largeur", Number(e.target.value))}
                  placeholder="ex: 125"
                />
              </label>
              <label>
                <span>Longueur (m)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={lineForm.longueur || ""}
                  onChange={(e) => updateLineDimension("longueur", Number(e.target.value))}
                  placeholder="ex: 140"
                />
              </label>
              <label className="span-2">
                <span>Apercu unite</span>
                <input
                  type="text"
                  readOnly
                  value={formatUniteMeasure({
                    unite: lineForm.unite,
                    largeur: lineForm.largeur,
                    longueur: lineForm.longueur
                  })}
                />
              </label>
            </>
          ) : null}
          <label>
            <span>Prix unit. ({currency})</span>
            <input
              type="number"
              min={0}
              step={1}
              value={lineForm.prixUnitaire}
              onChange={(e) =>
                setLineForm({
                  ...lineForm,
                  prixUnitaire: Math.max(0, Number(e.target.value) || 0)
                })
              }
              placeholder="Saisir le montant"
            />
          </label>
          <label>
            <span>Montant ({currency})</span>
            <input type="text" value={formatMoney(lineMontant, currency)} readOnly />
          </label>
          <label>
            <span>Remise (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.remisePercent}
              onChange={(e) =>
                setForm({
                  ...form,
                  remisePercent: clampRemisePercent(e.target.value)
                })
              }
              placeholder="ex: 10"
            />
          </label>
          <label>
            <span>Total global ({currency})</span>
            <input type="text" value={formatMoney(formTotals.net, currency)} readOnly />
          </label>
        </div>

        <div className="invoice-toolbar">
          <button type="button" className="invoice-btn invoice-btn--secondary" onClick={addLine}>
            Ajouter designation
          </button>
          <button type="button" className="invoice-btn invoice-btn--primary" onClick={() => void upsertFacture()} disabled={saving}>
            <FileDown size={16} />
            {saving ? "Enregistrement..." : editingId ? "Enregistrer la modification" : "Enregistrer la facture"}
          </button>
          {editingId ? (
            <button type="button" className="invoice-btn invoice-btn--ghost" onClick={resetForm}>
              Annuler
            </button>
          ) : null}
        </div>

        <div className="table-responsive table-responsive--bordered">
          <table className="crm-data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Designation</th>
                <th>Unite</th>
                <th>Qté</th>
                <th>Prix unit.</th>
                <th>Montant</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="crm-empty">
                    Aucune designation. Ajoutez des lignes ci-dessus avant d&apos;enregistrer la facture.
                  </td>
                </tr>
              ) : (
                lignes.map((line, index) => (
                  <tr key={`${line.designation}-${index}`}>
                    <td>{line.category || "—"}</td>
                    <td><strong>{line.designation}</strong></td>
                    <td>{formatUniteMeasure(line)}</td>
                    <td>{line.quantite}</td>
                    <td>{formatMoney(line.prixUnitaire, currency)}</td>
                    <td>{formatMoney(line.montant, currency)}</td>
                    <td>
                      <button
                        type="button"
                        className="invoice-icon-btn invoice-icon-btn--danger"
                        title="Supprimer la ligne"
                        onClick={() => removeLine(index)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {lignes.length > 0 ? (
          <div className="invoice-form-totals">
            <div className="invoice-form-totals-row">
              <span>Sous-total</span>
              <strong>{formatMoney(formTotals.subtotal, currency)}</strong>
            </div>
            <div className="invoice-form-totals-row">
              <span>Remise ({formTotals.remisePercent}%)</span>
              <strong>- {formatMoney(formTotals.discountAmount, currency)}</strong>
            </div>
            <div className="invoice-form-totals-row invoice-form-totals-row--net">
              <span>Total global / NET A PAYER</span>
              <strong>{formatMoney(formTotals.net, currency)}</strong>
            </div>
          </div>
        ) : null}
      </section>
      )}

      <h3 className="invoice-section-title">{t("invoices.all")}</h3>
      <p className="invoice-section-hint">Actions rapides : apercu, validation, edition, envoi et export.</p>
      <div className="invoice-list-card">
        <div className="table-responsive">
          <table className="crm-data-table crm-data-table--list">
            <thead>
              <tr>
                <th>Id</th>
                <th>Type</th>
                <th>Client</th>
                <th>Entreprise</th>
                <th>Tel.</th>
                <th>Expiration</th>
                <th>Compte</th>
                <th>Services</th>
                <th>Lignes</th>
                <th>Qté</th>
                <th>Total</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={13} className="crm-empty">
                    {t("invoices.emptyList")}
                  </td>
                </tr>
              ) : (
                invoices.map((row) => {
                  const lines = invoiceLinesOf(row);
                  return (
                    <tr key={row._id}>
                      <td className="crm-mono-id">{row.invoiceId}</td>
                      <td>{summarizeInvoiceType(lines) || row.invoiceType || "Mixte"}</td>
                      <td>{row.clientName}</td>
                      <td>{row.company}</td>
                      <td>{row.phone || "—"}</td>
                      <td>
                        {row.expirationDate
                          ? new Date(row.expirationDate).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td>
                        {row.bankName || "—"}
                        {row.bankAccountNumber ? ` · ${row.bankAccountNumber}` : ""}
                      </td>
                      <td>{lines.map((line) => line.designation).join(", ") || "—"}</td>
                      <td>{lines.length}</td>
                      <td>{lines.reduce((sum, line) => sum + Number(line.quantite || 0), 0)}</td>
                      <td>
                        <strong>{formatMoney(Number(row.amount || 0), currency)}</strong>
                        {clampRemisePercent(row.remisePercent) > 0 ? (
                          <div className="invoice-remise-hint">
                            Remise {clampRemisePercent(row.remisePercent)}%
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span className={row.isValidated ? "invoice-badge invoice-badge--validated" : "invoice-badge invoice-badge--draft"}>
                          {row.isValidated ? "Validee" : "Brouillon"}
                        </span>
                      </td>
                      <td>
                        <div className="invoice-actions-cell">
                          <div className="invoice-actions-primary">
                            <button
                              type="button"
                              className="invoice-action-text"
                              title="Voir la facture"
                              onClick={() => viewFacture(row)}
                            >
                              <Eye size={14} />
                              Voir
                            </button>
                            <button
                              type="button"
                              className="invoice-action-text invoice-action-text--accent"
                              title="Imprimer la facture"
                              onClick={() => printFacture(row)}
                            >
                              <Printer size={14} />
                              Imprimer
                            </button>
                          </div>
                          <div className="invoice-actions-bar">
                            <button
                              type="button"
                              className="invoice-icon-btn invoice-icon-btn--success"
                              title="Valider"
                              onClick={() => void validateFacture(row)}
                              disabled={!!row.isValidated}
                            >
                              <CheckCircle2 size={15} />
                            </button>
                            <button type="button" className="invoice-icon-btn" title="Modifier" onClick={() => void editFacture(row)}>
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="invoice-icon-btn invoice-icon-btn--danger"
                              title="Supprimer"
                              onClick={() => void deleteFacture(row)}
                              disabled={!!row.isValidated}
                            >
                              <Trash2 size={15} />
                            </button>
                            <button type="button" className="invoice-icon-btn" title="Envoyer WhatsApp" onClick={() => sendViaWhatsApp(row)}>
                              <MessageCircle size={15} />
                            </button>
                            <button type="button" className="invoice-icon-btn" title="Envoyer email" onClick={() => sendViaEmail(row)}>
                              <Mail size={15} />
                            </button>
                            <button type="button" className="invoice-icon-btn" title="Telecharger PDF" onClick={() => exportFacturePdf(row)}>
                              <FileDown size={15} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewRow ? (
        <div
          className="invoice-preview-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-preview-title"
          tabIndex={-1}
          onClick={(e) => e.target === e.currentTarget && closePreview()}
        >
          <div className="invoice-preview-modal">
            <div className="invoice-preview-toolbar">
              <h4 id="invoice-preview-title" className="invoice-preview-title">
                Apercu — {previewRow.invoiceId}
              </h4>
              <div className="invoice-preview-toolbar-actions">
                <button
                  type="button"
                  className="invoice-action-text"
                  title="Voir"
                  onClick={() => previewIframeRef.current?.contentWindow?.focus()}
                >
                  <Eye size={14} />
                  Voir
                </button>
                <button
                  type="button"
                  className="invoice-action-text invoice-action-text--accent"
                  title="Imprimer"
                  onClick={printFromPreview}
                >
                  <Printer size={14} />
                  Imprimer
                </button>
                <button
                  type="button"
                  className="invoice-icon-btn"
                  title="Envoyer WhatsApp"
                  onClick={() => sendViaWhatsApp(previewRow)}
                >
                  <MessageCircle size={15} />
                </button>
                <button
                  type="button"
                  className="invoice-icon-btn"
                  title="Envoyer email"
                  onClick={() => sendViaEmail(previewRow)}
                >
                  <Mail size={15} />
                </button>
                <button
                  type="button"
                  className="invoice-icon-btn"
                  title="Telecharger PDF"
                  onClick={() => exportFacturePdf(previewRow)}
                >
                  <FileDown size={15} />
                </button>
                <button type="button" className="invoice-btn invoice-btn--primary" onClick={closePreview}>
                  Fermer
                </button>
              </div>
            </div>
            <iframe
              ref={previewIframeRef}
              title={`Facture ${previewRow.invoiceId}`}
              className="invoice-preview-frame"
              srcDoc={buildFactureHtml(previewRow)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

