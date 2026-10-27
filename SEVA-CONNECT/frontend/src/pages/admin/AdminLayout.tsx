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
  Search,
  Settings2,
  ShieldCheck,
  UserCog,
  Users,
  X,
  BarChart3,
  FileText,
  Activity,
  ChevronRight,
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
  group: 'main' | 'management' | 'system';
}

const SECTIONS: AdminSection[] = [
  { id: 'overview', label: 'Dashboard', description: 'Platform overview & analytics', icon: Gauge, group: 'main' },
  { id: 'users', label: 'All Users', description: 'Manage all accounts', icon: Users, group: 'management' },
  { id: 'volunteers', label: 'Volunteers', description: 'Volunteer profiles', icon: UserCog, group: 'management' },
  { id: 'ngos', label: 'NGOs & Organizations', description: 'Verify & manage NGOs', icon: Building2, group: 'management' },
  { id: 'activities', label: 'Events & Activities', description: 'Create & moderate events', icon: CalendarDays, group: 'management' },
  { id: 'applications', label: 'Applications', description: 'Review applications', icon: ClipboardList, group: 'management' },
  { id: 'announcements', label: 'Announcements', description: 'Platform notices', icon: Bell, group: 'management' },
  { id: 'reports', label: 'Reports & Analytics', description: 'Detailed reports', icon: BarChart3, group: 'system' },
  { id: 'audit', label: 'Audit Logs', description: 'Security & activity logs', icon: ScrollText, group: 'system' },
  { id: 'settings', label: 'Settings', description: 'Platform configuration', icon: Settings2, group: 'system' },
];

function isSection(id: string | null): id is string {
  return Boolean(id && SECTIONS.some((section) => section.id === id));
}

export default function AdminLayout() {
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

  const groups = {
    main: SECTIONS.filter((s) => s.group === 'main'),
    management: SECTIONS.filter((s) => s.group === 'management'),
    system: SECTIONS.filter((s) => s.group === 'system'),
  };

  const nav = (
    <nav className="space-y-6" aria-label="Admin navigation">
      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Main
        </p>
        <div className="space-y-1">
          {groups.main.map((section) => {
            const Icon = section.icon;
            const selected = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => goTo(section.id)}
                aria-current={selected ? 'page' : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                  selected
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/25'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${selected ? '' : 'group-hover:scale-110 transition-transform'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{section.label}</p>
                </div>
                {selected && <ChevronRight className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Management
        </p>
        <div className="space-y-1">
          {groups.management.map((section) => {
            const Icon = section.icon;
            const selected = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => goTo(section.id)}
                aria-current={selected ? 'page' : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                  selected
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/25'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${selected ? '' : 'group-hover:scale-110 transition-transform'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{section.label}</p>
                </div>
                {selected && <ChevronRight className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          System
        </p>
        <div className="space-y-1">
          {groups.system.map((section) => {
            const Icon = section.icon;
            const selected = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => goTo(section.id)}
                aria-current={selected ? 'page' : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                  selected
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/25'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${selected ? '' : 'group-hover:scale-110 transition-transform'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{section.label}</p>
                </div>
                {selected && <ChevronRight className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/80 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <p className="text-xs font-medium text-slate-500">Admin Panel</p>
              <p className="text-sm font-semibold text-navy-800 dark:text-white">{current.label}</p>
            </div>
          </div>
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-80 bg-white p-4 shadow-xl dark:bg-navy-900 overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-navy-800 dark:text-white">Seva Connect</p>
                  <p className="text-xs text-slate-500">Admin Panel</p>
                </div>
              </div>
              <button onClick={() => setMenuOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-80 lg:flex-col">
          <div className="flex flex-grow flex-col overflow-y-auto border-r border-slate-200 bg-white dark:border-white/10 dark:bg-navy-900">
            {/* Logo */}
            <div className="flex h-16 items-center gap-3 px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-display text-lg font-bold text-navy-800 dark:text-white">Seva Connect</p>
                <p className="text-xs text-slate-500">Admin Panel</p>
              </div>
            </div>

            {/* Admin Profile */}
            <div className="mx-4 mb-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-white/5 dark:to-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-base font-bold text-white">
                  {initials(user?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy-800 dark:text-white">{user?.name}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Super Administrator</span>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 px-4 pb-4">
              {nav}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 p-4 dark:border-white/10">
              <Link
                to="/"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-navy-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Website
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:pl-80 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {/* Header */}
            <div className="mb-8 hidden lg:block">
              <div className="flex items-center justify-between">
                <div>
                  <nav className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                    <span>Admin</span>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-navy-800 dark:text-white">{current.label}</span>
                  </nav>
                  <h1 className="font-display text-3xl font-bold text-navy-800 dark:text-white">{current.label}</h1>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">{current.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      placeholder="Search admin panel..."
                      className="w-64 rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-navy-900"
                    />
                  </div>
                  <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
                    <Bell className="h-5 w-5" />
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                  </button>
                </div>
              </div>
            </div>

            {/* Section Content */}
            <div className="space-y-6">
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
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
