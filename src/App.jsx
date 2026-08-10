import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SelectRole from './pages/SelectRole';
import WelcomePage from './pages/WelcomePage';
import { DASHBOARDS } from './pages/dashboards';
import BuyerDashboard from './pages/dashboards/BuyerDashboard'; // fallback for unrecognized roles
import Listings from './pages/Listings';
import AgentsPage from './pages/AgentsPage';
import ProfessionalsPage from './pages/ProfessionalsPage';
import BanksPage from './pages/BanksPage';
import ListingDetail from './pages/ListingDetail';
import PurchaseTracker from './pages/PurchaseTracker';
import PublicChatPage from './pages/PublicChatPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import { AdminRoute } from './components/AdminRoute';
import MessagesSection from './components/dashboard/MessagesSection'; // Add this import
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/select-role" element={<SelectRole />} />

          {/* Landing page shown right after login, before the dashboard */}
          <Route
            path="/welcome"
            element={
              <ProtectedRoute>
                <WelcomePage />
              </ProtectedRoute>
            }
          />

          {/* The actual role dashboard, reached via the "Go to your dashboard"
              button on WelcomePage (or any quick-action card) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RoleDashboardRoute />
              </ProtectedRoute>
            }
          />

          {/* ADD THE MESSAGES ROUTE HERE - inside protected routes */}
          <Route
            path="/dashboard/messages"
            element={
              <ProtectedRoute>
                <MessagesSection />
              </ProtectedRoute>
            }
          />
          
              <Route
                path="/listings"
                element={
                  <ProtectedRoute>
                    <Listings />
                  </ProtectedRoute>
                }
              />
              <Route
  path="/listings/:id"
  element={
    <ProtectedRoute>
      <ListingDetail />
    </ProtectedRoute>
  }
/>
<Route
  path="/purchases/:id"
  element={
    <ProtectedRoute>
      <PurchaseTracker />
    </ProtectedRoute>
  }
/>
<Route
  path="/community"
  element={
    <ProtectedRoute>
      <PublicChatPage />
    </ProtectedRoute>
  }
/>

              <Route
                path="/agents"
                element={
                  <ProtectedRoute>
                    <AgentsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/professionals"
                element={
                  <ProtectedRoute>
                    <ProfessionalsPage />
                  </ProtectedRoute>
                }
              />
               <Route
                path="/banks"
                element={
                  <ProtectedRoute>
                    <BanksPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/login" element={<AdminLogin />} />

<Route
  path="/admin/*"
  element={
    <AdminRoute>
      <AdminDashboard />
    </AdminRoute>
  }
/>

          {/* Root now redirects into the welcome flow rather than being the
              dashboard itself */}
          <Route
            path="/"
            element={
              <LandingPage />
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// Looks up the current user's role in the DASHBOARDS table (see
// pages/dashboards/index.js) and renders that role's independent dashboard
// component directly — no shared RoleDashboard/config indirection.
function RoleDashboardRoute() {
  const { profile } = useAuth();
  const Dashboard = DASHBOARDS[profile?.role] || BuyerDashboard;
  return <Dashboard />;
}