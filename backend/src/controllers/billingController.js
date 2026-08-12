import { Bank } from "../models/Bank.js";
import { Invoice } from "../models/Invoice.js";
import { InvoicePayment } from "../models/InvoicePayment.js";
import { Proforma } from "../models/Proforma.js";
import { Service } from "../models/Service.js";
import { Expense } from "../models/Expense.js";

function notFound(res, entity) {
  return res.status(404).json({ message: `${entity} introuvable` });
}

function normalizeServiceBody(body) {
  const data = { ...body };
  if (data.price === "" || data.price === null || data.price === undefined) {
    data.price = 0;
  }
  if (data.description === undefined || data.description === null) {
    data.description = "";
  }
  const designation = String(data.designation || data.name || "").trim();
  if (designation) {
    data.designation = designation;
    data.name = designation;
  }
  if (data.category === undefined || data.category === null) {
    data.category = "";
  }
  return data;
}

export async function getServices(req, res) {
  const items = await Service.find({}).sort({ category: 1, designation: 1, code: 1 });
  return res.json(items);
}
export async function createService(req, res) {
  const item = await Service.create(normalizeServiceBody(req.body));
  return res.status(201).json(item);
}
export async function updateService(req, res) {
  const item = await Service.findByIdAndUpdate(req.params.id, normalizeServiceBody(req.body), {
    new: true,
    runValidators: true
  });
  if (!item) return notFound(res, "Service");
  return res.json(item);
}
export async function deleteService(req, res) {
  const item = await Service.findByIdAndDelete(req.params.id);
  if (!item) return notFound(res, "Service");
  return res.status(204).send();
}

export async function getBanks(req, res) {
  const items = await Bank.find({}).sort({ createdAt: -1 });
  return res.json(items);
}
export async function createBank(req, res) {
  const item = await Bank.create(req.body);
  return res.status(201).json(item);
}
export async function updateBank(req, res) {
  const item = await Bank.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!item) return notFound(res, "Banque");
  return res.json(item);
}
export async function deleteBank(req, res) {
  if (await Expense.exists({ bank: req.params.id })) {
    return res.status(409).json({
      message: "Cette banque est utilisee par une depense et ne peut pas etre supprimee"
    });
  }
  const item = await Bank.findByIdAndDelete(req.params.id);
  if (!item) return notFound(res, "Banque");
  return res.status(204).send();
}

export async function getInvoices(req, res) {
  const items = await Invoice.find({})
    .populate("client", "name contactName")
    .populate("lines.service", "code designation name category price")
    .sort({ createdAt: -1 });
  return res.json(items);
}
export async function createInvoice(req, res) {
  const item = await Invoice.create(req.body);
  return res.status(201).json(item);
}
export async function updateInvoice(req, res) {
  const item = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!item) return notFound(res, "Facture");
  return res.json(item);
}
export async function deleteInvoice(req, res) {
  const item = await Invoice.findByIdAndDelete(req.params.id);
  if (!item) return notFound(res, "Facture");
  return res.status(204).send();
}

export async function getProformas(req, res) {
  const items = await Proforma.find({})
    .populate("client", "name contactName")
    .populate("lines.service", "code designation name category price")
    .sort({ createdAt: -1 });
  return res.json(items);
}
export async function createProforma(req, res) {
  const item = await Proforma.create(req.body);
  return res.status(201).json(item);
}
export async function updateProforma(req, res) {
  const item = await Proforma.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!item) return notFound(res, "Proforma");
  return res.json(item);
}
export async function deleteProforma(req, res) {
  const item = await Proforma.findByIdAndDelete(req.params.id);
  if (!item) return notFound(res, "Proforma");
  return res.status(204).send();
}

export async function getInvoicePayments(req, res) {
  const items = await InvoicePayment.find({})
    .populate("invoice", "invoiceId reference")
    .populate("client", "name contactName")
    .sort({ createdAt: -1 });
  return res.json(items);
}
export async function createInvoicePayment(req, res) {
  const item = await InvoicePayment.create(req.body);
  return res.status(201).json(item);
}
export async function deleteInvoicePayment(req, res) {
  const item = await InvoicePayment.findByIdAndDelete(req.params.id);
  if (!item) return notFound(res, "Paiement facture");
  return res.status(204).send();
}

