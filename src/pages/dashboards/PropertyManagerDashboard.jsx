import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import ListRows from '../../components/dashboard/ListRows';
import ProcessTracker from '../../components/dashboard/ProcessTracker';
import '../../styles/dashboard.css';

// Property manager dashboard — split out from the old shared
// RoleDashboard + dashboardContent.js config so this role's content lives
// in one independent, top-to-bottom readable file. Swap the placeholder
// arrays below for real Supabase queries later; DashboardLayout, StatCard,
// ListRows, and ProcessTracker don't need to change to do that.

const STATS = [
  {
    "label": "Managed properties",
    "value": "11",
    "icon": "building"
  },
  {
    "label": "Newly leased this month",
    "value": "3",
    "icon": "key"
  },
  {
    "label": "Pending requests",
    "value": "2",
    "icon": "clipboardList"
  }
];

const SECTIONS = [
  {
    "id": "managed",
    "title": "Properties you manage",
    "description": "Units currently under your management.",
    "icon": "building",
    "type": "list",
    "items": [
      {
        "title": "2-bed apartment, Lavington — Unit 4B",
        "meta": "Owner: J. Kariuki",
        "badge": "Occupied",
        "badgeTone": "success"
      },
      {
        "title": "Retail unit, CBD",
        "meta": "Owner: Coral Properties Ltd",
        "badge": "Vacant",
        "badgeTone": "pending"
      }
    ]
  },
  {
    "id": "newly-leased",
    "title": "Newly leased commercial units",
    "description": "Recently leased units across the marketplace.",
    "icon": "key",
    "type": "list",
    "action": {
      "label": "List a unit"
    },
    "items": [
      {
        "title": "Office suite, Westlands",
        "meta": "Leased 2 Jul 2026",
        "badge": "Leased",
        "badgeTone": "success"
      },
      {
        "title": "Warehouse, Industrial Area",
        "meta": "Leased 28 Jun 2026",
        "badge": "Leased",
        "badgeTone": "success"
      }
    ]
  }
];

export default function PropertyManagerDashboard() {
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
      roleLabel="Property manager"
      pageTitle="Property manager dashboard"
      pageSubtitle="Properties you manage and newly leased commercial units."
      sections={sections}
      verificationStatus={null}
    >
      <div className="stat-grid">
        {STATS.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} hint={s.hint} />
        ))}
      </div>
    </DashboardLayout>
  );
}