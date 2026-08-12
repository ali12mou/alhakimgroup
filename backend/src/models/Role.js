import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: "" },
    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }]
  },
  { timestamps: true, collection: COLLECTIONS.roles }
);

export const Role = mongoose.model("Role", roleSchema);
