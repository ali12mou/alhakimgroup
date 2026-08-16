import { cloneElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  DollarSign,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Receipt,
  Server,
  Settings as SettingsIcon,
  TrendingUp,
  UserRoundCheck,
  Users,
  Wallet,
  Clock3
} from "lucide-react";
import { api } from "../../services/apiService";
import type {
  Dashboard,
  DashboardExpenseStats,
  DashboardModuleCounts,
  DashboardRecentConnection,
  Setting
} from "../../types";
import { formatMoney } from "../../utils";
import "./Dashboard.css";

export type DashboardTab =
  | "clients"
  | "suivis"
  | "rapports"
  | "paiement-facture"
  | "facture"
  | "proforma"
  | "service"
  | "depenses"
  | "parametres";

type Props = {
  onNavigate?: (tab: DashboardTab) => void;
};

const defaultSettings: Setting = {
  companyName: "AL-HAKIM GROUP",
  companyEmail: "contact@geosomtech.com",
  companyPhone: "+253 XX XX XX XX",
  companyContactName: "",
  website: "https://geosomtech.com",
  address: "Djibouti",
  currency: "FDJ",
  expirationAlertEnabled: true,
  expirationAlertDays: 60,
  defaultBank: null,
  bankName: "",
  bankAccountHolder: "",
  bankIban: "",
  bankSwift: "",
  documentHeader: "",
  documentFooter: "",
  logoDataUrl: ""
};

const emptyExpenseStats: DashboardExpenseStats = {
  totalAmount: 0,
  count: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
  approvedAmount: 0,
  pendingAmount: 0,
  otherAmount: 0,
  otherCount: 0
};

const emptyModuleCounts: DashboardModuleCounts = {
  clients: 0,
  suivis: 0,
  factures: 0,
  proformas: 0,
  paiements: 0,
  services: 0,
  depenses: 0,
  utilisateurs: 0
};

const demoDashboard: Dashboard = {
  totalClients: 24,
  caDevelopment: 1320000,
  caAnnual: 540000,
  hostingCount: 17,
  totalFollowUps: 11,
  statusStats: { actifs: 18, prospects: 4, inactifs: 2 },
  servicesStats: { hosting: 17, domain: 24, maintenance: 13 },
  averageRevenuePerClient: 77500,
  topClients: [
    { id: "demo-1", name: "Mawada International", dev: 620255, annual: 89000 },
    { id: "demo-2", name: "Djibouti Smile", dev: 132000, annual: 80000 },
    { id: "demo-3", name: "Global Transit", dev: 142000, annual: 80000 }
  ],
  expenseStats: {
    totalAmount: 184500,
    count: 12,
    approved: 8,
    pending: 3,
    rejected: 1,
    approvedAmount: 150000,
    pendingAmount: 24500,
    otherAmount: 50300,
    otherCount: 2
  },
  recentExpenses: [
    {
      id: "1",
      reference: "REF/2026-07-16/14/30",
      reason: "Achat materiel",
      total: 45000,
      status: "Approuve",
      expenseDate: "2026-07-16",
      categoryName: "Transportation"
    }
  ],
  moduleCounts: {
    clients: 24,
    suivis: 11,
    factures: 9,
    proformas: 6,
    paiements: 7,
    services: 5,
    depenses: 12,
    utilisateurs: 3
  },
  recentConnections: [
    {
      id: "c1",
      fullName: "Administrateur",
      email: "admin@geosomtech.com",
      roleName: "Administrateur",
      connectedAt: new Date().toISOString()
    }
  ]
};

const STATUS_COLORS = { Actifs: "#0431A6", Prospects: "#9B9EAC", Inactifs: "#B2B7C6" };
const BAR_PRIMARY = "#101C4E";
const BAR_SECONDARY = "#0431A6";
const BAR_TERTIARY = "#505670";
const EXPENSE_COLORS = { Approuvees: "#0431A6", "En attente": "#9B9EAC", Rejetees: "#ef4444" };

function compactAxisValue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function formatConnectedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** Attend des dimensions réelles avant de monter Recharts (évite width/height -1). */
function ChartFrame({ compact, children }: { compact?: boolean; children: ReactElement<{ width?: number; height?: number }> }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const measure = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  const ready = box.w > 8 && box.h > 8;

  return (
    <div
      ref={hostRef}
      className={`dash-chart-inner${compact ? " dash-chart-inner--compact" : ""}`}
    >
      {ready ? cloneElement(children, { width: box.w, height: box.h }) : null}
    </div>
  );
}

export default function DashboardPage({ onNavigate }: Props) {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState<Dashboard>(demoDashboard);
  const [settings, setSettings] = useState<Setting>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const go = (tab: DashboardTab) => {
    onNavigate?.(tab);
  };

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");
        const sessionKey = "geosom-dashboard-connected";
        if (!sessionStorage.getItem(sessionKey)) {
          try {
            await api.post("/dashboard/connect", {
              fullName: "Administrateur",
              email: "admin@geosomtech.com",
              roleName: "Administrateur",
              source: "dashboard"
            });
            sessionStorage.setItem(sessionKey, "1");
          } catch {
            /* ignore connect errors */
          }
        }
        const [dashboardRes, settingsRes] = await Promise.all([api.get("/dashboard"), api.get("/settings")]);
        setDashboard(dashboardRes.data);
        setSettings({ ...defaultSettings, ...settingsRes.data });
      } catch {
        setError("Mode hors ligne : donnees de demonstration.");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  const expenseStats = dashboard.expenseStats ?? emptyExpenseStats;
  const moduleCounts = dashboard.moduleCounts ?? emptyModuleCounts;
  const recentConnections: DashboardRecentConnection[] = dashboard.recentConnections ?? [];
  const recentExpenses = dashboard.recentExpenses ?? [];

  const maxTopClientDev = useMemo(() => {
    const devs = dashboard.topClients.map((c) => c.dev);
    return Math.max(1, ...(devs.length ? devs : [1]));
  }, [dashboard]);

  const statusPieData = useMemo(
    () => [
      { name: "Actifs", value: dashboard.statusStats.actifs },
      { name: "Prospects", value: dashboard.statusStats.prospects },
      { name: "Inactifs", value: dashboard.statusStats.inactifs }
    ],
    [dashboard.statusStats]
  );

  const statusTotal = statusPieData.reduce((s, d) => s + d.value, 0);

  const caBarData = useMemo(
    () => [
      { name: "CA developpement", montant: dashboard.caDevelopment },
      { name: "CA annuel (recurrent)", montant: dashboard.caAnnual }
    ],
    [dashboard.caDevelopment, dashboard.caAnnual]
  );

  const topClientsBarData = useMemo(
    () =>
      dashboard.topClients.map((c) => ({
        name: c.name.length > 16 ? `${c.name.slice(0, 16)}…` : c.name,
        fullName: c.name,
        dev: c.dev
      })),
    [dashboard.topClients]
  );

  const servicesBarData = useMemo(
    () => [
      { name: "Services", count: dashboard.servicesStats.hosting },
      { name: "Domaines", count: dashboard.servicesStats.domain },
      { name: "Maintenance", count: dashboard.servicesStats.maintenance }
    ],
    [dashboard.servicesStats]
  );

  const expenseStatusPie = useMemo(
    () => [
      { name: "Approuvees", value: expenseStats.approved },
      { name: "En attente", value: expenseStats.pending },
      { name: "Rejetees", value: expenseStats.rejected }
    ],
    [expenseStats]
  );

  const expenseAmountBars = useMemo(
    () => [
      { name: "Depenses", montant: expenseStats.totalAmount },
      { name: "Approuvees", montant: expenseStats.approvedAmount },
      { name: "En attente", montant: expenseStats.pendingAmount },
      { name: "Autres", montant: expenseStats.otherAmount }
    ],
    [expenseStats]
  );

  const modules = [
    { tab: "clients" as const, label: "Clients", icon: Users, count: moduleCounts.clients, hint: "Portefeuille" },
    { tab: "suivis" as const, label: "Suivis", icon: ClipboardList, count: moduleCounts.suivis, hint: "Echanges" },
    { tab: "facture" as const, label: "Factures", icon: FileText, count: moduleCounts.factures, hint: "Documents" },
    { tab: "proforma" as const, label: "Proformas", icon: FileSpreadsheet, count: moduleCounts.proformas, hint: "Devis" },
    {
      tab: "paiement-facture" as const,
      label: "Paiements",
      icon: HandCoins,
      count: moduleCounts.paiements,
      hint: "Encaissements"
    },
    { tab: "service" as const, label: "Services", icon: BriefcaseBusiness, count: moduleCounts.services, hint: "Catalogue" },
    { tab: "depenses" as const, label: "Depenses", icon: Wallet, count: moduleCounts.depenses, hint: "Tresorerie" },
    { tab: "rapports" as const, label: "Rapports", icon: BarChart3, count: null, hint: "Analyses" },
    {
      tab: "parametres" as const,
      label: "Parametres",
      icon: SettingsIcon,
      count: moduleCounts.utilisateurs,
      hint: "Utilisateurs"
    }
  ];

  if (loading) {
    return (
      <section className="dash-pro" aria-busy="true">
        <div className="dash-skeleton">
          <div className="dash-skeleton-hero" />
          <div className="dash-skeleton-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="dash-skeleton-card" />
            ))}
          </div>
          <div className="dash-skeleton-charts">
            <div className="dash-skeleton-chart" />
            <div className="dash-skeleton-chart" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dash-pro">
      <header className="dash-pro-hero">
        <span className="dash-pro-badge">{t("common.brand")} · {t("common.tagline")}</span>
        <h1>{t("dashboard.title")}</h1>
        <p>{t("dashboard.subtitle")}</p>
      </header>

      {error ? <div className="dash-pro-alert">{error}</div> : null}

      <div className="dash-section-head">
        <div>
          <h2>Acces rapide aux modules</h2>
          <p>Chaque carte ouvre la partie menu concernee.</p>
        </div>
      </div>
      <div className="dash-modules-grid">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <button key={m.tab} type="button" className="dash-module-card" onClick={() => go(m.tab)}>
              <span className="dash-module-icon" aria-hidden>
                <Icon size={18} />
              </span>
              <span className="dash-module-body">
                <strong>{m.label}</strong>
                <small>{m.hint}</small>
              </span>
              {m.count !== null ? <span className="dash-module-count">{m.count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="dash-kpi-grid">
        <button type="button" className="dash-kpi dash-kpi--btn" onClick={() => go("clients")}>
          <div className="dash-kpi-icon dash-kpi-icon--clients" aria-hidden>
            <UserRoundCheck size={18} />
          </div>
          <div className="dash-kpi-body">
            <h3>Clients</h3>
            <p className="dash-kpi-value">{dashboard.totalClients}</p>
            <span className="dash-kpi-hint">{dashboard.statusStats.actifs} actifs</span>
          </div>
        </button>
        <button type="button" className="dash-kpi dash-kpi--btn" onClick={() => go("rapports")}>
          <div className="dash-kpi-icon dash-kpi-icon--money" aria-hidden>
            <DollarSign size={18} />
          </div>
          <div className="dash-kpi-body">
            <h3>CA developpement</h3>
            <p className="dash-kpi-value">{formatMoney(dashboard.caDevelopment, settings.currency)}</p>
          </div>
        </button>
        <button type="button" className="dash-kpi dash-kpi--btn" onClick={() => go("rapports")}>
          <div className="dash-kpi-icon dash-kpi-icon--recurring" aria-hidden>
            <TrendingUp size={18} />
          </div>
          <div className="dash-kpi-body">
            <h3>CA annuel</h3>
            <p className="dash-kpi-value">{formatMoney(dashboard.caAnnual, settings.currency)}</p>
          </div>
        </button>
        <button type="button" className="dash-kpi dash-kpi--btn" onClick={() => go("service")}>
          <div className="dash-kpi-icon dash-kpi-icon--hosting" aria-hidden>
            <Server size={18} />
          </div>
          <div className="dash-kpi-body">
            <h3>Services</h3>
            <p className="dash-kpi-value">{dashboard.hostingCount}</p>
            <span className="dash-kpi-hint">sur {dashboard.totalClients} clients</span>
          </div>
        </button>
        <button type="button" className="dash-kpi dash-kpi--btn" onClick={() => go("suivis")}>
          <div className="dash-kpi-icon dash-kpi-icon--followups" aria-hidden>
            <ClipboardList size={18} />
          </div>
          <div className="dash-kpi-body">
            <h3>Suivis</h3>
            <p className="dash-kpi-value">{dashboard.totalFollowUps}</p>
            <span className="dash-kpi-hint">echanges enregistres</span>
          </div>
        </button>
        <button type="button" className="dash-kpi dash-kpi--btn" onClick={() => go("depenses")}>
          <div className="dash-kpi-icon dash-kpi-icon--expense" aria-hidden>
            <Receipt size={18} />
          </div>
          <div className="dash-kpi-body">
            <h3>Depenses</h3>
            <p className="dash-kpi-value">{formatMoney(expenseStats.totalAmount, settings.currency)}</p>
            <span className="dash-kpi-hint">
              {expenseStats.count} lignes · {expenseStats.pending} en attente
            </span>
          </div>
        </button>
      </div>

      <div className="dash-charts-grid">
        <div className="dash-chart-card">
          <div className="dash-chart-card-head">
            <div>
              <h3>Repartition des clients</h3>
              <p className="dash-chart-desc">Statuts : actifs, prospects et inactifs</p>
            </div>
            <button type="button" className="dash-link-btn" onClick={() => go("clients")}>
              Voir clients
            </button>
          </div>
          {statusTotal === 0 ? (
            <div className="dash-chart-empty">Aucun client a afficher.</div>
          ) : (
            <ChartFrame compact>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ""} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`
                    }
                  >
                    {statusPieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] ?? "#cbd5e1"}
                        stroke="#fff"
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [String(value ?? 0), "Clients"]} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
            </ChartFrame>
          )}
        </div>

        <div className="dash-chart-card">
          <div className="dash-chart-card-head">
            <div>
              <h3>Chiffre d&apos;affaires</h3>
              <p className="dash-chart-desc">Developpement vs recurrent annuel</p>
            </div>
            <button type="button" className="dash-link-btn" onClick={() => go("rapports")}>
              Voir rapports
            </button>
          </div>
          <ChartFrame compact>
            <BarChart data={caBarData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} height={48} />
                <YAxis tickFormatter={compactAxisValue} tick={{ fontSize: 11 }} width={44} />
                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === "number" ? value : Number(value);
                    return [formatMoney(Number.isFinite(n) ? n : 0, settings.currency), "Montant"];
                  }}
                />
                <Bar dataKey="montant" radius={[8, 8, 0, 0]} fill={BAR_PRIMARY} name="Montant" />
              </BarChart>
          </ChartFrame>
        </div>
      </div>

      <div className="dash-section-head">
        <h2>Statistiques depenses</h2>
        <button type="button" className="dash-link-btn" onClick={() => go("depenses")}>
          Ouvrir depenses
        </button>
      </div>
      <div className="dash-expense-kpis">
        <article className="dash-expense-kpi">
          <span>Total depenses</span>
          <strong>{formatMoney(expenseStats.totalAmount, settings.currency)}</strong>
          <small>{expenseStats.count} lignes</small>
        </article>
        <article className="dash-expense-kpi">
          <span>Approuvees</span>
          <strong>{formatMoney(expenseStats.approvedAmount, settings.currency)}</strong>
          <small>{expenseStats.approved} validees</small>
        </article>
        <article className="dash-expense-kpi">
          <span>En attente</span>
          <strong>{formatMoney(expenseStats.pendingAmount, settings.currency)}</strong>
          <small>{expenseStats.pending} a traiter</small>
        </article>
        <article className="dash-expense-kpi">
          <span>Autres depenses</span>
          <strong>{formatMoney(expenseStats.otherAmount, settings.currency)}</strong>
          <small>{expenseStats.otherCount} postes</small>
        </article>
      </div>

      <div className="dash-charts-grid">
        <div className="dash-chart-card">
          <h3>Statuts des depenses</h3>
          <p className="dash-chart-desc">Repartition Approuve / En attente / Rejete</p>
          <ChartFrame compact>
            <PieChart>
                <Pie
                  data={expenseStatusPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={74}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {expenseStatusPie.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={EXPENSE_COLORS[entry.name as keyof typeof EXPENSE_COLORS] ?? "#cbd5e1"}
                      stroke="#fff"
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [String(value ?? 0), "Depenses"]} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
          </ChartFrame>
        </div>

        <div className="dash-chart-card">
          <h3>Montants depenses</h3>
          <p className="dash-chart-desc">Total, approuve, en attente et autres</p>
          <ChartFrame compact>
            <BarChart data={expenseAmountBars} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={compactAxisValue} tick={{ fontSize: 11 }} width={44} />
                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === "number" ? value : Number(value);
                    return [formatMoney(Number.isFinite(n) ? n : 0, settings.currency), "Montant"];
                  }}
                />
                <Bar dataKey="montant" radius={[8, 8, 0, 0]} fill={BAR_PRIMARY} name="Montant" />
              </BarChart>
          </ChartFrame>
        </div>
      </div>

      {recentExpenses.length > 0 ? (
        <div className="dash-list-panel">
          <div className="dash-chart-card-head">
            <h3>Dernieres depenses</h3>
            <button type="button" className="dash-link-btn" onClick={() => go("depenses")}>
              Voir tout
            </button>
          </div>
          <ul className="dash-list">
            {recentExpenses.map((e) => (
              <li key={e.id}>
                <div>
                  <strong>{e.reference}</strong>
                  <span>
                    {e.categoryName} · {e.reason}
                  </span>
                </div>
                <div className="dash-list-right">
                  <strong>{formatMoney(e.total, settings.currency)}</strong>
                  <small className={`dash-status dash-status--${e.status === "Approuve" ? "ok" : "pending"}`}>
                    {e.status}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="dash-charts-grid">
        <div className="dash-chart-card">
          <div className="dash-chart-card-head">
            <div>
              <h3>Top clients (CA developpement)</h3>
              <p className="dash-chart-desc">Les principaux contributeurs au CA projet</p>
            </div>
            <button type="button" className="dash-link-btn" onClick={() => go("clients")}>
              Voir clients
            </button>
          </div>
          {topClientsBarData.length === 0 ? (
            <div className="dash-chart-empty">Aucune donnee.</div>
          ) : (
            <ChartFrame>
                <BarChart
                  layout="vertical"
                  data={topClientsBarData}
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={compactAxisValue} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, _name, item) => {
                      const payload = item?.payload as { fullName?: string } | undefined;
                      const n = typeof value === "number" ? value : Number(value);
                      return [
                        formatMoney(Number.isFinite(n) ? n : 0, settings.currency),
                        payload?.fullName ?? "CA dev."
                      ];
                    }}
                  />
                  <Bar dataKey="dev" radius={[0, 6, 6, 0]} fill={BAR_SECONDARY} name="CA dev." />
                </BarChart>
            </ChartFrame>
          )}
        </div>

        <div className="dash-chart-card">
          <div className="dash-chart-card-head">
            <div>
              <h3>Services rattaches</h3>
              <p className="dash-chart-desc">Hosting, domaines et maintenance</p>
            </div>
            <button type="button" className="dash-link-btn" onClick={() => go("service")}>
              Voir services
            </button>
          </div>
          <ChartFrame>
            <BarChart data={servicesBarData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                <Tooltip formatter={(v) => [String(v ?? 0), "Nombre"]} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} fill={BAR_TERTIARY} name="Nombre" />
              </BarChart>
          </ChartFrame>
        </div>
      </div>

      <div className="dash-bottom-grid">
        <div className="dash-top-panel">
          <div className="dash-chart-card-head">
            <h3>Detail top clients</h3>
            <button type="button" className="dash-link-btn" onClick={() => go("clients")}>
              Clients
            </button>
          </div>
          {dashboard.topClients.length === 0 ? (
            <p className="dash-chart-desc" style={{ margin: 0 }}>
              Aucun client en tete du classement.
            </p>
          ) : (
            dashboard.topClients.map((client, index) => (
              <div className="dash-top-row" key={client.id}>
                <div className="dash-top-line">
                  <span>
                    #{index + 1} {client.name}
                  </span>
                  <strong>
                    {formatMoney(client.dev, settings.currency)}
                    <small>+ {formatMoney(client.annual, settings.currency)} / an</small>
                  </strong>
                </div>
                <div className="dash-progress">
                  <div style={{ width: `${(client.dev / maxTopClientDev) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="dash-top-panel dash-connections">
          <div className="dash-chart-card-head">
            <h3>
              <Clock3 size={16} aria-hidden /> Dernieres connexions recentes
            </h3>
            <button type="button" className="dash-link-btn" onClick={() => go("parametres")}>
              Utilisateurs
            </button>
          </div>
          {recentConnections.length === 0 ? (
            <p className="dash-chart-desc" style={{ margin: 0 }}>
              Aucune connexion enregistree pour le moment.
            </p>
          ) : (
            <ul className="dash-connection-list">
              {recentConnections.map((c, index) => (
                <li key={`${c.id}-${c.connectedAt}-${index}`}>
                  <div className="dash-connection-avatar" aria-hidden>
                    {(c.fullName || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="dash-connection-body">
                    <strong>{c.fullName}</strong>
                    <span>
                      {c.roleName}
                      {c.email ? ` · ${c.email}` : ""}
                    </span>
                  </div>
                  <time dateTime={c.connectedAt}>{formatConnectedAt(c.connectedAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

