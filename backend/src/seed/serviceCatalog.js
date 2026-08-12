/** Catalogue AL-HAKIM GROUP : designation = libelle du service. */
export const SERVICE_CATEGORIES = {
  DECORATION: "Décoration intérieure & extérieure",
  ALUMINIUM: "Aluminium & Vitrerie",
  MENUISERIE: "Menuiserie & Travaux en bois",
  METALLERIE: "Métallerie & Ferronnerie"
};

export const SERVICE_CATALOG = [
  {
    category: SERVICE_CATEGORIES.DECORATION,
    designations: [
      "Travaux de décoration intérieure et extérieure",
      "Aménagement et décoration de chambre à coucher",
      "Aménagement et décoration de salon",
      "Aménagement et décoration d'espace TV",
      "Décoration de plafond et faux plafond",
      "Conception et décoration de bibliothèque",
      "Aménagement et décoration de magasin / local commercial",
      "Aménagement intérieur complet",
      "Travaux de peinture intérieure et extérieure",
      "Pose de papier peint",
      "Fourniture et pose de panneaux décoratifs muraux",
      "Habillage mural décoratif",
      "Fourniture et pose de faux plafond en plâtre",
      "Plafond décoratif avec éclairage LED",
      "Cloison décorative",
      "Aménagement de bureau",
      "Aménagement de réception",
      "Aménagement de restaurant",
      "Aménagement de villa"
    ]
  },
  {
    category: SERVICE_CATEGORIES.ALUMINIUM,
    designations: [
      "Travaux d'aluminium et de vitrerie",
      "Fabrication et pose de porte en aluminium",
      "Fabrication et pose de fenêtre en aluminium",
      "Fabrication et pose de fenêtre vitrée",
      "Fabrication et pose de porte aluminium vitrée",
      "Fabrication et pose de fenêtre aluminium coulissante",
      "Fabrication et pose de fenêtre aluminium battante",
      "Fabrication et pose de baie vitrée coulissante",
      "Fabrication et pose de cloison vitrée",
      "Fabrication et pose de façade vitrée",
      "Fabrication et pose de vitrine de magasin",
      "Fabrication et pose de porte vitrée",
      "Fourniture et pose de miroir sur mesure",
      "Fabrication et pose de garde-corps en verre"
    ]
  },
  {
    category: SERVICE_CATEGORIES.MENUISERIE,
    designations: [
      "Travaux de menuiserie et ouvrages en bois",
      "Fabrication et pose de porte en bois",
      "Fabrication et pose de fenêtre en bois",
      "Fourniture et pose de revêtement décoratif imitation bois",
      "Habillage décoratif imitation bois pour bibliothèque",
      "Habillage décoratif imitation bois pour magasin / local commercial",
      "Fabrication et pose de cuisine équipée sur mesure",
      "Fabrication et pose de placard mural",
      "Fabrication et pose de dressing sur mesure",
      "Fabrication de meuble TV sur mesure",
      "Fabrication de bibliothèque sur mesure",
      "Fabrication de comptoir d'accueil",
      "Fabrication de comptoir de magasin",
      "Fabrication de meuble de rangement",
      "Habillage mural en bois",
      "Pose de panneaux décoratifs effet bois"
    ]
  },
  {
    category: SERVICE_CATEGORIES.METALLERIE,
    designations: [
      "Travaux de métallerie et ferronnerie",
      "Fabrication et pose de porte métallique extérieure",
      "Fabrication et pose de grand portail métallique coulissant",
      "Fabrication et pose de garde-corps métallique pour escalier",
      "Fabrication et pose de fenêtre métallique",
      "Fabrication et pose de grille métallique de protection pour fenêtre",
      "Fabrication et pose de clôture métallique extérieure de sécurité",
      "Fabrication et pose de portail métallique battant",
      "Fabrication et pose de porte métallique de sécurité",
      "Fabrication et pose de grille de protection",
      "Fabrication et pose de garde-corps métallique",
      "Fabrication et pose d'escalier métallique",
      "Fabrication et pose de structure métallique",
      "Fabrication et pose de charpente métallique",
      "Fabrication et pose de hangar métallique",
      "Fabrication et pose d'auvent métallique"
    ]
  }
];

export function flattenServiceCatalog() {
  const rows = [];
  let index = 1;
  for (const group of SERVICE_CATALOG) {
    for (const designation of group.designations) {
      rows.push({
        code: `SRV-${String(index).padStart(3, "0")}`,
        designation,
        name: designation,
        category: group.category,
        description: group.category,
        price: 0
      });
      index += 1;
    }
  }
  return rows;
}
