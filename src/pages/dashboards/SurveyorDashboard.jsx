import { useAuth } from '../../context/AuthContext'; // ADJUST path to match your project structure
import ProfessionalDashboardShell from "../../shared/ProfessionalDashboardShell";
import { ROLE_CONFIGS } from '../../shared/roleConfigs';

/*
  SurveyorDashboard
  Register this in your DASHBOARDS map (pages/dashboards/index.js) against
  whatever role string signup assigns surveyors, e.g.:
    export const DASHBOARDS = { ..., surveyor: SurveyorDashboard };
*/
export default function SurveyorDashboard() {
  const { profile } = useAuth();
  return <ProfessionalDashboardShell userId={profile?.id} roleConfig={ROLE_CONFIGS.surveyor} />;
}