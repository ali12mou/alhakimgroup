import { Role } from "../models/Role.js";
import { User } from "../models/User.js";

function notFound(res, entity) {
  return res.status(404).json({ message: `${entity} introuvable` });
}

export async function listRoles(req, res) {
  const items = await Role.find({}).populate("permissions").sort({ name: 1 });
  return res.json(items);
}

export async function createRole(req, res) {
  const item = await Role.create(req.body);
  const populated = await Role.findById(item._id).populate("permissions");
  return res.status(201).json(populated);
}

export async function updateRole(req, res) {
  const item = await Role.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate("permissions");
  if (!item) return notFound(res, "Role");
  return res.json(item);
}

export async function deleteRole(req, res) {
  const usersCount = await User.countDocuments({ role: req.params.id });
  if (usersCount > 0) {
    return res.status(400).json({
      message: "Impossible de supprimer ce role : des utilisateurs y sont rattaches."
    });
  }
  const item = await Role.findByIdAndDelete(req.params.id);
  if (!item) return notFound(res, "Role");
  return res.status(204).send();
}
