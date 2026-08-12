import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const otherExpenseSchema = new mongoose.Schema(
  {
    expenseId: { type: String, required: true, trim: true, unique: true },
    date: { type: Date, required: true, default: () => new Date() },
    amount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["En attente", "Approuve"],
      default: "En attente"
    }
  },
  { timestamps: true, collection: COLLECTIONS.autresDepenses }
);

export const OtherExpense = mongoose.model("OtherExpense", otherExpenseSchema);
