import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  Gauge,
  Menu,
  ScrollText,
  Settings2,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { initials } from './utils';
import OverviewSection from './OverviewSection';
import UsersSection from './UsersSection';
import VolunteersSection from './VolunteersSection';
import NGOsSection from './NGOsSection';
import ActivitiesSection from './ActivitiesSection';
import ApplicationsSection from './ApplicationsSection';
import AnnouncementsSection from './AnnouncementsSection';
import ReportsSection from './ReportsSection';
import AuditSection from './AuditSection';
import SettingsSection from './SettingsSection';

interface AdminSection {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const SECTIONS: AdminSection[] = [
  { id: 'overview', label: 'Overview', description: 'Platform health at a glance', icon: Gauge },
  { id: 'users', label: 'Users', description: 'Accounts, roles and access', icon: Users },
  { id: 'volunteers', label: 'Volunteers', description: 'Profiles and participation', icon: UserCog },
  { id: 'ngos', label: 'Organisations', description: 'Verification and oversight', icon: Building2 },
  { id: 'activities', label: 'Activities', description: 'Publish and moderate events', icon: CalendarDays },
  { id: 'applications', label: 'Applications', description: 'Review participation requests', icon: ClipboardList },
  { id: 'announcements', label: 'Announcements', description: 'Platform-wide notices', icon: Bell },
  { id: 'reports', label: 'Reports', description: 'Range analytics and exports', icon: ScrollText },
  { id: 'audit', label: 'Audit log', description: 'Privileged action history', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', description: 'Profile, security, platform', icon: Settings2 },
];

function isSection(id: string | null): id is string {
  return Boolean(id && SECTIONS.some((section) => section.id === id));
}

export default function Admin() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const active = isSection(requested) ? requested : 'overview';
  const current = SECTIONS.find((section) => section.id === active) ?? SECTIONS[0];
  const [menuOpen, setMenuOpen] = useState(false);

  const goTo = (id: string) => {
    setParams((next) => {
      next.set('section', id);
      return next;
    });
    setMenuOpen(false);
  };

  const nav = (
    <nav className="space-y-1" aria-label="Admin sections">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const selected = section.id === active;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => goTo(section.id)}
            aria-current={selected ? 'page' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
              selected
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="container-x py-6 lg:py-10">
      <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">Administration</p>
          <h1 className="font-display text-xl font-bold text-navy-800 dark:text-white">{current.label}</h1>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className="btn btn-outline text-sm"
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-menu"
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          Menu
        </button>
      </div>

      {menuOpen && (
        <div
          id="admin-mobile-menu"
          className="card mb-6 p-3 lg:hidden"
        >
          {nav}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white">
                  {initials(user?.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy-800 dark:text-white">{user?.name}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                Privileged actions are audited
              </p>
            </div>

            <div className="card p-2">{nav}</div>

            <Link
              to="/"
              className="flex items-center gap-2 px-3 text-xs font-medium text-slate-500 hover:text-primary-600"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to the public site
            </Link>
          </div>
        </aside>

        <section className="min-w-0" aria-label={current.label}>
          {active === 'overview' && <OverviewSection onNavigate={goTo} />}
          {active === 'users' && <UsersSection />}
          {active === 'volunteers' && <VolunteersSection />}
          {active === 'ngos' && <NGOsSection />}
          {active === 'activities' && <ActivitiesSection />}
          {active === 'applications' && <ApplicationsSection />}
          {active === 'announcements' && <AnnouncementsSection />}
          {active === 'reports' && <ReportsSection />}
          {active === 'audit' && <AuditSection />}
          {active === 'settings' && <SettingsSection />}
        </section>
      </div>
    </div>
  );
}
