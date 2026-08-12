import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: "" },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    active: { type: Boolean, default: true },
    passwordHash: { type: String, default: "" }
  },
  { timestamps: true, collection: COLLECTIONS.utilisateurs }
);

export const User = mongoose.model("User", userSchema);
