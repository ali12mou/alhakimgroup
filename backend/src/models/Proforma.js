import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const proformaSchema = new mongoose.Schema(
  {
    proformaId: { type: String, required: true, unique: true, trim: true },
    reference: { type: String, required: true, trim: true },
    invoiceType: {
      type: String,
      enum: [
        "Service",
        "Domaine",
        "Mixte",
        "Décoration intérieure & extérieure",
        "Aluminium & Vitrerie",
        "Menuiserie & Travaux en bois",
        "Métallerie & Ferronnerie"
      ],
      default: "Mixte",
      required: true
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
      index: true
    },
    clientName: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    domainName: { type: String, default: "", trim: true },
    expirationDate: { type: Date, default: null },
    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      default: null,
      index: true
    },
    bankName: { type: String, default: "", trim: true },
    bankAccountNumber: { type: String, default: "", trim: true },
    bankAccountHolder: { type: String, default: "", trim: true },
    bankIban: { type: String, default: "", trim: true },
    bankSwift: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Brouillon", "Envoye", "Accepte", "Converti"],
      default: "Brouillon"
    },
    lines: [
      {
        service: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Service",
          default: null,
          index: true
        },
        designation: { type: String, trim: true, default: "" },
        category: {
          type: String,
          enum: [
            "Décoration intérieure & extérieure",
            "Aluminium & Vitrerie",
            "Menuiserie & Travaux en bois",
            "Métallerie & Ferronnerie",
            ""
          ],
          default: "",
          trim: true
        },
        description: { type: String, trim: true, default: "" },
        quantite: { type: Number, default: 1 },
        largeur: { type: Number, default: 0 },
        longueur: { type: Number, default: 0 },
        unite: {
          type: String,
          enum: ["U", "m", "m²"],
          default: "U",
          trim: true
        },
        prixUnitaire: { type: Number, default: 0 },
        montant: { type: Number, default: 0 }
      }
    ]
  },
  { timestamps: true, collection: COLLECTIONS.proformas }
);

export const Proforma = mongoose.model("Proforma", proformaSchema);
