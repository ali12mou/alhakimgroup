import bcrypt from "bcryptjs";
import { Client } from "../models/Client.js";
import { FollowUp } from "../models/FollowUp.js";
import { Bank } from "../models/Bank.js";
import { Invoice } from "../models/Invoice.js";
import { InvoicePayment } from "../models/InvoicePayment.js";
import { Permission } from "../models/Permission.js";
import { Proforma } from "../models/Proforma.js";
import { Rapport } from "../models/Rapport.js";
import { Role } from "../models/Role.js";
import { Service } from "../models/Service.js";
import { Setting } from "../models/Setting.js";
import { User } from "../models/User.js";
import { ExpenseCategory } from "../models/ExpenseCategory.js";
import { Expense } from "../models/Expense.js";
import { ExpenseAllocation } from "../models/ExpenseAllocation.js";
import { OtherExpense } from "../models/OtherExpense.js";
import { flattenServiceCatalog } from "./serviceCatalog.js";

async function seedRBAC() {
  if ((await Permission.countDocuments()) === 0) {
    await Permission.insertMany([
      {
        key: "dashboard.read",
        label: "Voir le tableau de bord",
        category: "dashboard"
      },
      { key: "clients.read", label: "Voir les clients", category: "clients" },
      { key: "clients.write", label: "Gerer les clients", category: "clients" },
      { key: "followups.read", label: "Voir les suivis", category: "suivis" },
      { key: "followups.write", label: "Gerer les suivis", category: "suivis" },
      { key: "reports.read", label: "Voir les rapports", category: "rapports" },
      { key: "billing.read", label: "Voir facturation", category: "facturation" },
      { key: "billing.write", label: "Gerer facturation", category: "facturation" },
      {
        key: "settings.read",
        label: "Voir les parametres",
        category: "parametres"
      },
      {
        key: "settings.write",
        label: "Modifier les parametres",
        category: "parametres"
      },
      {
        key: "users.manage",
        label: "Gerer utilisateurs et roles",
        category: "administration"
      }
    ]);
  }

  if ((await Role.countDocuments()) === 0) {
    const allPerms = await Permission.find({}).select("_id");
    const allIds = allPerms.map((p) => p._id);
    const commercialKeys = [
      "dashboard.read",
      "clients.read",
      "clients.write",
      "followups.read",
      "followups.write",
      "reports.read",
      "billing.read"
    ];
    const commercialIds = await Permission.find({
      key: { $in: commercialKeys }
    }).select("_id");

    await Role.insertMany([
      {
        name: "Administrateur",
        description: "Acces complet au CRM",
        permissions: allIds
      },
      {
        name: "Commercial",
        description: "Clients, suivis et lecture facturation",
        permissions: commercialIds.map((p) => p._id)
      },
      {
        name: "Comptable",
        description: "Facturation et rapports",
        permissions: (
          await Permission.find({
            key: {
              $in: [
                "dashboard.read",
                "billing.read",
                "billing.write",
                "reports.read",
                "settings.read"
              ]
            }
          }).select("_id")
        ).map((p) => p._id)
      }
    ]);
  }

  if ((await User.countDocuments()) === 0) {
    const adminRole = await Role.findOne({ name: "Administrateur" });
    if (adminRole) {
      await User.create({
        fullName: "Administrateur AL-HAKIM GROUP",
        email: "admin@alhakimgroup.com",
        phone: "+253 77 70 34 36",
        role: adminRole._id,
        active: true,
        passwordHash: await bcrypt.hash("admin123", 10)
      });
    }
  }
}

async function syncSettingsWithBank() {
  const banks = await Bank.find({}).sort({ createdAt: 1 });
  if (banks.length === 0) return;

  let settings = await Setting.findOne({});
  if (!settings) {
    settings = await Setting.create({});
  }

  let changed = false;
  if (!settings.defaultBank) {
    settings.defaultBank = banks[0]._id;
    changed = true;
  }
  if (!settings.bankName) {
    settings.bankName = banks[0].name;
    settings.bankAccountHolder = banks[0].accountHolder;
    settings.bankIban = banks[0].iban || "";
    settings.bankSwift = banks[0].swift || "";
    changed = true;
  }
  if (changed) await settings.save();
}

async function seedServiceCatalog() {
  const catalog = flattenServiceCatalog();
  const existing = await Service.find({});
  const byDesignation = new Map(
    existing.map((s) => [(s.designation || s.name || "").trim(), s])
  );
  const usedCodes = new Set(existing.map((s) => s.code));

  if (existing.length === 0) {
    await Service.insertMany(catalog);
  } else {
    let nextNum = existing.reduce((max, s) => {
      const n = Number(String(s.code).replace(/\D/g, ""));
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);

    for (const row of catalog) {
      const found = byDesignation.get(row.designation);
      if (found) {
        let changed = false;
        if (found.designation !== row.designation) {
          found.designation = row.designation;
          changed = true;
        }
        if (found.name !== row.designation) {
          found.name = row.designation;
          changed = true;
        }
        if (found.category !== row.category) {
          found.category = row.category;
          changed = true;
        }
        if (changed) await found.save();
        continue;
      }
      let code = row.code;
      if (usedCodes.has(code)) {
        nextNum += 1;
        code = `SRV-${String(nextNum).padStart(3, "0")}`;
        while (usedCodes.has(code)) {
          nextNum += 1;
          code = `SRV-${String(nextNum).padStart(3, "0")}`;
        }
      }
      usedCodes.add(code);
      const created = await Service.create({ ...row, code });
      byDesignation.set(row.designation, created);
    }
  }

  const withoutDesignation = await Service.find({
    $or: [{ designation: { $exists: false } }, { designation: "" }, { designation: null }]
  });
  for (const service of withoutDesignation) {
    if (service.name) {
      service.designation = service.name;
      await service.save();
    }
  }

  return Service.find({}).sort({ code: 1 });
}

export async function seedInitialData() {
  // 1) Catalogue Service d'abord (pour pouvoir lier les clients via ObjectId)
  const services = await seedServiceCatalog();
  const firstService = services[0] || null;
  const secondService = services[1] || firstService;
  const thirdService = services[2] || firstService;

  let clients = await Client.find({});
  // Pas de clients de démonstration : le tableau Clients reste vide jusqu'à saisie réelle.
  if (clients.length > 0) {
    // Migration : lier les clients sans relation service
    const withoutService = await Client.find({
      $or: [{ service: null }, { service: { $exists: false } }]
    });
    for (const client of withoutService) {
      if (client.maintenance && thirdService) {
        client.service = thirdService._id;
      } else if (client.hosting && secondService) {
        client.service = secondService._id;
      } else if (firstService) {
        client.service = firstService._id;
      }
      if (client.service) await client.save();
    }
  }

  // Migration des clients existants vers la nouvelle structure.
  await Client.updateMany(
    { $or: [{ clientType: { $exists: false } }, { clientType: null }] },
    { $set: { clientType: "Entreprise" } }
  );
  await Client.updateMany(
    {
      clientType: "Entreprise",
      name: {
        $regex:
          "ministere|ministère|gouvernement|mairie|prefecture|préfecture|direction nationale",
        $options: "i"
      }
    },
    { $set: { clientType: "Gouvernemental" } }
  );
  const clientsWithoutContact = await Client.find({
    $or: [
      { contactName: { $exists: false } },
      { contactName: null },
      { contactName: "" }
    ]
  });
  for (const client of clientsWithoutContact) {
    client.contactName = client.name || "Non renseigne";
    await client.save();
  }

  if ((await FollowUp.countDocuments()) === 0 && clients.length > 0) {
    await FollowUp.insertMany([
      {
        title: "Relance facture annuelle",
        client: clients[0]._id,
        type: "Paiement",
        status: "Ouvert",
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
        note: "Contacter avant la date d'echeance."
      }
    ]);
  }

  if ((await Bank.countDocuments()) === 0) {
    await Bank.insertMany([
      {
        name: "BCIMR",
        accountNumberOrWallet: "DJ00 0000 0000 0000 0000",
        description: "Compte bancaire principal",
        accountHolder: "AL-HAKIM GROUP",
        iban: "DJ00 0000 0000 0000 0000",
        swift: "BCIMDJDJ"
      },
      {
        name: "Salaam Bank",
        accountNumberOrWallet: "DJ00 1111 1111 1111 1111",
        description: "Compte bancaire Salaam Bank",
        accountHolder: "AL-HAKIM GROUP",
        iban: "DJ00 1111 1111 1111 1111",
        swift: "SALADJDJ"
      }
    ]);
  }

  const bankDocuments = await Bank.find({});
  for (const bank of bankDocuments) {
    if (!bank.accountNumberOrWallet) {
      bank.accountNumberOrWallet = bank.iban || bank.swift || bank.name;
      if (!bank.description) bank.description = "Compte bancaire";
      await bank.save();
    }
  }

  if ((await Invoice.countDocuments()) === 0) {
    await Invoice.insertMany([
      {
        invoiceId: "FAC-001",
        reference: "REF-2026-001",
        clientName: "Mawada International",
        company: "Mawada International",
        bankName: "BCIMR",
        date: new Date("2026-04-16"),
        paymentStatus: "Paye",
        paymentMethod: "Virement bancaire"
      },
      {
        invoiceId: "FAC-002",
        reference: "REF-2026-002",
        clientName: "Djibouti Smile",
        company: "Djibouti Smile",
        bankName: "Salaam Bank",
        date: new Date("2026-04-18"),
        paymentStatus: "En attente",
        paymentMethod: "Mobile money"
      }
    ]);
  }

  // Migration : relier les anciennes factures aux clients et comptes bancaires.
  const invoicesToMigrate = await Invoice.find({});
  for (const invoice of invoicesToMigrate) {
    let changed = false;
    if (!invoice.client) {
      const client = clients.find(
        (item) =>
          item.name === invoice.company ||
          item.name === invoice.clientName ||
          item.contactName === invoice.clientName
      );
      if (client) {
        invoice.client = client._id;
        changed = true;
      }
    }
    if (!invoice.bank) {
      const bank = bankDocuments.find((item) => item.name === invoice.bankName);
      if (bank) {
        invoice.bank = bank._id;
        invoice.bankAccountNumber = bank.accountNumberOrWallet || "";
        invoice.bankAccountHolder = bank.accountHolder || "";
        invoice.bankIban = bank.iban || "";
        invoice.bankSwift = bank.swift || "";
        changed = true;
      }
    }
    if (changed) await invoice.save();
  }

  if ((await Proforma.countDocuments()) === 0) {
    const proformaClient = clients.find((item) => item.name === "Atypique") || clients[0];
    await Proforma.insertMany([
      {
        proformaId: "PRO-001",
        reference: "PRF-2026-001",
        client: proformaClient?._id || null,
        clientName: "Atypique",
        company: "Atypique",
        date: new Date("2026-04-12"),
        status: "Envoye",
        amount: 20000,
        lines: firstService
          ? [
              {
                service: firstService._id,
                designation: firstService.designation,
                description: firstService.category || "",
                quantite: 1,
                prixUnitaire: firstService.price || 0,
                montant: firstService.price || 0
              }
            ]
          : []
      }
    ]);
  }

  if ((await InvoicePayment.countDocuments()) === 0) {
    await InvoicePayment.insertMany([
      {
        paymentId: "PAY-001",
        invoiceRef: "REF-2026-001",
        clientName: "Mawada International",
        date: new Date("2026-04-17"),
        method: "Virement bancaire",
        amount: 89000,
        status: "Paye"
      }
    ]);
  }
  const legacyPayments = await InvoicePayment.find({});
  for (const payment of legacyPayments) {
    const invoice = invoicesToMigrate.find(
      (item) =>
        item.reference === payment.invoiceRef ||
        item.invoiceId === payment.invoiceRef
    );
    if (invoice) {
      payment.invoiceRef = invoice.invoiceId;
      if (!payment.invoice) payment.invoice = invoice._id;
      if (!payment.client && invoice.client) payment.client = invoice.client;
      if (!payment.bank && invoice.bank) {
        payment.bank = invoice.bank;
        payment.bankName = invoice.bankName || "";
        payment.bankAccountNumber = invoice.bankAccountNumber || "";
      }
      await payment.save();
    } else if (!payment.client) {
      const client = clients.find((item) => item.name === payment.clientName);
      if (client) {
        payment.client = client._id;
        await payment.save();
      }
    }
  }

  if ((await ExpenseCategory.countDocuments()) === 0) {
    await ExpenseCategory.insertMany([
      { name: "Fishing Fleet", description: "-" },
      { name: "Transportation", description: "-" }
    ]);
  }

  const expenseBank = bankDocuments[0] || (await Bank.findOne({}));
  if ((await Expense.countDocuments()) === 0 && expenseBank) {
    await Expense.insertMany([
      {
        reference: "EXP7722",
        bank: expenseBank._id,
        donor: "AL-HAKIM GROUP",
        responsible: "Administrateur",
        reason: "Depense initiale",
        total: 140,
        status: "Approuve",
        expenseDate: new Date("2026-03-02")
      }
    ]);
  }
  if (expenseBank) {
    await Expense.updateMany(
      { $or: [{ bank: null }, { bank: { $exists: false } }] },
      {
        $set: {
          bank: expenseBank._id,
          donor: "Non renseigne",
          responsible: "Non renseigne",
          reason: "Non renseignee"
        }
      }
    );
  }

  if ((await ExpenseAllocation.countDocuments()) === 0) {
    await ExpenseAllocation.insertMany([
      {
        name: "March_2026",
        dateLabel: "March_2026",
        amount: 500000,
        typeLabel: "Depenses recurrentes",
        locked: true
      }
    ]);
  }

  if ((await OtherExpense.countDocuments()) === 0) {
    await OtherExpense.insertMany([
      { expenseId: "EXP00001", date: new Date("2026-03-07"), amount: 300, status: "En attente" },
      { expenseId: "EXP00002", date: new Date("2026-03-06"), amount: 50000, status: "En attente" }
    ]);
  }

  await seedRBAC();
  await syncSettingsWithBank();

  if ((await Rapport.countDocuments()) === 0) {
    const admin = await User.findOne({}).select("_id");
    await Rapport.create({
      title: "Rapport initial AL-HAKIM GROUP",
      periodLabel: new Date().toLocaleDateString("fr-FR"),
      generatedBy: admin?._id || null,
      clientsCount: await Client.countDocuments(),
      servicesCount: await Service.countDocuments(),
      facturesCount: await Invoice.countDocuments(),
      paiementsCount: await InvoicePayment.countDocuments(),
      depensesCount: await Expense.countDocuments(),
      notes: "Snapshot initial du CRM."
    });
  }
}

