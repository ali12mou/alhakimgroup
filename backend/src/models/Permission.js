import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const permissionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "general" }
  },
  { timestamps: true, collection: COLLECTIONS.permissions }
);

export const Permission = mongoose.model("Permission", permissionSchema);
