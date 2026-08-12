import { Expense } from "../models/Expense.js";
import { ExpenseAllocation } from "../models/ExpenseAllocation.js";
import { ExpenseCategory } from "../models/ExpenseCategory.js";
import { OtherExpense } from "../models/OtherExpense.js";
import { Bank } from "../models/Bank.js";

function notFound(res, entity) {
  return res.status(404).json({ message: `${entity} introuvable` });
}

function textSearchFilter(search, fields) {
  const value = String(search || "").trim();
  if (!value) return {};
  return {
    $or: fields.map((field) => ({ [field]: { $regex: value, $options: "i" } }))
  };
}

export async function getExpenseCategories(req, res) {
  const query = textSearchFilter(req.query.search, ["name", "description"]);
  const items = await ExpenseCategory.find(query).sort({ createdAt: -1 });
  return res.json(items);
}

export async function createExpenseCategory(req, res) {
  const item = await ExpenseCategory.create(req.body);
  return res.status(201).json(item);
}

export async function updateExpenseCategory(req, res) {
  const item = await ExpenseCategory.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!item) return notFound(res, "Categorie de depense");
  return res.json(item);
}

export async function deleteExpenseCategory(req, res) {
  const item = await ExpenseCategory.findByIdAndDelete(req.params.id);
  if (!item) return notFound(res, "Categorie de depense");
  return res.status(204).send();
}

export async function getExpenses(req, res) {
  const searchValue = String(req.query.search || "").trim();
  const query = searchValue
    ? {
        $or: [
          { reference: { $regex: searchValue, $options: "i" } },
          { status: { $regex: searchValue, $options: "i" } },
          { donor: { $regex: searchValue, $options: "i" } },
          { responsible: { $regex: searchValue, $options: "i" } },
          { reason: { $regex: searchValue, $options: "i" } }
        ]
      }
    : {};
  const items = await Expense.find(query)
    .populate("category")
    .populate("bank", "name accountNumberOrWallet description")
    .sort({ createdAt: -1 });
  return res.json(items);
}

function buildExpenseReference(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `REF/${yyyy}-${mm}-${dd}/${hh}/${min}`;
}

async function nextUniqueExpenseReference() {
  const now = new Date();
  let reference = buildExpenseReference(now);
  if (!(await Expense.exists({ reference }))) return reference;
  const sec = String(now.getSeconds()).padStart(2, "0");
  reference = `${buildExpenseReference(now)}/${sec}`;
  if (!(await Expense.exists({ reference }))) return reference;
  return `${buildExpenseReference(now)}/${sec}-${Date.now().toString().slice(-3)}`;
}

export async function createExpense(req, res) {
  const payload = { ...req.body };
  // Toujours generer : REF/date/heure/minute
  payload.reference = await nextUniqueExpenseReference();
  if (!payload.bank || !(await Bank.exists({ _id: payload.bank }))) {
    return res.status(400).json({ message: "Veuillez selectionner une banque valide" });
  }
  const item = await Expense.create(payload);
  await item.populate("category");
  const populated = await item.populate("bank", "name accountNumberOrWallet description");
  return res.status(201).json(populated);
}

export async function updateExpense(req, res) {
  if (req.body.bank && !(await Bank.exists({ _id: req.body.bank }))) {
    return res.status(400).json({ message: "Banque introuvable" });
  }
  const item = await Expense.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  })
    .populate("category")
    .populate("bank", "name accountNumberOrWallet description");
  if (!item) return notFound(res, "Depense");
  return res.json(item);
}

export async function deleteExpense(req, res) {
  const item = await Expense.findByIdAndDelete(req.params.id);
  if (!item) return notFound(res, "Depense");
  return res.status(204).send();
}

export async function getExpenseAllocations(req, res) {
  const query = textSearchFilter(req.query.search, ["name", "dateLabel", "typeLabel"]);
  const items = await ExpenseAllocation.find(query).sort({ createdAt: -1 });
  return res.json(items);
}

export async function createExpenseAllocation(req, res) {
  const item = await ExpenseAllocation.create(req.body);
  return res.status(201).json(item);
}

export async function updateExpenseAllocation(req, res) {
  const item = await ExpenseAllocation.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!item) return notFound(res, "Allocation de depense");
  return res.json(item);
}

export async function deleteExpenseAllocation(req, res) {
  const item = await ExpenseAllocation.findByIdAndDelete(req.params.id);
  if (!item) return notFound(res, "Allocation de depense");
  return res.status(204).send();
}

export async function getOtherExpenses(req, res) {
  const query = textSearchFilter(req.query.search, ["expenseId", "status"]);
  const items = await OtherExpense.find(query).sort({ createdAt: -1 });
  return res.json(items);
}

export async function createOtherExpense(req, res) {
  const payload = { ...req.body };
  if (!payload.expenseId) {
    payload.expenseId = `EXP${Date.now().toString().slice(-6)}`;
  }
  const item = await OtherExpense.create(payload);
  return res.status(201).json(item);
}

export async function updateOtherExpense(req, res) {
  const item = await OtherExpense.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!item) return notFound(res, "Autre depense");
  return res.json(item);
}

export async function approveOtherExpense(req, res) {
  const item = await OtherExpense.findByIdAndUpdate(
    req.params.id,
    { status: "Approuve" },
    { new: true, runValidators: true }
  );
  if (!item) return notFound(res, "Autre depense");
  return res.json(item);
}

export async function deleteOtherExpense(req, res) {
  const item = await OtherExpense.findByIdAndDelete(req.params.id);
  if (!item) return notFound(res, "Autre depense");
  return res.status(204).send();
}

