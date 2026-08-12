import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const settingSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: "AL-HAKIM GROUP" },
    companyEmail: { type: String, default: "contact@geosomtech.com" },
    companyPhone: { type: String, default: "+253 XX XX XX XX" },
    companyContactName: { type: String, trim: true, default: "" },
    website: { type: String, default: "https://geosomtech.com" },
    address: { type: String, default: "Djibouti" },
    currency: { type: String, default: "FDJ" },
    expirationAlertEnabled: { type: Boolean, default: true },
    expirationAlertDays: { type: Number, default: 60 },
    defaultBank: { type: mongoose.Schema.Types.ObjectId, ref: "Bank", default: null },
    bankName: { type: String, trim: true, default: "" },
    bankAccountHolder: { type: String, trim: true, default: "" },
    bankIban: { type: String, trim: true, default: "" },
    bankSwift: { type: String, trim: true, default: "" },
    documentHeader: { type: String, trim: true, default: "" },
    documentFooter: { type: String, trim: true, default: "" },
    logoDataUrl: { type: String, default: "" }
  },
  { timestamps: true, collection: COLLECTIONS.parametres }
);

export const Setting = mongoose.model("Setting", settingSchema);
