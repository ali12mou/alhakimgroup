import mongoose from "mongoose";

export async function connectDb(mongoUri) {
  try {
    await mongoose.connect(mongoUri);
    // eslint-disable-next-line no-console
    console.log(`MongoDB connecte: ${mongoUri}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Erreur connexion MongoDB:", error.message);
    process.exit(1);
  }
}
