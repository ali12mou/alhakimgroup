import { useMemo, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { api } from "../../services/apiService";
import type { Bank, Client, InvoicePaymentDoc, Setting } from "../../types";
import { formatMoney } from "../../utils";

type InvoiceRow = {
  _id: string;
  invoiceId: string;
  invoiceType?: "Service" | "Domaine" | string;
  client?: string | { _id: string };
  clientName: string;
  company: string;
  phone?: string;
  domainName?: string;
  expirationDate?: string | null;
  bank?: string | { _id: string };
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  amount?: number;
  date: string;
  paymentStatus: string;
  paymentMethod: string;
  isValidated?: boolean;
  lines?: Array<{
    designation: string;
    description: string;
    category?: string;
    unite?: string;
    quantite: number;
    prixUnitaire: number;
    montant: number;
  }>;
};

type PaiementFactureProps = {
  clients: Client[];
  banks: Bank[];
  settings: Setting;
  invoices: InvoiceRow[];
  invoicePayments: InvoicePaymentDoc[];
  currency: string;
  onRefresh: () => Promise<void>;
};

const paymentMethods = [
  "Virement bancaire",
  "Mobile money",
  "Especes",
  "Cheque",
  "Autre"
] as const;

export default function PaiementFacture({
  clients,
  banks,
  settings,
  invoices,
  invoicePayments,
  currency,
  onRefresh
}: PaiementFactureProps) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState("");
  const [invoiceDbId, setInvoiceDbId] = useState("");
  const [method, setMethod] = useState<string>(paymentMethods[0]);
  const [bankId, setBankId] = useState("");
  const [amount, setAmount] = useState("");
  const [payStatus, setPayStatus] = useState<"Paye" | "Non paye">("Paye");
  const [proofDataUrl, setProofDataUrl] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const trackableInvoices = useMemo(() => invoices, [invoices]);

  const filteredInvoices = useMemo(
    () =>
      trackableInvoices.filter(
        (inv) => !monthFilter || String(inv.date).slice(0, 7) === monthFilter
      ),
    [monthFilter, trackableInvoices]
  );

  const filteredPayments = useMemo(
    () =>
      invoicePayments.filter(
        (payment) =>
          !monthFilter || String(payment.date).slice(0, 7) === monthFilter
      ),
    [invoicePayments, monthFilter]
  );

  const paidByInvoiceRef = useMemo(() => {
    return invoicePayments.reduce<Record<string, number>>((acc, payment) => {
      const key = payment.invoiceRef || "";
      if (!key || payment.status === "Non paye") return acc;
      acc[key] = (acc[key] || 0) + Number(payment.amount || 0);
      return acc;
    }, {});
  }, [invoicePayments]);

  const pendingInvoices = useMemo(
    () =>
      trackableInvoices.filter(
        (invoice) =>
          invoice.paymentStatus === "En attente" &&
          Number(invoice.amount || 0) -
            Number(paidByInvoiceRef[invoice.invoiceId] || 0) >
          0
      ),
    [paidByInvoiceRef, trackableInvoices]
  );

  function invoiceClientKey(invoice: InvoiceRow) {
    const relationId =
      typeof invoice.client === "object" && invoice.client
        ? invoice.client._id
        : typeof invoice.client === "string"
          ? invoice.client
          : "";
    return relationId
      ? `client:${relationId}`
      : `snapshot:${invoice.company.trim().toLowerCase()}|${invoice.clientName
          .trim()
          .toLowerCase()}`;
  }

  const pendingClientOptions = useMemo(() => {
    const options = new Map<string, string>();
    pendingInvoices.forEach((invoice) => {
      const key = invoiceClientKey(invoice);
      const label =
        invoice.company && invoice.company !== invoice.clientName
          ? `${invoice.company} — ${invoice.clientName}`
          : invoice.clientName || invoice.company;
      if (!options.has(key)) options.set(key, label);
    });
    return Array.from(options, ([key, label]) => ({ key, label }));
  }, [pendingInvoices]);

  const invoicesForClient = useMemo(() => {
    if (!clientId) return [];
    return pendingInvoices.filter(
      (invoice) => invoiceClientKey(invoice) === clientId
    );
  }, [clientId, pendingInvoices]);

  function resetForm() {
    setClientId("");
    setInvoiceDbId("");
    setMethod(paymentMethods[0]);
    setBankId("");
    setAmount("");
    setPayStatus("Paye");
    setProofDataUrl("");
  }

  function onProofFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setProofDataUrl("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProofDataUrl(String(reader.result || ""));
    reader.readAsDataURL(f);
  }

  async function savePayment() {
    if (!clientId || !invoiceDbId || !bankId) {
      window.alert("Selectionnez un client, une facture et le compte bancaire.");
      return;
    }
    const amt = Number(amount.replace(/\s/g, "").replace(",", ".")) || 0;
    if (amt <= 0) {
      window.alert("Indiquez un montant valide.");
      return;
    }
    const inv = invoices.find((i) => i._id === invoiceDbId);
    const cli = clients.find((c) => clientId === `client:${c._id}`);
    const bank = banks.find((b) => b._id === bankId);
    if (!inv || !bank) return;
    const alreadyPaid = Number(paidByInvoiceRef[inv.invoiceId] || 0);
    const remaining = Math.max(0, Number(inv.amount || 0) - alreadyPaid);
    if (payStatus === "Paye" && amt > remaining) {
      window.alert(
        `Le montant depasse le reste a payer (${formatMoney(remaining, currency)}).`
      );
      return;
    }

    setSaving(true);
    try {
      const paymentId = `PAY-${Date.now()}`;
      await api.post("/billing/invoice-payments", {
        paymentId,
        invoiceRef: inv.invoiceId,
        clientName: cli?.name || inv.company || inv.clientName,
        bank: bank._id,
        bankName: bank.name,
        bankAccountNumber: bank.accountNumberOrWallet || "",
        date: new Date().toISOString(),
        method,
        amount: amt,
        status: payStatus,
        proofImageDataUrl: proofDataUrl || ""
      });
      await api.put(`/billing/invoices/${inv._id}`, {
        paymentStatus:
          payStatus === "Non paye"
            ? "En attente"
            : alreadyPaid + amt >= Number(inv.amount || 0)
              ? "Paye"
              : "Partiel",
        paymentMethod: method
      });
      resetForm();
      setShowForm(false);
      await onRefresh();
    } catch {
      window.alert("Erreur lors de l'enregistrement du paiement.");
    } finally {
      setSaving(false);
    }
  }

  const invoicedTotal = filteredInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount || 0),
    0
  );
  const paidTotal = filteredPayments
    .filter((payment) => payment.status !== "Non paye")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const remainingTotal = filteredInvoices.reduce(
    (sum, invoice) =>
      sum +
      Math.max(
        0,
        Number(invoice.amount || 0) -
          Number(paidByInvoiceRef[invoice.invoiceId] || 0)
      ),
    0
  );
  const unpaidCount = filteredInvoices.filter(
    (invoice) => invoice.paymentStatus !== "Paye"
  ).length;

  function escapeHtml(value: unknown) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function openDocument(title: string, body: string, printNow = false) {
    const win = window.open("", "_blank", "width=920,height=1100");
    if (!win) {
      window.alert("Autorisez les fenetres popup pour afficher le document.");
      return;
    }
    win.document.open();
    win.document.write(`<!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: A4; margin: 0; }
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              font-family: Arial, Helvetica, "Segoe UI", sans-serif;
              color: #0f172a;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body { background: #e8eef3; }
            .sheet {
              width: 210mm;
              max-width: 100%;
              min-height: 297mm;
              margin: 0 auto;
              background: #fff;
              display: flex;
              flex-direction: column;
            }
            .top-bar {
              height: 8px;
              background: #101C4E !important;
              flex-shrink: 0;
            }
            .content { flex: 1; padding: 16mm 14mm 12mm; }
            .head {
              display: grid;
              grid-template-columns: 1.2fr 0.8fr;
              gap: 14px;
              align-items: start;
              padding-bottom: 14px;
              border-bottom: 2px solid #101C4E;
              margin-bottom: 16px;
            }
            .brand h1 {
              margin: 0;
              font-size: 18px;
              letter-spacing: 0.03em;
              text-transform: uppercase;
              color: #101C4E;
            }
            .brand .tagline {
              margin: 4px 0 0;
              color: #64748b;
              font-size: 11px;
              font-style: italic;
            }
            .brand .contact {
              margin: 6px 0 0;
              color: #64748b;
              font-size: 11px;
            }
            .doc-title { text-align: right; }
            .doc-title .badge {
              display: inline-block;
              padding: 7px 16px;
              border-radius: 999px;
              background: #101C4E !important;
              color: #fff !important;
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.08em;
            }
            .doc-title .num {
              margin: 10px 0 4px;
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
            }
            .doc-title .meta { margin: 0; color: #64748b; font-size: 11px; }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 16px;
            }
            .card {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px 14px;
              background: #f8fafc !important;
            }
            .card h3 {
              margin: 0 0 8px;
              font-size: 11px;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              color: #101C4E;
              font-weight: 800;
            }
            .card p { margin: 0 0 5px; font-size: 12px; color: #334155; }
            .card strong { color: #0f172a; }
            .amount-hero {
              margin: 0 0 16px;
              border-radius: 12px;
              border: 1px solid #B2B7C6;
              background: linear-gradient(135deg, #EEF0F8 0%, #E4E8F2 100%) !important;
              padding: 18px 20px;
              text-align: center;
            }
            .amount-hero .label {
              margin: 0;
              font-size: 11px;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #0431A6;
              font-weight: 800;
            }
            .amount-hero .value {
              margin: 8px 0 0;
              font-size: 28px;
              font-weight: 800;
              color: #101C4E;
              font-variant-numeric: tabular-nums;
            }
            .amount-hero .sub {
              margin: 6px 0 0;
              font-size: 12px;
              color: #64748b;
            }
            table.lines {
              width: 100%;
              border-collapse: collapse;
              margin-top: 4px;
              table-layout: fixed;
            }
            table.lines th, table.lines td {
              padding: 8px;
              font-size: 11px;
              vertical-align: middle;
              border-bottom: 1px solid #e5e7eb;
            }
            table.lines th {
              background: #101C4E !important;
              color: #fff !important;
              text-align: left;
              font-size: 9px;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              white-space: nowrap;
            }
            table.lines th:first-child { border-radius: 8px 0 0 0; }
            table.lines th:last-child { border-radius: 0 8px 0 0; }
            table.lines td.num, table.lines th.num {
              text-align: right;
              white-space: nowrap;
              font-variant-numeric: tabular-nums;
            }
            table.lines tbody tr:nth-child(even) { background: #f8fafc !important; }
            .totals {
              margin-top: 14px;
              display: flex;
              justify-content: flex-end;
            }
            .totals-box {
              min-width: 280px;
              border: 1px solid #B2B7C6;
              border-radius: 10px;
              overflow: hidden;
              background: #EEF0F8 !important;
            }
            .totals-box .row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 24px;
              padding: 10px 16px;
              font-size: 13px;
              color: #334155;
            }
            .totals-box .row.total {
              font-weight: 800;
              color: #101C4E;
              font-size: 14px;
              border-top: 1px solid #B2B7C6;
              background: #E4E8F2 !important;
              padding: 12px 16px;
            }
            .conditions-box {
              margin-top: 16px;
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
            table.conditions td {
              padding: 9px 14px;
              font-size: 12px;
              border-bottom: 1px solid #e5e7eb;
              vertical-align: middle;
            }
            table.conditions tr:last-child td { border-bottom: none; }
            table.conditions tr:nth-child(even) td { background: #f8fafc !important; }
            table.conditions td.label {
              width: 30%;
              font-weight: 700;
              color: #101C4E;
              white-space: nowrap;
            }
            table.conditions td.value { width: 70%; color: #334155; line-height: 1.45; }
            .note {
              margin: 16px 0 0;
              padding: 12px 14px;
              border-radius: 10px;
              border: 1px solid #bfdbfe;
              background: #eff6ff !important;
              color: #1e3a8a;
              font-size: 12px;
              line-height: 1.5;
            }
            .signature {
              margin-top: 28px;
              display: flex;
              justify-content: space-between;
              gap: 20px;
              align-items: flex-end;
            }
            .signature .left p { margin: 0 0 5px; font-size: 12px; color: #64748b; }
            .signature .thanks {
              margin-top: 10px !important;
              color: #101C4E !important;
              font-weight: 800;
              font-size: 13px !important;
            }
            .signature .right { min-width: 200px; text-align: center; }
            .signature .right strong {
              display: block;
              margin-bottom: 40px;
              color: #101C4E;
            }
            .signature .stamp {
              border-top: 1px solid #94a3b8;
              padding-top: 6px;
              font-size: 11px;
              color: #64748b;
            }
            .footer {
              margin-top: 22px;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
              text-align: center;
              color: #64748b;
              font-size: 10px;
            }
            @media (max-width: 720px) {
              body { background: #fff; }
              .sheet { width: 100%; min-height: auto; }
              .content { padding: 18px 14px 14px; }
              .head { grid-template-columns: 1fr; }
              .doc-title { text-align: left; }
              .grid-2 { grid-template-columns: 1fr; }
              .totals { justify-content: stretch; }
              .totals-box { width: 100%; }
              .signature { flex-direction: column; align-items: stretch; }
              .signature .right { text-align: left; min-width: 0; }
            }
            @media print {
              body { background: #fff !important; }
              .sheet { width: auto; min-height: auto; }
            }
          </style>
        </head>
        <body>${body}</body>
      </html>`);
    win.document.close();
    win.focus();
    if (printNow) setTimeout(() => win.print(), 300);
  }

  function invoiceDocument(invoice: InvoiceRow, printNow = false) {
    const companyName = settings.companyName || "AL-HAKIM GROUP";
    const tagline = "L'excellence au service de vos projets.";
    const contactLine = [
      settings.companyEmail || "contact@alhakimgroup.com",
      settings.companyPhone || "+253 77 70 34 36",
      settings.address || "Djibouti"
    ].join(" | ");
    const dateLabel = new Date(invoice.date).toLocaleDateString("fr-FR");
    const rows = (invoice.lines || [])
      .map(
        (line, index) => `<tr>
          <td class="num">${index + 1}</td>
          <td>${escapeHtml(line.designation)}</td>
          <td class="num">${escapeHtml(line.quantite)}</td>
          <td class="num">${escapeHtml(formatMoney(line.prixUnitaire, currency))}</td>
          <td class="num">${escapeHtml(formatMoney(line.montant, currency))}</td>
        </tr>`
      )
      .join("");
    openDocument(
      `Facture ${invoice.invoiceId}`,
      `<div class="sheet">
        <div class="top-bar"></div>
        <div class="content">
          <header class="head">
            <div class="brand">
              <h1>${escapeHtml(companyName)}</h1>
              <p class="tagline">${escapeHtml(tagline)}</p>
              <p class="contact">${escapeHtml(contactLine)}</p>
            </div>
            <div class="doc-title">
              <span class="badge">FACTURE</span>
              <p class="num">N° ${escapeHtml(invoice.invoiceId)}</p>
              <p class="meta">Date d'emission : ${escapeHtml(dateLabel)}</p>
            </div>
          </header>
          <section class="grid-2">
            <div class="card">
              <h3>Facture a</h3>
              <p><strong>Client :</strong> ${escapeHtml(invoice.clientName)}</p>
              <p><strong>Entreprise :</strong> ${escapeHtml(invoice.company)}</p>
              <p><strong>Telephone :</strong> ${escapeHtml(invoice.phone || "—")}</p>
            </div>
            <div class="card">
              <h3>Details de la facture</h3>
              <p><strong>Type :</strong> ${escapeHtml(invoice.invoiceType || "Mixte")}</p>
              <p><strong>Methode de paiement :</strong> ${escapeHtml(invoice.paymentMethod || "—")}</p>
              <p><strong>Statut :</strong> ${escapeHtml(invoice.paymentStatus || "—")}</p>
            </div>
          </section>
          <table class="lines">
            <thead>
              <tr>
                <th class="num">Nu</th>
                <th>Designation</th>
                <th class="num">Qte</th>
                <th class="num">Prix unit.</th>
                <th class="num">Montant</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="5">Aucune ligne</td></tr>'}</tbody>
          </table>
          <div class="totals">
            <div class="totals-box">
              <div class="row total">
                <span>NET A PAYER</span>
                <span>${escapeHtml(formatMoney(Number(invoice.amount || 0), currency))}</span>
              </div>
            </div>
          </div>
          <div class="signature">
            <div class="left">
              <p>Fait a ${escapeHtml(settings.address || "Djibouti")}, le ${escapeHtml(dateLabel)}</p>
              <p class="thanks">Merci de votre confiance !</p>
            </div>
            <div class="right">
              <strong>${escapeHtml(companyName)}</strong>
              <div class="stamp">Signature &amp; cachet</div>
            </div>
          </div>
          <footer class="footer">${escapeHtml(companyName)} · ${escapeHtml(settings.address || "Djibouti")} · ${escapeHtml(settings.website || "")}</footer>
        </div>
      </div>`,
      printNow
    );
  }

  function receiptDocument(payment: InvoicePaymentDoc, printNow = false) {
    const invoice = invoices.find((item) => item.invoiceId === payment.invoiceRef);
    const companyName = settings.companyName || "AL-HAKIM GROUP";
    const tagline = "L'excellence au service de vos projets.";
    const contactLine = [
      settings.companyEmail || "contact@alhakimgroup.com",
      settings.companyPhone || "+253 77 70 34 36",
      settings.address || "Djibouti"
    ].join(" | ");
    const dateLabel = new Date(payment.date).toLocaleDateString("fr-FR");
    const invoiceTotal = Number(invoice?.amount || 0);
    const paidAmount = Number(payment.amount || 0);
    const alreadyPaid = Number(paidByInvoiceRef[payment.invoiceRef] || 0);
    const remaining = Math.max(0, invoiceTotal - alreadyPaid);
    const statusLabel = payment.status === "Paye" ? "Paye" : payment.status;

    openDocument(
      `Recu ${payment.paymentId}`,
      `<div class="sheet">
        <div class="top-bar"></div>
        <div class="content">
          <header class="head">
            <div class="brand">
              <h1>${escapeHtml(companyName)}</h1>
              <p class="tagline">${escapeHtml(tagline)}</p>
              <p class="contact">${escapeHtml(contactLine)}</p>
            </div>
            <div class="doc-title">
              <span class="badge">RECU DE PAIEMENT</span>
              <p class="num">N° ${escapeHtml(payment.paymentId)}</p>
              <p class="meta">Date de reglement : ${escapeHtml(dateLabel)}</p>
            </div>
          </header>

          <div class="amount-hero">
            <p class="label">Montant recu</p>
            <p class="value">${escapeHtml(formatMoney(paidAmount, currency))}</p>
            <p class="sub">Statut : ${escapeHtml(statusLabel)} · Methode : ${escapeHtml(payment.method)}</p>
          </div>

          <section class="grid-2">
            <div class="card">
              <h3>Client</h3>
              <p><strong>Nom :</strong> ${escapeHtml(payment.clientName)}</p>
              <p><strong>Entreprise :</strong> ${escapeHtml(invoice?.company || payment.clientName)}</p>
              <p><strong>Telephone :</strong> ${escapeHtml(invoice?.phone || "—")}</p>
            </div>
            <div class="card">
              <h3>Facture concernee</h3>
              <p><strong>N° facture :</strong> ${escapeHtml(payment.invoiceRef)}</p>
              <p><strong>Total facture :</strong> ${escapeHtml(formatMoney(invoiceTotal, currency))}</p>
              <p><strong>Reste a payer :</strong> ${escapeHtml(formatMoney(remaining, currency))}</p>
            </div>
          </section>

          <div class="conditions-box">
            <h3 class="conditions-head">Details du reglement</h3>
            <table class="conditions">
              <tbody>
                <tr>
                  <td class="label">Methode</td>
                  <td class="value">${escapeHtml(payment.method)}</td>
                </tr>
                <tr>
                  <td class="label">Compte recepteur</td>
                  <td class="value">${escapeHtml(payment.bankName || "—")}</td>
                </tr>
                <tr>
                  <td class="label">Numero de compte</td>
                  <td class="value">${escapeHtml(payment.bankAccountNumber || "—")}</td>
                </tr>
                <tr>
                  <td class="label">Statut</td>
                  <td class="value">${escapeHtml(statusLabel)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="note">
            Nous, <strong>${escapeHtml(companyName)}</strong>, reconnaissons avoir recu le montant indique ci-dessus
            au titre de la facture <strong>${escapeHtml(payment.invoiceRef)}</strong>.
            Ce recu constitue une preuve de reglement.
          </p>

          <div class="signature">
            <div class="left">
              <p>Fait a ${escapeHtml(settings.address || "Djibouti")}, le ${escapeHtml(dateLabel)}</p>
              <p class="thanks">Merci de votre confiance !</p>
            </div>
            <div class="right">
              <strong>${escapeHtml(companyName)}</strong>
              <div class="stamp">Signature &amp; cachet</div>
            </div>
          </div>

          <footer class="footer">${escapeHtml(companyName)} · ${escapeHtml(settings.address || "Djibouti")} · ${escapeHtml(settings.website || "")} · ${escapeHtml(settings.companyEmail || "")}</footer>
        </div>
      </div>`,
      printNow
    );
  }

  return (
    <section className="billing-page">
      <header className="billing-header">
        <div>
          <h1>{t("payments.title")}</h1>
          <p>{t("payments.subtitle")}</p>
        </div>
        <button
          type="button"
          className="new-client-btn"
          onClick={() => {
            if (!showForm) resetForm();
            setShowForm((v) => !v);
          }}
        >
          <Plus size={16} />
          {showForm ? t("common.close") : t("payments.new")}
        </button>
      </header>

      {showForm ? (
        <section className="settings-panel">
          <h2>Enregistrer un paiement</h2>
          <div className="settings-form-grid">
            <label>
              <span>Client</span>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setInvoiceDbId("");
                  setBankId("");
                  setAmount("");
                }}
                aria-label="Choisir le client"
              >
                <option value="">
                  {pendingClientOptions.length
                    ? "Selectionner un client en attente"
                    : "Aucun client avec paiement en attente"}
                </option>
                {pendingClientOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Facture</span>
              <select
                value={invoiceDbId}
                onChange={(e) => {
                  const invoiceDbId = e.target.value;
                  const invoice = invoices.find((item) => item._id === invoiceDbId);
                  const invoiceBankId =
                    typeof invoice?.bank === "object" && invoice.bank
                      ? invoice.bank._id
                      : typeof invoice?.bank === "string"
                        ? invoice.bank
                        : banks.find(
                            (bank) =>
                              bank.name === invoice?.bankName &&
                              (!invoice?.bankAccountNumber ||
                                bank.accountNumberOrWallet ===
                                  invoice.bankAccountNumber)
                          )?._id || "";
                  setInvoiceDbId(invoiceDbId);
                  setBankId(invoiceBankId);
                  if (invoice) {
                    const remaining =
                      Number(invoice.amount || 0) -
                      Number(paidByInvoiceRef[invoice.invoiceId] || 0);
                    setAmount(String(Math.max(0, remaining)));
                  }
                }}
                disabled={!clientId || invoicesForClient.length === 0}
                aria-label="Choisir la facture"
              >
                <option value="">
                  {!clientId ? "Choisissez d'abord un client" : invoicesForClient.length === 0 ? "Aucune facture pour ce client" : "Selectionner une facture"}
                </option>
                {invoicesForClient.map((inv) => (
                  <option key={inv._id} value={inv._id}>
                    {inv.invoiceId} — {formatMoney(Number(inv.amount || 0), currency)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Methode de paiement</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {paymentMethods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Compte bancaire recepteur *</span>
              <select value={bankId} onChange={(e) => setBankId(e.target.value)}>
                <option value="">Selectionner le compte qui recoit le montant</option>
                {banks.map((bank) => (
                  <option key={bank._id} value={bank._id}>
                    {bank.name} — {bank.accountNumberOrWallet || "Compte non renseigne"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Montant</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 45000"
              />
            </label>
            <label className="span-2">
              <span>Statut</span>
              <div className="payment-status-pick">
                <label className="perm-chip">
                  <input type="radio" name="payStat" checked={payStatus === "Paye"} onChange={() => setPayStatus("Paye")} />
                  <span>Paiement recu</span>
                </label>
                <label className="perm-chip">
                  <input type="radio" name="payStat" checked={payStatus === "Non paye"} onChange={() => setPayStatus("Non paye")} />
                  <span>Non paye</span>
                </label>
              </div>
            </label>
            <label className="span-2">
              <span>Image facture / preuve (optionnel)</span>
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={onProofFile} />
              {proofDataUrl ? (
                <div className="logo-preview-wrap">
                  <img src={proofDataUrl} alt="Preuve" className="logo-preview" />
                  <button type="button" className="link-btn" onClick={() => setProofDataUrl("")}>Retirer l&apos;image</button>
                </div>
              ) : null}
            </label>
          </div>
          <div className="invoice-actions">
            <button type="button" className="new-client-btn" onClick={() => void savePayment()} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer le paiement"}
            </button>
            <button type="button" className="reports-export-btn" onClick={resetForm}>Reinitialiser</button>
          </div>
        </section>
      ) : null}

      <section className="settings-panel payment-month-filter">
        <div className="settings-form-grid">
          <label>
            <span>Filtrer par mois</span>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
          </label>
          <div className="invoice-actions">
            <button
              type="button"
              className="reports-export-btn"
              onClick={() => setMonthFilter("")}
            >
              Tous les mois
            </button>
          </div>
        </div>
      </section>

      <div className="billing-grid">
        <article className="billing-card">
          <h3>Montant facture</h3>
          <p>{formatMoney(invoicedTotal, currency)}</p>
          <small>{filteredInvoices.length} facture(s) sur la periode.</small>
        </article>
        <article className="billing-card">
          <h3>Paiements recus</h3>
          <p>{formatMoney(paidTotal, currency)}</p>
          <small>Paiements reels enregistres.</small>
        </article>
        <article className="billing-card">
          <h3>Reste a payer</h3>
          <p>{formatMoney(remainingTotal, currency)}</p>
          <small>{unpaidCount} facture(s) non soldee(s).</small>
        </article>
      </div>

      <h3 className="payment-section-title">Factures creees</h3>
      <div className="table-responsive">
      <table className="crm-data-table">
        <thead>
          <tr>
            <th>Id facture</th>
            <th>Type</th>
            <th>Client</th>
            <th>Entreprise</th>
            <th>Telephone</th>
            <th>Compte facture</th>
            <th>Date</th>
            <th>Expiration</th>
            <th>Montant</th>
            <th>Reste</th>
            <th>Statut paiement</th>
            <th>Methode</th>
            <th>Facture client</th>
          </tr>
        </thead>
        <tbody>
          {filteredInvoices.length === 0 ? (
            <tr>
              <td colSpan={13} className="muted">Aucune facture pour cette periode.</td>
            </tr>
          ) : (
            filteredInvoices.map((invoice) => (
              <tr key={invoice._id}>
                <td>{invoice.invoiceId}</td>
                <td>{invoice.invoiceType || "Service"}</td>
                <td>{invoice.clientName}</td>
                <td>{invoice.company}</td>
                <td>{invoice.phone || "-"}</td>
                <td>
                  {invoice.bankName || "-"}
                  {invoice.bankAccountNumber ? ` · ${invoice.bankAccountNumber}` : ""}
                </td>
                <td>{new Date(invoice.date).toLocaleDateString("fr-FR")}</td>
                <td>
                  {invoice.expirationDate
                    ? new Date(invoice.expirationDate).toLocaleDateString("fr-FR")
                    : "—"}
                </td>
                <td>{formatMoney(Number(invoice.amount || 0), currency)}</td>
                <td>
                  {formatMoney(
                    Math.max(
                      0,
                      Number(invoice.amount || 0) - Number(paidByInvoiceRef[invoice.invoiceId] || 0)
                    ),
                    currency
                  )}
                </td>
                <td>
                  <span className={invoice.paymentStatus === "Paye" ? "status-pill" : "tag no"}>
                    {invoice.paymentStatus === "Paye" ? "Paye" : invoice.paymentStatus === "Non paye" ? "Non paye" : invoice.paymentStatus}
                  </span>
                </td>
                <td>{invoice.paymentMethod}</td>
                <td>
                  <div className="actions">
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => invoiceDocument(invoice)}
                    >
                      Voir
                    </button>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => invoiceDocument(invoice, true)}
                    >
                      Imprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>

      <h3 className="payment-section-title">Historique des paiements enregistres</h3>
      <div className="table-responsive">
      <table className="crm-data-table">
        <thead>
          <tr>
            <th>Id paiement</th>
            <th>Facture</th>
            <th>Client</th>
            <th>Date</th>
            <th>Montant</th>
            <th>Compte recepteur</th>
            <th>Methode</th>
            <th>Statut</th>
            <th>Recu / preuve</th>
          </tr>
        </thead>
        <tbody>
          {filteredPayments.length === 0 ? (
            <tr>
              <td colSpan={9} className="muted">Aucun paiement pour cette periode.</td>
            </tr>
          ) : (
            filteredPayments.map((p) => (
              <tr key={p._id}>
                <td>{p.paymentId}</td>
                <td>{p.invoiceRef}</td>
                <td>{p.clientName}</td>
                <td>{new Date(p.date).toLocaleDateString("fr-FR")}</td>
                <td>{formatMoney(Number(p.amount || 0), currency)}</td>
                <td>
                  {p.bankName || "—"}
                  {p.bankAccountNumber ? ` · ${p.bankAccountNumber}` : ""}
                </td>
                <td>{p.method}</td>
                <td>
                  <span className={p.status === "Paye" ? "status-pill" : "tag no"}>
                    {p.status === "Paye" ? "Paye" : p.status === "Non paye" ? "Non paye" : p.status}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => receiptDocument(p)}
                    >
                      Recu
                    </button>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => receiptDocument(p, true)}
                    >
                      Imprimer
                    </button>
                    {p.proofImageDataUrl ? (
                      <a
                        href={p.proofImageDataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="link-btn"
                      >
                        Preuve
                      </a>
                    ) : null}
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

