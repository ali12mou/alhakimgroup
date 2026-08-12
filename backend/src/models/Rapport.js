import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const rapportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, default: "Rapport CRM" },
    periodLabel: { type: String, trim: true, default: "" },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    clientsCount: { type: Number, default: 0 },
    servicesCount: { type: Number, default: 0 },
    facturesCount: { type: Number, default: 0 },
    paiementsCount: { type: Number, default: 0 },
    depensesCount: { type: Number, default: 0 },
    notes: { type: String, trim: true, default: "" }
  },
  { timestamps: true, collection: COLLECTIONS.rapports }
);

export const Rapport = mongoose.model("Rapport", rapportSchema);
