import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MessageCircleIcon } from '../components/dashboard/icons';
import PublicChatSection from '../components/dashboard/PublicChatSection';
import '../styles/public-chat.css';

export default function PublicChatPage() {
  const navigate = useNavigate();

  return (
    <div className="standalone-page">
      <header className="standalone-page-header">
        <button
          type="button"
          className="standalone-page-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="section-card-icon">
          <MessageCircleIcon />
        </span>
        <div>
          <h1>Public chat</h1>
          <p>Open to every buyer, seller, and professional on the platform.</p>
        </div>
      </header>

      <div className="standalone-page-body">
        <PublicChatSection />
      </div>
    </div>
  );
}