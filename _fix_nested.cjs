const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const files = [
  "frontend/src/App.css",
  "frontend/src/App.tsx",
  "frontend/src/types.ts",
  "frontend/src/pages/dashboard/Dashboard.css",
  "frontend/src/pages/dashboard/Dashboard.tsx",
  "frontend/src/pages/depenses/DepensesPage.css",
  "frontend/src/pages/depenses/DepensesPage.tsx",
  "frontend/src/pages/factures/Factures.tsx",
  "frontend/src/pages/paiement/PaiementFacture.tsx",
  "frontend/src/pages/proforma/Proformas.tsx",
  "backend/src/seed/seedData.js",
  "backend/src/controllers/billingController.js",
  "backend/src/controllers/clientController.js",
  "backend/src/controllers/dashboardController.js",
  "backend/src/controllers/expenseController.js",
  "backend/src/models/Bank.js",
  "backend/src/models/Client.js",
  "backend/src/models/Expense.js",
  "backend/src/models/Invoice.js",
  "backend/src/models/InvoicePayment.js",
  "backend/src/models/Service.js",
  "backend/src/routes/billingRoutes.js",
  "backend/src/routes/dashboardRoutes.js"
];

function resolveStack(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  // stack of modes: 'keep' | 'skip'
  const stack = [];
  for (const line of lines) {
    if (/^<<<<<<< /.test(line)) {
      // entering conflict: keep HEAD side
      stack.push("keep");
      continue;
    }
    if (/^=======$/.test(line)) {
      if (stack.length === 0) {
        // stray separator - skip
        continue;
      }
      // switch current conflict side to theirs => skip
      stack[stack.length - 1] = "skip";
      continue;
    }
    if (/^>>>>>>> /.test(line)) {
      if (stack.length) stack.pop();
      continue;
    }
    const skipping = stack.some((m) => m === "skip");
    if (!skipping) out.push(line);
  }
  return out.join("\n") + "\n";
}

for (const rel of files) {
  let original;
  try {
    original = execSync(`git show HEAD:${rel}`, {
      cwd: __dirname,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    });
  } catch (e) {
    console.error("missing in git:", rel);
    continue;
  }
  if (!original.includes("<<<<<<<")) {
    // already clean in git; keep current disk if present
    console.log("clean in git:", rel);
    continue;
  }
  const next = resolveStack(original);
  if (/^<<<<<<< |^=======|^>>>>>>> /m.test(next)) {
    console.error("FAILED:", rel);
    process.exitCode = 1;
    continue;
  }
  fs.writeFileSync(path.join(__dirname, rel), next);
  console.log("restored", rel);
}
