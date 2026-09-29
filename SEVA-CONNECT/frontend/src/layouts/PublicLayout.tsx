import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { ChatbotWidget } from '../components/Chatbot';

export default function PublicLayout() {
  const { pathname } = useLocation();
  // The dedicated page hosts the same panel, so the launcher would be a duplicate.
  const hideWidget = pathname.startsWith('/chatbot');

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {!hideWidget && <ChatbotWidget />}
    </div>
  );
}
