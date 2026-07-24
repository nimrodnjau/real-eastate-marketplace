import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import ListRows from '../../components/dashboard/ListRows';
import ProcessTracker from '../../components/dashboard/ProcessTracker';
import '../../styles/dashboard.css';

// Valuer dashboard — split out from the old shared
// RoleDashboard + dashboardContent.js config so this role's content lives
// in one independent, top-to-bottom readable file. Swap the placeholder
// arrays below for real Supabase queries later; DashboardLayout, StatCard,
// ListRows, and ProcessTracker don't need to change to do that.

const STATS = [
  {
    "label": "Pending requests",
    "value": "4",
    "icon": "clipboardList"
  },
  {
    "label": "Reports this month",
    "value": "7",
    "icon": "fileText"
  },
  {
    "label": "Pending earnings",
    "value": "KES 63,000",
    "icon": "wallet"
  },
  {
    "label": "Credential status",
    "value": "Verified",
    "icon": "shieldCheck"
  }
];

const SECTIONS = [
  {
    "id": "requests",
    "title": "Incoming requests",
    "description": "Valuation requests from agents, buyers, banks, and sellers.",
    "icon": "clipboardList",
    "type": "list",
    "items": [
      {
        "title": "Valuation — Office suite, Westlands",
        "meta": "From: bank (mortgage application)",
        "badge": "New",
        "badgeTone": "neutral"
      },
      {
        "title": "Valuation — Retail unit, CBD",
        "meta": "From: Amina Yusuf (Agent)",
        "badge": "In progress",
        "badgeTone": "pending"
      }
    ]
  },
  {
    "id": "reports",
    "title": "Report queue",
    "description": "Reports in progress and ready to send.",
    "icon": "fileText",
    "type": "list",
    "items": [
      {
        "title": "Valuation report — 3-bed apartment, Kilimani",
        "meta": "Site visit scheduled",
        "badge": "In progress",
        "badgeTone": "pending"
      },
      {
        "title": "Valuation report — Half-acre plot, Ruiru",
        "meta": "Ready to send",
        "badge": "Ready",
        "badgeTone": "success"
      }
    ]
  },
  {
    "id": "payments",
    "title": "Payment history",
    "description": "Paid out after verification.",
    "icon": "wallet",
    "type": "list",
    "items": [
      {
        "title": "Valuation fee — Office suite, Westlands",
        "meta": "2 Jul 2026",
        "badge": "KES 18,000",
        "badgeTone": "success"
      }
    ]
  }
];

export default function ValuerDashboard() {
  const sections = SECTIONS.map((section) => ({
    ...section,
    content:
      section.type === 'process' ? (
        <ProcessTracker steps={section.steps} />
      ) : (
        <ListRows items={section.items} emptyLabel={section.emptyLabel} />
      ),
  }));

  return (
    <DashboardLayout
      roleLabel="Valuer"
      pageTitle="Valuer dashboard"
      pageSubtitle="Valuation requests, reports, and payments."
      sections={sections}
      verificationStatus={"Credentials verified"}
    >
      <div className="stat-grid">
        {STATS.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} hint={s.hint} />
        ))}
      </div>
    </DashboardLayout>
  );
}