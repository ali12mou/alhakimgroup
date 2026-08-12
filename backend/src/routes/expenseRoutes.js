import { Router } from "express";
import {
  approveOtherExpense,
  createExpense,
  createExpenseAllocation,
  createExpenseCategory,
  createOtherExpense,
  deleteExpense,
  deleteExpenseAllocation,
  deleteExpenseCategory,
  deleteOtherExpense,
  getExpenseAllocations,
  getExpenseCategories,
  getExpenses,
  getOtherExpenses,
  updateExpense,
  updateExpenseAllocation,
  updateExpenseCategory,
  updateOtherExpense
} from "../controllers/expenseController.js";

const router = Router();

router.get("/categories", getExpenseCategories);
router.post("/categories", createExpenseCategory);
router.put("/categories/:id", updateExpenseCategory);
router.delete("/categories/:id", deleteExpenseCategory);

router.get("/lines", getExpenses);
router.post("/lines", createExpense);
router.put("/lines/:id", updateExpense);
router.delete("/lines/:id", deleteExpense);

router.get("/allocations", getExpenseAllocations);
router.post("/allocations", createExpenseAllocation);
router.put("/allocations/:id", updateExpenseAllocation);
router.delete("/allocations/:id", deleteExpenseAllocation);

router.get("/others", getOtherExpenses);
router.post("/others", createOtherExpense);
router.put("/others/:id", updateOtherExpense);
router.patch("/others/:id/approve", approveOtherExpense);
router.delete("/others/:id", deleteOtherExpense);

export default router;
