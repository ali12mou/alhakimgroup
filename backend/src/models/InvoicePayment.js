import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const invoicePaymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true, unique: true, trim: true },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
      index: true
    },
    invoiceRef: { type: String, required: true, trim: true },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
      index: true
    },
    clientName: { type: String, required: true, trim: true },
    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      default: null,
      index: true
    },
    bankName: { type: String, default: "", trim: true },
    bankAccountNumber: { type: String, default: "", trim: true },
    date: { type: Date, required: true },
    method: {
      type: String,
      enum: ["Virement bancaire", "Mobile money", "Especes", "Cheque", "Autre"],
      default: "Virement bancaire"
    },
    amount: { type: Number, required: true, min: 0, default: 0 },
    proofImageDataUrl: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Paye", "Non paye", "Partiel", "En attente"],
      default: "En attente"
    }
  },
  { timestamps: true, collection: COLLECTIONS.paiements }
);

export const InvoicePayment = mongoose.model("InvoicePayment", invoicePaymentSchema);

