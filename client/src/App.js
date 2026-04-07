import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CRMProvider } from './context/CRMContext';
import { ToastProvider } from './components/shared/Toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Shipping from './pages/Shipping';
import Production from './pages/Production';
import Containers from './pages/Containers';

// Routing tab removed per user request
import Showroom from './pages/Showroom';
import Team from './pages/Team';
import ATS from './pages/ATS';
import BuyerPage from './pages/BuyerPage';
import OfficePage from './pages/OfficePage';
import HRPage from './pages/HRPage';
import JohnAnthony from './pages/JohnAnthony';
import ContactLog from './pages/ContactLog';
import LineSheets from './pages/LineSheets';
import NewCustomerOutreach from './pages/NewCustomerOutreach';
import Vendors from './pages/Vendors';
import Model from './pages/Model';
import InternalTodo from './pages/InternalTodo';
import AppWalkthrough from './pages/AppWalkthrough';
import PortfolioManagement from './pages/PortfolioManagement';
import AgentsDashboard from './pages/AgentsDashboard';
import LarryLogistics from './pages/LarryLogistics';
import JazzyAgent from './pages/JazzyAgent';
import ConsolidatedDB from './pages/ConsolidatedDB';
import ProductionKanban from './pages/ProductionKanban';
import Bookings from './pages/Bookings';
import Reports from './pages/Reports';
import VendorHub from './pages/VendorHub';
import ActivityLog from './pages/ActivityLog';
import Logos from './pages/Logos';
import SampleTracker from './pages/SampleTracker';
import Monica from './pages/Monica';
import ScrubsInventory from './pages/ScrubsInventory';
import ComplianceScorecard from './pages/ComplianceScorecard';
import ChargebackTracker from './pages/ChargebackTracker';
import DocumentVault from './pages/DocumentVault';
import PickTicket from './pages/PickTicket';
import Thesis from './pages/Thesis';
import './styles/globals.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/logistics/larry" element={<ProtectedRoute><LarryLogistics /></ProtectedRoute>} />
      <Route path="/shipping" element={<ProtectedRoute><Shipping /></ProtectedRoute>} />
      <Route path="/production" element={<ProtectedRoute><Production /></ProtectedRoute>} />
      <Route path="/containers" element={<ProtectedRoute><Containers /></ProtectedRoute>} />

      {/* Routing tab removed */}
      <Route path="/showroom" element={<ProtectedRoute><Showroom /></ProtectedRoute>} />
      <Route path="/showroom/samples" element={<ProtectedRoute><SampleTracker /></ProtectedRoute>} />
      <Route path="/showroom/jazzy" element={<ProtectedRoute><JazzyAgent /></ProtectedRoute>} />
      <Route path="/showroom/ats" element={<ProtectedRoute><ATS /></ProtectedRoute>} />
      <Route path="/showroom/scrubs" element={<ProtectedRoute><ScrubsInventory /></ProtectedRoute>} />
      <Route path="/ats" element={<Navigate to="/showroom/ats" />} />
      <Route path="/buyer/ross" element={<Navigate to="/buyer/ross-missy" />} />
      <Route path="/buyer/:buyer" element={<ProtectedRoute><BuyerPage /></ProtectedRoute>} />
      <Route path="/crm/john-anthony" element={<ProtectedRoute><JohnAnthony /></ProtectedRoute>} />
      <Route path="/crm/contact-log" element={<ProtectedRoute><ContactLog /></ProtectedRoute>} />
      <Route path="/crm/line-sheets" element={<ProtectedRoute><LineSheets /></ProtectedRoute>} />
      <Route path="/crm/new-customer-outreach" element={<ProtectedRoute><NewCustomerOutreach /></ProtectedRoute>} />
      <Route path="/finance/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
      <Route path="/model" element={<ProtectedRoute><Model /></ProtectedRoute>} />
      <Route path="/office/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
      <Route path="/office/hr" element={<ProtectedRoute><HRPage /></ProtectedRoute>} />
      <Route path="/office/:dept" element={<ProtectedRoute><OfficePage /></ProtectedRoute>} />
      <Route path="/internal/agents" element={<ProtectedRoute><AgentsDashboard /></ProtectedRoute>} />
      <Route path="/internal/portfolio" element={<ProtectedRoute><PortfolioManagement /></ProtectedRoute>} />
      <Route path="/internal/todo" element={<ProtectedRoute><InternalTodo /></ProtectedRoute>} />
      <Route path="/internal/walkthrough" element={<ProtectedRoute><AppWalkthrough /></ProtectedRoute>} />
      <Route path="/walkthrough" element={<ProtectedRoute><AppWalkthrough /></ProtectedRoute>} />
      <Route path="/logistics/consolidated" element={<ProtectedRoute><ConsolidatedDB /></ProtectedRoute>} />
      <Route path="/logistics/kanban" element={<ProtectedRoute><ProductionKanban /></ProtectedRoute>} />
      <Route path="/finance/vendor-hub" element={<ProtectedRoute><VendorHub /></ProtectedRoute>} />
      <Route path="/finance/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/internal/activity" element={<ProtectedRoute><ActivityLog /></ProtectedRoute>} />
      <Route path="/internal/monica" element={<ProtectedRoute><Monica /></ProtectedRoute>} />
      <Route path="/office/logos" element={<ProtectedRoute><Logos /></ProtectedRoute>} />
      <Route path="/logistics/compliance" element={<ProtectedRoute><ComplianceScorecard /></ProtectedRoute>} />
      <Route path="/logistics/chargebacks" element={<ProtectedRoute><ChargebackTracker /></ProtectedRoute>} />
      <Route path="/vault" element={<ProtectedRoute><DocumentVault /></ProtectedRoute>} />
      <Route path="/logistics/pick-ticket" element={<ProtectedRoute><PickTicket /></ProtectedRoute>} />
      <Route path="/finance/thesis" element={<ProtectedRoute><Thesis /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CRMProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </CRMProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
