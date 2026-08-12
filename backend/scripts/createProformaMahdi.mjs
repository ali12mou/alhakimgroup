import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const { Proforma } = await import("../src/models/Proforma.js");
const { Service } = await import("../src/models/Service.js");
const { Client } = await import("../src/models/Client.js");
const { Bank } = await import("../src/models/Bank.js");

/** @type {Array<{ category: string; designation: string; meter: string; qte: number; prix: number | null }>} */
const ROWS = [
  { category: "Menuiserie & Travaux en bois", designation: "Fabrication et pose de porte en bois", meter: "207*88", qte: 1, prix: 50000 },
  { category: "Menuiserie & Travaux en bois", designation: "Fabrication et pose de porte en bois", meter: "208*85", qte: 1, prix: 50000 },
  { category: "Menuiserie & Travaux en bois", designation: "Fabrication et pose de porte en bois", meter: "208*96", qte: 1, prix: null },
  { category: "Menuiserie & Travaux en bois", designation: "Fabrication et pose de porte en bois", meter: "207*90", qte: 1, prix: null },
  { category: "Menuiserie & Travaux en bois", designation: "Fabrication et pose de porte en bois", meter: "215*90", qte: 1, prix: null },
  { category: "Menuiserie & Travaux en bois", designation: "Fabrication et pose de porte en bois", meter: "215*91", qte: 1, prix: null },
  { category: "Menuiserie & Travaux en bois", designation: "Fabrication et pose de porte en bois", meter: "216*82", qte: 1, prix: null },
  { category: "Menuiserie & Travaux en bois", designation: "Fabrication et pose de porte en bois", meter: "217*90", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de porte en aluminium", meter: "198*80", qte: 1, prix: 30000 },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de porte en aluminium", meter: "197*80", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de porte en aluminium", meter: "210*81", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de porte en aluminium", meter: "200*97", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de porte en aluminium", meter: "192*70", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de porte en aluminium", meter: "200*71", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre vitrée", meter: "120*100", qte: 1, prix: 18000 },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre vitrée", meter: "110*100", qte: 1, prix: 18000 },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre vitrée", meter: "99*91", qte: 1, prix: 18000 },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre vitrée", meter: "95*90", qte: 1, prix: 18000 },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre vitrée", meter: "101*100", qte: 1, prix: 18000 },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre vitrée", meter: "119*120", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre vitrée", meter: "94*92", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre vitrée", meter: "104*90", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre vitrée", meter: "101*100", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre en aluminium", meter: "60*60", qte: 1, prix: 10000 },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre en aluminium", meter: "61*60", qte: 1, prix: 10000 },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre en aluminium", meter: "57*60", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre en aluminium", meter: "54*40", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de fenêtre en aluminium", meter: "59*60", qte: 1, prix: null },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de cloison vitrée", meter: "156*40", qte: 1, prix: 20000 },
  { category: "Aluminium & Vitrerie", designation: "Fabrication et pose de cloison vitrée", meter: "156*60", qte: 1, prix: 20000 },
  { category: "Métallerie & Ferronnerie", designation: "Fabrication et pose de garde-corps métallique pour escalier", meter: "7", qte: 1, prix: 155000 },
  { category: "Métallerie & Ferronnerie", designation: "Fabrication et pose de porte métallique extérieure", meter: "210*105", qte: 1, prix: 60000 },
  { category: "Métallerie & Ferronnerie", designation: "Fabrication et pose de porte métallique extérieure", meter: "205*110", qte: 1, prix: 60000 },
  { category: "Métallerie & Ferronnerie", designation: "Fabrication et pose de clôture métallique extérieure de sécurité", meter: "15", qte: 1, prix: 100000 }
];

function parseMeter(meter) {
  const cleaned = String(meter).replace(/\s*cm\s*/gi, "").trim();
  if (cleaned.includes("*")) {
    const [a, b] = cleaned.split("*").map((x) => Number(x.trim()));
    return { largeur: a || 0, longueur: b || 0, unite: "m" };
  }
  const n = Number(cleaned.replace(/[^\d.]/g, ""));
  return { largeur: n || 0, longueur: 1, unite: "m" };
}

function nextReference(existing, now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const datePart = `${y}${m}${d}`;
  const prefix = `${datePart}-`;
  let maxSeq = 0;
  for (const inv of existing) {
    const ref = String(inv.reference || "");
    if (!ref.startsWith(prefix)) continue;
    const n = Number(ref.slice(prefix.length).replace(/\D/g, "").slice(0, 6));
    if (Number.isFinite(n)) maxSeq = Math.max(maxSeq, n);
  }
  return `${datePart}-${String(maxSeq + 1).padStart(6, "0")}`;
}

function summarizeType(lines) {
  const cats = [...new Set(lines.map((l) => l.category).filter(Boolean))];
  if (cats.length === 0) return "Mixte";
  if (cats.length === 1) return cats[0];
  return "Mixte";
}

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/AL-HAKIMGROUP";
  await mongoose.connect(uri);

  const client =
    (await Client.findOne({ name: /mahdi/i })) ||
    (await Client.findOne({ contactName: /mahdi/i }));
  if (!client) {
    throw new Error("Client Mahdi isse introuvable");
  }

  const services = await Service.find({});
  const serviceByDesignation = new Map(
    services.map((s) => [String(s.designation || s.name).trim(), s])
  );

  let lastPrice = 0;
  const lines = [];
  for (const row of ROWS) {
    const prixUnitaire = row.prix ?? lastPrice;
    if (row.prix != null) lastPrice = row.prix;
    const dims = parseMeter(row.meter);
    const service = serviceByDesignation.get(row.designation);
    const montant = row.qte * prixUnitaire;
    lines.push({
      service: service?._id || null,
      designation: row.designation,
      category: row.category,
      description: "",
      quantite: row.qte,
      largeur: dims.largeur,
      longueur: dims.longueur,
      unite: dims.unite,
      prixUnitaire,
      montant
    });
  }

  const amount = lines.reduce((s, l) => s + l.montant, 0);
  const existing = await Proforma.find({}).select("reference").lean();
  const now = new Date();
  const proformaId = `PRO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${now.getTime()}`;

  const bank = await Bank.findOne({}).sort({ createdAt: 1 });

  const doc = await Proforma.create({
    proformaId,
    reference: nextReference(existing, now),
    invoiceType: summarizeType(lines),
    client: client._id,
    clientName: client.contactName || client.name,
    company: client.name,
    phone: client.phone || "77756638",
    domainName: "",
    expirationDate: null,
    bank: bank?._id || null,
    bankName: bank?.name || "BCIMR",
    bankAccountNumber: bank?.accountNumberOrWallet || "",
    bankAccountHolder: bank?.accountHolder || "AL-HAKIM GROUP",
    bankIban: bank?.iban || "",
    bankSwift: bank?.swift || "",
    amount,
    date: now,
    status: "Brouillon",
    lines
  });

  console.log(JSON.stringify({
    ok: true,
    proformaId: doc.proformaId,
    reference: doc.reference,
    client: doc.clientName,
    lines: lines.length,
    amount,
    openInApp: `sessionStorage.setItem('openProformaId','${doc.proformaId}'); location.reload();`
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
