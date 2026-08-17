import RoleProfileSection from './RoleProfileSection';
import { roleProfileConfigs } from '../../lib/roleProfileConfigs';

// Thin wrapper so nothing calling <AgentProfileSection profile={...} onLocationSaved={...} onProfileSaved={...} />
// has to change. Behavior is identical to the original component.
export default function AgentProfileSection(props) {
  return <RoleProfileSection {...props} roleConfig={roleProfileConfigs.agent} />;
}