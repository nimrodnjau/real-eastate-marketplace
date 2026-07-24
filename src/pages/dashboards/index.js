import BuyerDashboard from './BuyerDashboard';
import SellerDashboard from './SellerDashboard';
import AgentDashboard from './AgentDashboard';
import LawyerDashboard from './LawyerDashboard';
import ValuerDashboard from './ValuerDashboard';
import SurveyorDashboard from './SurveyorDashboard';
import BankDashboard from './BankDashboard';
import LandlordDashboard from './LandlordDashboard';
import PropertyManagerDashboard from './PropertyManagerDashboard';
import TenantDashboard from './TenantDashboard';

// Maps profile.role -> the dashboard component for that role. Add a new
// role by adding one line here (and creating its file) — nothing else
// needs to change.
export const DASHBOARDS = {
  buyer: BuyerDashboard,
  seller: SellerDashboard,
  agent: AgentDashboard,
  lawyer: LawyerDashboard,
  valuer: ValuerDashboard,
  surveyor: SurveyorDashboard,
  bank: BankDashboard,
  landlord: LandlordDashboard,
  property_manager: PropertyManagerDashboard,
  tenant: TenantDashboard,
};