import { MessageCircle } from 'lucide-react';
import MessagesSection from './MessagesSection';

// Thin wrapper so "Messages" slots into the dashboard sections array the
// same way units/managers/agents do. MessagesSection is fully self-contained
// (auth, data fetching, realtime all handled internally via useAuth()), so
// there's nothing to fetch or pass in here.
export function useLandlordMessagesSection() {
  const section = {
    id: 'messages',
    title: 'Messages',
    icon: MessageCircle,
    content: <MessagesSection />,
  };

  return { section, error: null };
}