import { Router } from "express";
import {
  createClient,
  deleteClient,
  getClients,
  updateClient
} from "../controllers/clientController.js";

const router = Router();

router.get("/", getClients);
router.post("/", createClient);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);

export default router;
