import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { ChatbotWidget } from '../components/Chatbot';

const TITLES: [RegExp, string][] = [
  [/^\/$/, 'Seva Connect — Volunteer with verified NGOs'],
  [/^\/how-it-works/, 'How it works | Seva Connect'],
  [/^\/impact/, 'Impact analytics | Seva Connect'],
  [/^\/leaderboard/, 'Volunteer leaderboard | Seva Connect'],
  [/^\/privacy/, 'Privacy policy | Seva Connect'],
  [/^\/terms/, 'Terms of use | Seva Connect'],
  [/^\/events\/[^/]+/, 'Opportunity details | Seva Connect'],
  [/^\/events/, 'Volunteering opportunities | Seva Connect'],
  [/^\/ngos\/[^/]+/, 'Organisation profile | Seva Connect'],
  [/^\/ngos/, 'Explore NGOs | Seva Connect'],
  [/^\/dashboard/, 'Volunteer dashboard | Seva Connect'],
  [/^\/certificates\//, 'Volunteer certificate | Seva Connect'],
  [/^\/notifications/, 'Notifications | Seva Connect'],
  [/^\/my-ngo/, 'NGO dashboard | Seva Connect'],
  [/^\/admin/, 'Admin | Seva Connect'],
  [/^\/profile/, 'Your profile | Seva Connect'],
  [/^\/about/, 'About us | Seva Connect'],
  [/^\/contact/, 'Contact | Seva Connect'],
  [/^\/faq/, 'FAQ | Seva Connect'],
  [/^\/chatbot/, 'Seva AI assistant | Seva Connect'],
  [/^\/login/, 'Log in | Seva Connect'],
  [/^\/register/, 'Create an account | Seva Connect'],
  [/^\/verify-email/, 'Seva Connect'],
  [/^\/forgot-password/, 'Reset password | Seva Connect'],
  [/^\/reset-password/, 'Choose a new password | Seva Connect'],
];

export default function PublicLayout() {
  const { pathname } = useLocation();
  // The dedicated page hosts the same panel, so the launcher would be a duplicate.
  const hideWidget = pathname.startsWith('/chatbot');

  useEffect(() => {
    const match = TITLES.find(([pattern]) => pattern.test(pathname));
    document.title = match ? match[1] : 'Seva Connect';
  }, [pathname]);

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
