import { Router } from "express";
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser
} from "../controllers/userController.js";

const router = Router();

router.get("/", listUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
