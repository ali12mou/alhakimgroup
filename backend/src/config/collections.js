/** Noms de collections MongoDB — une table par page de l'application. */
export const COLLECTIONS = {
  tableauDeBord: "tableau_de_bord",
  clients: "clients",
  suivis: "suivis",
  rapports: "rapports",
  paiements: "paiements",
  factures: "factures",
  proformas: "proformas",
  services: "services",
  depenses: "depenses",
  parametres: "parametres",
  banques: "banques",
  utilisateurs: "utilisateurs",
  roles: "roles",
  permissions: "permissions",
  categoriesDepenses: "categories_depenses",
  allocationsDepenses: "allocations_depenses",
  autresDepenses: "autres_depenses"
};

export async function ensurePageCollections(mongoose) {
  const db = mongoose.connection.db;
  if (!db) return;

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  for (const name of Object.values(COLLECTIONS)) {
    if (!existing.has(name)) {
      await db.createCollection(name);
    }
  }

  if (existing.has("AL-HAKIMGROUP")) {
    const count = await db.collection("AL-HAKIMGROUP").countDocuments();
    if (count === 0) {
      await db.collection("AL-HAKIMGROUP").drop();
    }
  }
}
