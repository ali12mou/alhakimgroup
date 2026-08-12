import { Permission } from "../models/Permission.js";

export async function listPermissions(req, res) {
  const items = await Permission.find({}).sort({ category: 1, label: 1 });
  return res.json(items);
}

export async function createPermission(req, res) {
  const item = await Permission.create(req.body);
  return res.status(201).json(item);
}
