import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const bankSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    accountNumberOrWallet: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    accountHolder: { type: String, trim: true, default: "" },
    iban: { type: String, trim: true, default: "" },
    swift: { type: String, trim: true, default: "" }
  },
  { timestamps: true, collection: COLLECTIONS.banques }
);

export const Bank = mongoose.model("Bank", bankSchema);

