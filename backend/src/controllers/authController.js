import bcrypt from "bcryptjs";
import { User } from "../models/User.js";

export async function login(req, res) {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "Email et mot de passe requis." });
  }

  const user = await User.findOne({ email }).populate({
    path: "role",
    populate: { path: "permissions" }
  });

  if (!user || !user.active) {
    return res.status(401).json({ message: "Identifiants invalides." });
  }

  if (!user.passwordHash) {
    if (password !== "admin123") {
      return res.status(401).json({
        message: "Identifiants invalides. Mot de passe initial : admin123"
      });
    }
    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();
  } else {
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Identifiants invalides." });
    }
  }

  return res.json({
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || "",
      role: user.role
        ? {
            _id: user.role._id,
            name: user.role.name
          }
        : null,
      active: user.active
    }
  });
}

export async function me(req, res) {
  const userId = String(req.query.id || req.headers["x-user-id"] || "").trim();
  if (!userId) {
    return res.status(401).json({ message: "Non authentifie." });
  }
  const user = await User.findById(userId)
    .select("-passwordHash")
    .populate({ path: "role", populate: { path: "permissions" } });
  if (!user || !user.active) {
    return res.status(401).json({ message: "Session invalide." });
  }
  return res.json({
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || "",
      role: user.role
        ? {
            _id: user.role._id,
            name: user.role.name
          }
        : null,
      active: user.active
    }
  });
}
