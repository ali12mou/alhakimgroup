import bcrypt from "bcryptjs";
import { User } from "../models/User.js";

function notFound(res, entity) {
  return res.status(404).json({ message: `${entity} introuvable` });
}

export async function listUsers(req, res) {
  const items = await User.find({})
    .select("-passwordHash")
    .populate({ path: "role", populate: { path: "permissions" } })
    .sort({ createdAt: -1 });
  return res.json(items);
}

export async function createUser(req, res) {
  const { password, ...rest } = req.body;
  const payload = { ...rest };
  if (password && String(password).length > 0) {
    payload.passwordHash = await bcrypt.hash(String(password), 10);
  }
  const item = await User.create(payload);
  const populated = await User.findById(item._id).populate({
    path: "role",
    populate: { path: "permissions" }
  });
  return res.status(201).json(populated);
}

export async function updateUser(req, res) {
  const { password, ...rest } = req.body;
  const payload = { ...rest };
  if (password !== undefined) {
    if (String(password).length > 0) {
      payload.passwordHash = await bcrypt.hash(String(password), 10);
    }
  }
  const item = await User.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true
  })
    .select("-passwordHash")
    .populate({
      path: "role",
      populate: { path: "permissions" }
    });
  if (!item) return notFound(res, "Utilisateur");
  return res.json(item);
}

export async function deleteUser(req, res) {
  const item = await User.findByIdAndDelete(req.params.id);
  if (!item) return notFound(res, "Utilisateur");
  return res.status(204).send();
}
