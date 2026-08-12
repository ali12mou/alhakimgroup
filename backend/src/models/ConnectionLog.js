import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const connectionLogSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: "" },
    roleName: { type: String, trim: true, default: "Utilisateur" },
    source: { type: String, trim: true, default: "app" }
  },
  {
    timestamps: { createdAt: "connectedAt", updatedAt: false },
    collection: COLLECTIONS.tableauDeBord
  }
);

connectionLogSchema.index({ connectedAt: -1 });

export const ConnectionLog = mongoose.model("ConnectionLog", connectionLogSchema);
