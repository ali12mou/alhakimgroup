import { Client } from "../models/Client.js";
import { FollowUp } from "../models/FollowUp.js";
import { Expense } from "../models/Expense.js";
import { OtherExpense } from "../models/OtherExpense.js";
import { Invoice } from "../models/Invoice.js";
import { InvoicePayment } from "../models/InvoicePayment.js";
import { Proforma } from "../models/Proforma.js";
import { Service } from "../models/Service.js";
import { User } from "../models/User.js";
import { ConnectionLog } from "../models/ConnectionLog.js";

export async function getDashboard(req, res) {
  const [
    clients,
    followUps,
    expenses,
    otherExpenses,
    invoiceCount,
    proformaCount,
    paymentCount,
    serviceCount,
    userCount,
    recentConnections
  ] = await Promise.all([
    Client.find({}),
    FollowUp.find({}),
    Expense.find({}).populate("category", "name").sort({ expenseDate: -1 }),
    OtherExpense.find({}),
    Invoice.countDocuments(),
    Proforma.countDocuments(),
    InvoicePayment.countDocuments(),
    Service.countDocuments(),
    User.countDocuments(),
    ConnectionLog.find({}).sort({ connectedAt: -1 }).limit(8).lean()
  ]);

  const totals = clients.reduce(
    (acc, c) => {
      acc.dev += c.priceDev;
      acc.annual += c.priceAnnual;
      if (c.hosting) acc.hosting += 1;
      if (c.status === "Actif") acc.actifs += 1;
      if (c.status === "Prospect") acc.prospects += 1;
      if (c.status === "Inactif") acc.inactifs += 1;
      return acc;
    },
    {
      dev: 0,
      annual: 0,
      hosting: 0,
      actifs: 0,
      prospects: 0,
      inactifs: 0
    }
  );

  const expenseAgg = expenses.reduce(
    (acc, e) => {
      const amount = Number(e.total) || 0;
      acc.totalAmount += amount;
      acc.count += 1;
      if (e.status === "Approuve") {
        acc.approved += 1;
        acc.approvedAmount += amount;
      } else if (e.status === "En attente") {
        acc.pending += 1;
        acc.pendingAmount += amount;
      } else if (e.status === "Rejete") {
        acc.rejected += 1;
      }
      return acc;
    },
    {
      totalAmount: 0,
      count: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      approvedAmount: 0,
      pendingAmount: 0
    }
  );

  const otherExpenseAmount = otherExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const topClients = [...clients]
    .sort((a, b) => b.priceDev - a.priceDev)
    .slice(0, 5)
    .map((c) => ({
      id: c._id,
      name: c.name,
      dev: c.priceDev,
      annual: c.priceAnnual
    }));

  const recentExpenses = expenses.slice(0, 5).map((e) => ({
    id: e._id,
    reference: e.reference,
    reason: e.reason,
    total: e.total,
    status: e.status,
    expenseDate: e.expenseDate,
    categoryName: e.category?.name || "—"
  }));

  return res.json({
    totalClients: clients.length,
    caDevelopment: totals.dev,
    caAnnual: totals.annual,
    hostingCount: totals.hosting,
    totalFollowUps: followUps.length,
    statusStats: {
      actifs: totals.actifs,
      prospects: totals.prospects,
      inactifs: totals.inactifs
    },
    servicesStats: {
      hosting: totals.hosting,
      domain: clients.length,
      maintenance: clients.filter((c) => c.maintenance).length
    },
    averageRevenuePerClient: clients.length
      ? Math.round(totals.annual / clients.length)
      : 0,
    topClients,
    expenseStats: {
      totalAmount: expenseAgg.totalAmount,
      count: expenseAgg.count,
      approved: expenseAgg.approved,
      pending: expenseAgg.pending,
      rejected: expenseAgg.rejected,
      approvedAmount: expenseAgg.approvedAmount,
      pendingAmount: expenseAgg.pendingAmount,
      otherAmount: otherExpenseAmount,
      otherCount: otherExpenses.length
    },
    recentExpenses,
    moduleCounts: {
      clients: clients.length,
      suivis: followUps.length,
      factures: invoiceCount,
      proformas: proformaCount,
      paiements: paymentCount,
      services: serviceCount,
      depenses: expenseAgg.count,
      utilisateurs: userCount
    },
    recentConnections: recentConnections.map((c) => ({
      id: c._id,
      fullName: c.fullName,
      email: c.email,
      roleName: c.roleName,
      connectedAt: c.connectedAt
    }))
  });
}

export async function recordConnection(req, res) {
  const fullName = String(req.body?.fullName || "Administrateur").trim() || "Administrateur";
  const email = String(req.body?.email || "").trim();
  const roleName = String(req.body?.roleName || "Administrateur").trim() || "Administrateur";
  const source = String(req.body?.source || "app").trim() || "app";

  const item = await ConnectionLog.create({ fullName, email, roleName, source });
  return res.status(201).json({
    id: item._id,
    fullName: item.fullName,
    email: item.email,
    roleName: item.roleName,
    connectedAt: item.connectedAt
  });
}

