import { useAuth } from '../../context/AuthContext'; // ADJUST path to match your project structure
import ProfessionalDashboardShell from "../../shared/ProfessionalDashboardShell";
import { ROLE_CONFIGS } from '../../shared/roleConfigs';

/*
  LawyerDashboard
  Register this in your DASHBOARDS map (pages/dashboards/index.js) against
  whatever role string signup assigns lawyers, e.g.:
    export const DASHBOARDS = { ..., lawyer: LawyerDashboard };
*/
export default function LawyerDashboard() {
  const { profile } = useAuth();
  return <ProfessionalDashboardShell userId={profile?.id} roleConfig={ROLE_CONFIGS.lawyer} />;
}