import { Router } from "express";
import {
  createFollowUp,
  deleteFollowUp,
  getFollowUps,
  updateFollowUp
} from "../controllers/followUpController.js";

const router = Router();

router.get("/", getFollowUps);
router.post("/", createFollowUp);
router.put("/:id", updateFollowUp);
router.delete("/:id", deleteFollowUp);

export default router;
