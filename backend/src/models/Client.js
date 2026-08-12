import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const ACTIVITY_CATEGORIES = [
  "Décoration intérieure & extérieure",
  "Aluminium & Vitrerie",
  "Menuiserie & Travaux en bois",
  "Métallerie & Ferronnerie"
];

const clientSchema = new mongoose.Schema(
  {
    clientType: {
      type: String,
      enum: ["Organisation", "Gouvernemental", "Entreprise", "Particulier"],
      default: "Entreprise",
      required: true
    },
    name: { type: String, required: true, trim: true },
    contactName: {
      type: String,
      required: true,
      trim: true,
      default: "Non renseigne"
    },
    domain: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "Djibouti" },
    priceDev: { type: Number, min: 0, default: 0 },
    priceAnnual: { type: Number, min: 0, default: 0 },
    hosting: { type: Boolean, default: false },
    maintenance: { type: Boolean, default: false },
    activityCategories: {
      type: [
        {
          type: String,
          enum: ACTIVITY_CATEGORIES,
          trim: true
        }
      ],
      default: []
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ["Actif", "Prospect", "Inactif"],
      default: "Actif"
    }
  },
  { timestamps: true, collection: COLLECTIONS.clients }
);

export const Client = mongoose.model("Client", clientSchema);
