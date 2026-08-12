import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const expenseSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, trim: true, unique: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      default: null
    },
    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      required: true,
      index: true
    },
    donor: { type: String, required: true, trim: true },
    responsible: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    total: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["Approuve", "En attente", "Rejete"],
      default: "En attente"
    },
    expenseDate: { type: Date, required: true, default: () => new Date() }
  },
  { timestamps: true, collection: COLLECTIONS.depenses }
);

export const Expense = mongoose.model("Expense", expenseSchema);

