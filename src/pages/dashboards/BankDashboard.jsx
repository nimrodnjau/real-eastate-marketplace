import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/dashboard/StatCard';
import ListRows from '../../components/dashboard/ListRows';
import ProcessTracker from '../../components/dashboard/ProcessTracker';
import '../../styles/dashboard.css';

// Bank dashboard — split out from the old shared
// RoleDashboard + dashboardContent.js config so this role's content lives
// in one independent, top-to-bottom readable file. Swap the placeholder
// arrays below for real Supabase queries later; DashboardLayout, StatCard,
// ListRows, and ProcessTracker don't need to change to do that.

const STATS = [
  {
    "label": "Active mortgage plans",
    "value": "6",
    "icon": "landmark"
  },
  {
    "label": "Inquiries this month",
    "value": "23",
    "icon": "users"
  },
  {
    "label": "Approved applications",
    "value": "4",
    "icon": "shieldCheck"
  }
];

const SECTIONS = [
  {
    "id": "plans",
    "title": "Your mortgage plans",
    "description": "Financing plans currently posted to the marketplace.",
    "icon": "landmark",
    "type": "list",
    "action": {
      "label": "Post a plan"
    },
    "items": [
      {
        "title": "Standard home loan",
        "meta": "13.5% p.a. · up to 20 yrs",
        "badge": "Active",
        "badgeTone": "success"
      },
      {
        "title": "First-time buyer plan",
        "meta": "12.9% p.a. · up to 25 yrs",
        "badge": "Active",
        "badgeTone": "success"
      }
    ]
  },
  {
    "id": "inquiries",
    "title": "Recent inquiries",
    "description": "Applicants interested in your plans.",
    "icon": "users",
    "type": "list",
    "items": [
      {
        "title": "J. Mwangi — 3-bed apartment, Kilimani",
        "meta": "Standard home loan",
        "badge": "Reviewing",
        "badgeTone": "pending"
      },
      {
        "title": "F. Achieng — Office suite, Westlands",
        "meta": "First-time buyer plan",
        "badge": "Approved",
        "badgeTone": "success"
      }
    ]
  },
  {
    "id": "listings",
    "title": "Marketplace listings",
    "description": "Properties currently on the platform.",
    "icon": "building",
    "type": "list",
    "items": [
      {
        "title": "3-bed apartment, Kilimani",
        "meta": "KES 12.5M",
        "badge": "Verified seller",
        "badgeTone": "success"
      },
      {
        "title": "Office suite, Westlands",
        "meta": "KES 85,000 / mo",
        "badge": "Verified seller",
        "badgeTone": "success"
      }
    ]
  }
];

export default function BankDashboard() {
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
      roleLabel="Bank"
      pageTitle="Bank dashboard"
      pageSubtitle="Your mortgage plans and marketplace activity."
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