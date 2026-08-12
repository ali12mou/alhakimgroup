import { Router } from "express";
import { getDashboard, recordConnection } from "../controllers/dashboardController.js";

const router = Router();
router.get("/", getDashboard);
router.post("/connect", recordConnection);

export default router;

