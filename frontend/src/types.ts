export type ClientStatus = "Actif" | "Prospect" | "Inactif";
export type ClientType =
  | "Organisation"
  | "Gouvernemental"
  | "Entreprise"
  | "Particulier";

export type ServiceRef = {
  _id: string;
  code: string;
  name: string;
  designation?: string;
  category?: string;
  description?: string;
  price: number;
};

export type Client = {
  _id: string;
  clientType: ClientType;
  name: string;
  contactName: string;
  domain?: string;
  email: string;
  phone: string;
  location: string;
  priceDev?: number;
  priceAnnual?: number;
  hosting?: boolean;
  maintenance?: boolean;
  activityCategories?: string[];
  service?: ServiceRef | string | null;
  status: ClientStatus;
};

export type FollowUp = {
  _id: string;
  title: string;
  client: Client;
  type: string;
  status: string;
  note: string;
  dueDate: string;
  description?: string;
  raisonParle?: string;
  suivi?: string;
  reponse?: string;
  clientPhone?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DashboardExpenseStats = {
  totalAmount: number;
  count: number;
  approved: number;
  pending: number;
  rejected: number;
  approvedAmount: number;
  pendingAmount: number;
  otherAmount: number;
  otherCount: number;
};

export type DashboardModuleCounts = {
  clients: number;
  suivis: number;
  factures: number;
  proformas: number;
  paiements: number;
  services: number;
  depenses: number;
  utilisateurs: number;
};

export type DashboardRecentExpense = {
  id: string;
  reference: string;
  reason: string;
  total: number;
  status: string;
  expenseDate: string;
  categoryName: string;
};

export type DashboardRecentConnection = {
  id: string;
  fullName: string;
  email: string;
  roleName: string;
  connectedAt: string;
};

export type Dashboard = {
  totalClients: number;
  caDevelopment: number;
  caAnnual: number;
  hostingCount: number;
  totalFollowUps: number;
  statusStats: { actifs: number; prospects: number; inactifs: number };
  servicesStats: { hosting: number; domain: number; maintenance: number };
  averageRevenuePerClient: number;
  topClients: Array<{ id: string; name: string; dev: number; annual: number }>;
  expenseStats?: DashboardExpenseStats;
  recentExpenses?: DashboardRecentExpense[];
  moduleCounts?: DashboardModuleCounts;
  recentConnections?: DashboardRecentConnection[];
};

export type Bank = {
  _id: string;
  name: string;
  accountNumberOrWallet: string;
  description: string;
  accountHolder: string;
  iban: string;
  swift: string;
};

export type PermissionDoc = {
  _id: string;
  key: string;
  label: string;
  category: string;
};

export type RoleDoc = {
  _id: string;
  name: string;
  description: string;
  permissions: PermissionDoc[];
};

export type UserDoc = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: RoleDoc;
  active: boolean;
};

export type ProformaLine = {
  service?: string | null;
  designation: string;
  category: string;
  description: string;
  quantite: number;
  largeur: number;
  longueur: number;
  unite: "U" | "m" | "m²";
  prixUnitaire: number;
  montant: number;
};

export type ProformaRow = {
  _id: string;
  proformaId: string;
  reference: string;
  invoiceType?: string;
  client?: string | { _id: string };
  clientName: string;
  company: string;
  phone?: string;
  date: string;
  status: string;
  amount: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  bankIban?: string;
  bankSwift?: string;
  lines?: ProformaLine[];
};

export type InvoicePaymentDoc = {
  _id: string;
  paymentId: string;
  invoiceRef: string;
  clientName: string;
  bank?: string | Bank | null;
  bankName?: string;
  bankAccountNumber?: string;
  date: string;
  method: string;
  amount: number;
  status: string;
  proofImageDataUrl?: string;
};

export type Setting = {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyContactName: string;
  website: string;
  address: string;
  currency: string;
  expirationAlertEnabled: boolean;
  expirationAlertDays: number;
  defaultBank?: string | Bank | null;
  bankName: string;
  bankAccountHolder: string;
  bankIban: string;
  bankSwift: string;
  documentHeader: string;
  documentFooter: string;
  logoDataUrl: string;
};

