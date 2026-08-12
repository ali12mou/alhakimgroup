import { Router } from "express";
import { createPermission, listPermissions } from "../controllers/permissionController.js";

const router = Router();

router.get("/", listPermissions);
router.post("/", createPermission);

export default router;
