import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const expenseCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true, default: "-" }
  },
  { timestamps: true, collection: COLLECTIONS.categoriesDepenses }
);

export const ExpenseCategory = mongoose.model("ExpenseCategory", expenseCategorySchema);
