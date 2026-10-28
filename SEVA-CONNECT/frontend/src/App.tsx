import { Suspense, lazy } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Spinner from './components/Spinner';
import Home from './pages/Home';

const ExploreNGOs = lazy(() => import('./pages/ExploreNGOs'));
const NGOProfile = lazy(() => import('./pages/NGOProfile'));
const ExploreEvents = lazy(() => import('./pages/ExploreEvents'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const About = lazy(() => import('./pages/About'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Impact = lazy(() => import('./pages/Impact'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Contact = lazy(() => import('./pages/Contact'));
const Faq = lazy(() => import('./pages/Faq'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Profile = lazy(() => import('./pages/Profile'));
const MyNGO = lazy(() => import('./pages/MyNGO'));
const ChatbotPage = lazy(() => import('./pages/Chatbot'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Admin = lazy(() => import('./pages/Admin'));
const CertificateView = lazy(() => import('./pages/CertificateView'));
const VolunteerDashboard = lazy(() => import('./pages/volunteer/VolunteerDashboard'));
const OrganizationDashboard = lazy(() => import('./pages/organization/OrganizationDashboard'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/impact" element={<Impact />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/ngos" element={<ExploreNGOs />} />
          <Route path="/ngos/:id" element={<NGOProfile />} />
          <Route path="/events" element={<ExploreEvents />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/certificates/:code" element={<CertificateView />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/chatbot" element={<ChatbotPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<Navigate to="/login" replace />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/profile" element={<ProtectedRoute />}>
            <Route path="" element={<Profile />} />
          </Route>
          <Route path="/dashboard" element={<ProtectedRoute roles={['volunteer']} />}>
            <Route path="" element={<Dashboard />} />
          </Route>
          <Route path="/volunteer/dashboard" element={<ProtectedRoute roles={['volunteer']} />}>
            <Route path="" element={<VolunteerDashboard />} />
          </Route>
          <Route path="/notifications" element={<ProtectedRoute />}>
            <Route path="" element={<Notifications />} />
          </Route>
          <Route path="/my-ngo" element={<ProtectedRoute roles={['ngo', 'admin']} />}>
            <Route path="" element={<MyNGO />} />
          </Route>
          <Route path="/organization/dashboard" element={<ProtectedRoute roles={['ngo']} />}>
            <Route path="" element={<OrganizationDashboard />} />
          </Route>
          <Route path="/admin" element={<ProtectedRoute roles={['admin']} />}>
            <Route path="" element={<Admin />} />
          </Route>
          <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']} />}>
            <Route path="" element={<AdminDashboard />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}