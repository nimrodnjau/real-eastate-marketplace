import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import ListRows from '../../components/dashboard/ListRows';
import ProcessTracker from '../../components/dashboard/ProcessTracker';
import '../../styles/dashboard.css';

// Landlord dashboard — split out from the old shared
// RoleDashboard + dashboardContent.js config so this role's content lives
// in one independent, top-to-bottom readable file. Swap the placeholder
// arrays below for real Supabase queries later; DashboardLayout, StatCard,
// ListRows, and ProcessTracker don't need to change to do that.

const STATS = [
  {
    "label": "Listed units",
    "value": "8",
    "icon": "key"
  },
  {
    "label": "Total clicks",
    "value": "342",
    "icon": "trendingUp"
  },
  {
    "label": "Active leases",
    "value": "5",
    "icon": "clipboardList"
  }
];

const SECTIONS = [
  {
    "id": "units",
    "title": "Your units",
    "description": "Performance on each unit you have listed.",
    "icon": "key",
    "type": "list",
    "action": {
      "label": "List a unit"
    },
    "items": [
      {
        "title": "2-bed apartment, Lavington — Unit 4B",
        "meta": "58 clicks",
        "badge": "Occupied",
        "badgeTone": "success"
      },
      {
        "title": "Studio, South B — Unit 1A",
        "meta": "21 clicks",
        "badge": "Vacant",
        "badgeTone": "pending"
      }
    ]
  },
  {
    "id": "managers",
    "title": "Property managers near you",
    "description": "Hand off day-to-day management.",
    "icon": "users",
    "type": "list",
    "items": [
      {
        "title": "Nairobi Estates Management",
        "meta": "3.4 km away",
        "badge": "Verified",
        "badgeTone": "success"
      },
      {
        "title": "Greenview Property Managers",
        "meta": "5.1 km away",
        "badge": "Verified",
        "badgeTone": "success"
      }
    ]
  }
];

export default function LandlordDashboard() {
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
      roleLabel="Landlord"
      pageTitle="Landlord dashboard"
      pageSubtitle="Your leased units and the managers helping you run them."
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