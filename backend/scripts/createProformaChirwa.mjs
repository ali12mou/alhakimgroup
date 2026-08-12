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

/** @type {Array<{ category: string; designation: string; meter: string; qte: number; prix: number }>} */
const ROWS = [
  {
    category: "Menuiserie & Travaux en bois",
    designation: "Fabrication et pose de porte en bois",
    meter: "120*210",
    qte: 3,
    prix: 125000
  },
  {
    category: "Aluminium & Vitrerie",
    designation: "Fabrication et pose de porte en aluminium",
    meter: "120*210",
    qte: 1,
    prix: 50000
  },
  {
    category: "Métallerie & Ferronnerie",
    designation: "Fabrication et pose de garde-corps métallique pour escalier",
    meter: "14",
    qte: 1,
    prix: 25000
  },
  {
    category: "Métallerie & Ferronnerie",
    designation: "Fabrication et pose de porte métallique extérieure",
    meter: "400*270",
    qte: 1,
    prix: 450000
  }
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
    (await Client.findOne({ name: /^chirwa$/i })) ||
    (await Client.findOne({ contactName: /chirwa/i })) ||
    (await Client.findOne({ name: /chirwa/i }));
  if (!client) {
    throw new Error("Client chirwa introuvable");
  }

  const services = await Service.find({});
  const serviceByDesignation = new Map(
    services.map((s) => [String(s.designation || s.name).trim(), s])
  );

  const lines = [];
  for (const row of ROWS) {
    const dims = parseMeter(row.meter);
    const service = serviceByDesignation.get(row.designation);
    const montant = row.qte * row.prix;
    lines.push({
      service: service?._id || null,
      designation: row.designation,
      category: row.category,
      description: "",
      quantite: row.qte,
      largeur: dims.largeur,
      longueur: dims.longueur,
      unite: dims.unite,
      prixUnitaire: row.prix,
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
    phone: client.phone || "",
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        proformaId: doc.proformaId,
        reference: doc.reference,
        client: doc.clientName,
        lines: lines.length,
        amount
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
