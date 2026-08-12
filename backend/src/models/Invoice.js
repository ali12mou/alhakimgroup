import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const invoiceSchema = new mongoose.Schema(
  {
    invoiceId: { type: String, required: true, unique: true, trim: true },
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
    bankName: { type: String, required: true, trim: true },
    bankAccountNumber: { type: String, default: "", trim: true },
    bankAccountHolder: { type: String, default: "", trim: true },
    bankIban: { type: String, default: "", trim: true },
    bankSwift: { type: String, default: "", trim: true },
    amount: { type: Number, default: 0 },
    isValidated: { type: Boolean, default: false },
    date: { type: Date, required: true },
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
    ],
    paymentStatus: {
      type: String,
      enum: ["Paye", "Non paye", "En attente", "Partiel", "Annule"],
      default: "En attente"
    },
    paymentMethod: {
      type: String,
      enum: ["Virement bancaire", "Mobile money", "Especes", "Cheque", "Autre"],
      default: "Virement bancaire"
    }
  },
  { timestamps: true, collection: COLLECTIONS.factures }
);

export const Invoice = mongoose.model("Invoice", invoiceSchema);

