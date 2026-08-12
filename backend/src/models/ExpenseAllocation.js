import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const expenseAllocationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dateLabel: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
    typeLabel: { type: String, required: true, trim: true, default: "Depenses recurrentes" },
    locked: { type: Boolean, default: false }
  },
  { timestamps: true, collection: COLLECTIONS.allocationsDepenses }
);

export const ExpenseAllocation = mongoose.model("ExpenseAllocation", expenseAllocationSchema);
