import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app.js";
import { connectDb } from "./config/db.js";
import { ensurePageCollections } from "./config/collections.js";
import { seedInitialData } from "./seed/seedData.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/AL-HAKIMGROUP";

async function bootstrap() {
  await connectDb(MONGODB_URI);
  await ensurePageCollections(mongoose);
  await seedInitialData();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Serveur API sur http://localhost:${PORT}`);
    console.log(`Base MongoDB: ${MONGODB_URI}`);
  });
}

bootstrap();
