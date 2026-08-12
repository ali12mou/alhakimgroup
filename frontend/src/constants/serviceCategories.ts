export const CLIENT_ACTIVITY_CATEGORIES = [
  "Décoration intérieure & extérieure",
  "Aluminium & Vitrerie",
  "Menuiserie & Travaux en bois",
  "Métallerie & Ferronnerie"
] as const;

export type ClientActivityCategory = (typeof CLIENT_ACTIVITY_CATEGORIES)[number];
