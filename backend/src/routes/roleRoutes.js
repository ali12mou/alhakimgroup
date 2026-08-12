import { Router } from "express";
import {
  createRole,
  deleteRole,
  listRoles,
  updateRole
} from "../controllers/roleController.js";

const router = Router();

router.get("/", listRoles);
router.post("/", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;
