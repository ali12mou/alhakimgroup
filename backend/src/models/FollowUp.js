import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const followUpSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "Suivi client" },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true
    },
    type: {
      type: String,
      enum: ["Appel", "Email", "Reunion", "Paiement", "Maintenance", "Autre"],
      default: "Autre"
    },
    status: {
      type: String,
      enum: ["Ouvert", "En cours", "Termine"],
      default: "Ouvert"
    },
    note: { type: String, trim: true, default: "" },
    dueDate: { type: Date, default: () => new Date() },
    description: { type: String, trim: true, default: "" },
    raisonParle: { type: String, trim: true, default: "" },
    suivi: { type: String, trim: true, default: "" },
    reponse: { type: String, trim: true, default: "" },
    clientPhone: { type: String, trim: true, default: "" }
  },
  { timestamps: true, collection: COLLECTIONS.suivis }
);

export const FollowUp = mongoose.model("FollowUp", followUpSchema);
