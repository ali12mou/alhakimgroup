import { Router } from "express";
import { login, me } from "../controllers/authController.js";

const router = Router();

router.post("/login", login);
router.get("/me", me);

export default router;
