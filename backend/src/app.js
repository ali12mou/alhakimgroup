import cors from "cors";
import express from "express";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import followUpRoutes from "./routes/followUpRoutes.js";
import permissionRoutes from "./routes/permissionRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import settingRoutes from "./routes/settingRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/followups", followUpRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);

app.use((error, req, res, next) => {
  const status = error.status || 500;
  return res.status(status).json({
    message: error.message || "Erreur serveur"
  });
});

export default app;
