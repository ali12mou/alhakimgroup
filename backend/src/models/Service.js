import mongoose from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const serviceSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    designation: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "", index: true },
    description: { type: String, trim: true, default: "" },
    price: { type: Number, min: 0, default: 0 }
  },
  {
    timestamps: true,
    collection: COLLECTIONS.services,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

serviceSchema.pre("validate", function syncDesignation() {
  const designation = (this.designation || this.name || "").trim();
  if (designation) {
    this.designation = designation;
    this.name = designation;
  }
});

serviceSchema.virtual("clients", {
  ref: "Client",
  localField: "_id",
  foreignField: "service"
});

export const Service = mongoose.model("Service", serviceSchema);
