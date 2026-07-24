import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import ListRows from '../../components/dashboard/ListRows';
import ProcessTracker from '../../components/dashboard/ProcessTracker';
import '../../styles/dashboard.css';

// Tenant dashboard — split out from the old shared
// RoleDashboard + dashboardContent.js config so this role's content lives
// in one independent, top-to-bottom readable file. Swap the placeholder
// arrays below for real Supabase queries later; DashboardLayout, StatCard,
// ListRows, and ProcessTracker don't need to change to do that.

const STATS = [
  {
    "label": "Saved rentals",
    "value": "5",
    "icon": "building"
  },
  {
    "label": "Viewing requests",
    "value": "2",
    "icon": "clipboardList"
  },
  {
    "label": "Reviews read",
    "value": "14",
    "icon": "star"
  }
];

const SECTIONS = [
  {
    "id": "rentals",
    "title": "Browse rentals",
    "description": "Available units matching what you saved.",
    "icon": "building",
    "type": "list",
    "action": {
      "label": "Browse more"
    },
    "items": [
      {
        "title": "Studio, South B — Unit 1A",
        "meta": "KES 28,000 / mo",
        "badge": "Verified landlord",
        "badgeTone": "success"
      },
      {
        "title": "1-bed apartment, Ngara",
        "meta": "KES 32,000 / mo",
        "badge": "Verified landlord",
        "badgeTone": "success"
      }
    ]
  },
  {
    "id": "viewings",
    "title": "Your viewing requests",
    "description": "Status of the units you asked to view.",
    "icon": "clipboardList",
    "type": "list",
    "items": [
      {
        "title": "Studio, South B — Unit 1A",
        "meta": "Requested 5 Jul 2026",
        "badge": "Confirmed",
        "badgeTone": "success"
      },
      {
        "title": "1-bed apartment, Ngara",
        "meta": "Requested 8 Jul 2026",
        "badge": "Pending",
        "badgeTone": "pending"
      }
    ]
  },
  {
    "id": "reviews",
    "title": "Agency reviews",
    "description": "What other tenants say about agencies you're considering.",
    "icon": "star",
    "type": "list",
    "items": [
      {
        "title": "Nairobi Estates Management",
        "meta": "4.6 · 32 reviews",
        "badge": "Verified",
        "badgeTone": "success"
      },
      {
        "title": "Greenview Property Managers",
        "meta": "4.2 · 18 reviews",
        "badge": "Verified",
        "badgeTone": "success"
      }
    ]
  }
];

export default function TenantDashboard() {
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
      roleLabel="Tenant"
      pageTitle="Tenant dashboard"
      pageSubtitle="Browse rentals, track viewings, and read agency reviews."
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