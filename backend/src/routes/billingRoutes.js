import { Router } from "express";
import {
  createBank,
  createInvoice,
  createInvoicePayment,
  createProforma,
  createService,
  deleteBank,
  deleteInvoice,
  deleteInvoicePayment,
  deleteProforma,
  deleteService,
  getBanks,
  getInvoices,
  getInvoicePayments,
  getProformas,
  getServices,
  updateBank,
  updateInvoice,
  updateProforma,
  updateService
} from "../controllers/billingController.js";

const router = Router();

router.get("/services", getServices);
router.post("/services", createService);
router.put("/services/:id", updateService);
router.delete("/services/:id", deleteService);

router.get("/banks", getBanks);
router.post("/banks", createBank);
router.put("/banks/:id", updateBank);
router.delete("/banks/:id", deleteBank);

router.get("/invoices", getInvoices);
router.post("/invoices", createInvoice);
router.put("/invoices/:id", updateInvoice);
router.delete("/invoices/:id", deleteInvoice);

router.get("/proformas", getProformas);
router.post("/proformas", createProforma);
router.put("/proformas/:id", updateProforma);
router.delete("/proformas/:id", deleteProforma);

router.get("/invoice-payments", getInvoicePayments);
router.post("/invoice-payments", createInvoicePayment);
router.delete("/invoice-payments/:id", deleteInvoicePayment);

export default router;

