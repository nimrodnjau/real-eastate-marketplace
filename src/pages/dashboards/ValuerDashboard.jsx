import { useAuth } from '../../context/AuthContext'; // ADJUST path to match your project structure
import ProfessionalDashboardShell from "../../shared/ProfessionalDashboardShell";
import { ROLE_CONFIGS } from '../../shared/roleConfigs';

/*
  ValuerDashboard
  Register this in your DASHBOARDS map (pages/dashboards/index.js) against
  whatever role string signup assigns valuers, e.g.:
    export const DASHBOARDS = { ..., valuer: ValuerDashboard };
*/
export default function ValuerDashboard() {
  const { profile } = useAuth();
  return <ProfessionalDashboardShell userId={profile?.id} roleConfig={ROLE_CONFIGS.valuer} />;
}