import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  ShieldCheck,
  Users,
  Activity,
} from 'lucide-react';
import { apiGet, apiErrorMessage } from '../../services/api';
import type { AdminOverview } from '../../types';
import Spinner from '../../components/Spinner';

export default function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<AdminOverview>('/admin/overview');
      const data = res.data as unknown;
      if (Array.isArray(data)) {
        setOverview(null);
      } else {
        setOverview((data as AdminOverview) ?? null);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load admin overview.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!overview) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        {error ? (
          <div className="text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button type="button" onClick={() => void load()} className="btn-outline mt-4">
              Try again
            </button>
          </div>
        ) : (
          <Spinner />
        )}
      </div>
    );
  }

  const users = overview.users || ({} as AdminOverview['users']);
  const ngos = overview.ngos || ({} as AdminOverview['ngos']);
  const events = overview.events || ({} as AdminOverview['events']);
  const applications = overview.applications || ({} as AdminOverview['applications']);

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Admin Dashboard</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy-800 dark:text-white sm:text-3xl">
          Platform Overview
        </h1>
        <p className="mt-1 text-sm text-slate-500">Monitor users, organizations, events, and activities.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Users" value={users.total || 0} tone="primary" />
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Organizations" value={ngos.total || 0} tone="navy" />
        <StatCard icon={<CalendarDays className="h-5 w-5" />} label="Events" value={events.total || 0} tone="emerald" />
        <StatCard icon={<ClipboardList className="h-5 w-5" />} label="Applications" value={applications.total || 0} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card col-span-2 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Quick Actions</h2>
              <p className="text-sm text-slate-500">Review pending approvals</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link to="/admin?tab=ngos" className="flex items-center gap-3 rounded-xl border border-navy-700/10 p-4 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-navy-800 dark:text-white">Review Organizations</p>
                <p className="text-xs text-slate-500">Approve or reject submissions</p>
              </div>
            </Link>
            <Link to="/admin?tab=events" className="flex items-center gap-3 rounded-xl border border-navy-700/10 p-4 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-navy-800 dark:text-white">Review Events</p>
                <p className="text-xs text-slate-500">Moderate event submissions</p>
              </div>
            </Link>
            <Link to="/admin?tab=users" className="flex items-center gap-3 rounded-xl border border-navy-700/10 p-4 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-100 text-navy-700 dark:bg-white/10 dark:text-white">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-navy-800 dark:text-white">Manage Users</p>
                <p className="text-xs text-slate-500">View and manage accounts</p>
              </div>
            </Link>
            <Link to="/admin?tab=audit" className="flex items-center gap-3 rounded-xl border border-navy-700/10 p-4 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-navy-800 dark:text-white">Audit Logs</p>
                <p className="text-xs text-slate-500">Track admin actions</p>
              </div>
            </Link>
          </div>
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Platform Stats</h2>
              <p className="text-sm text-slate-500">Database-backed metrics</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-primary-600" />
          </div>
          <ul className="mt-4 space-y-3">
            <li className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-300">Verified Users</span>
              <span className="font-semibold text-navy-800 dark:text-white">{users.verified || 0}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-300">Volunteers</span>
              <span className="font-semibold text-navy-800 dark:text-white">{users.volunteers || 0}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-300">NGO Accounts</span>
              <span className="font-semibold text-navy-800 dark:text-white">{users.ngoUsers || 0}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-300">Suspended Users</span>
              <span className="font-semibold text-navy-800 dark:text-white">{users.suspended || 0}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'amber' | 'primary' | 'navy' | 'emerald';
}) {
  const tones: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    primary: 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
    navy: 'bg-navy-100 text-navy-700 dark:bg-white/10 dark:text-white',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  };
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone]}`}>{icon}</span>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="font-display text-2xl font-bold text-navy-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
