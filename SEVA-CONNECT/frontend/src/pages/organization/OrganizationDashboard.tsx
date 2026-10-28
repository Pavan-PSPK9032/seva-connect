import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Plus,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { apiGet, apiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { Application, EventItem, NGO } from '../../types';
import Spinner from '../../components/Spinner';

export default function OrganizationDashboard() {
  const { user } = useAuth();
  const [ngos, setNgos] = useState<NGO[] | null>(null);
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ngoRes, eventRes, appRes] = await Promise.allSettled([
        apiGet<NGO>('/ngos/mine'),
        apiGet<EventItem>('/events/mine'),
        apiGet<Application>('/applications/received'),
      ]);
      if (ngoRes.status === 'fulfilled') setNgos(ngoRes.value.data ?? []);
      else setNgos([]);
      if (eventRes.status === 'fulfilled') setEvents(eventRes.value.data ?? []);
      else setEvents([]);
      if (appRes.status === 'fulfilled') setApplications(appRes.value.data ?? []);
      else setApplications([]);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load organization dashboard.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (ngos === null || events === null) {
    return (
      <div className="container-x py-20">
        <Spinner />
      </div>
    );
  }

  const pendingNgos = ngos.filter((n) => n.approvalStatus === 'pending' || (!n.approved && !n.verified));
  const approvedNgos = ngos.filter((n) => n.approvalStatus === 'approved' || n.approved || n.verified);
  const pendingEvents = events.filter((e) => e.approvalStatus === 'pending' || e.status === 'pending_approval');
  const approvedEvents = events.filter((e) => e.approvalStatus === 'approved' || e.status === 'upcoming' || e.status === 'ongoing');
  const pendingApps = applications?.filter((a) => a.status === 'pending') || [];

  return (
    <div className="container-x space-y-10 py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Organization Dashboard</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-navy-800 dark:text-white sm:text-3xl">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Manage your organization, events, and participation requests.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/my-ngo" className="btn-primary">
            <Plus className="h-4 w-4" /> Manage Organization & Events
          </Link>
          <Link to="/profile" className="btn-outline">
            Organization Profile
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Organizations" value={ngos.length} tone="primary" />
        <StatCard icon={<Clock3 className="h-5 w-5" />} label="Pending Approval" value={pendingNgos.length} tone="amber" />
        <StatCard icon={<CalendarDays className="h-5 w-5" />} label="Events" value={events.length} tone="navy" />
        <StatCard icon={<UsersRound className="h-5 w-5" />} label="Pending Requests" value={pendingApps.length} tone="emerald" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">My Organizations</h2>
              <p className="text-sm text-slate-500">Approval status</p>
            </div>
            <Link to="/my-ngo" className="btn-ghost text-sm">
              View all
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-navy-700/10 dark:divide-white/10">
            {ngos.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-500">No organizations submitted yet.</li>
            ) : (
              ngos.slice(0, 4).map((ngo) => (
                <li key={ngo._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-navy-800 dark:text-white">{ngo.organizationName}</p>
                    <p className="text-xs text-slate-500">{ngo.location}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      ngo.approvalStatus === 'approved' || ngo.approved
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : ngo.approvalStatus === 'rejected'
                          ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                    }`}
                  >
                    {ngo.approvalStatus || (ngo.approved ? 'approved' : 'pending')}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Recent Participation Requests</h2>
              <p className="text-sm text-slate-500">Need review</p>
            </div>
            <Link to="/my-ngo" className="btn-ghost text-sm">
              Manage
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-navy-700/10 dark:divide-white/10">
            {pendingApps.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-500">No pending requests.</li>
            ) : (
              pendingApps.slice(0, 4).map((app) => (
                <li key={app._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-navy-800 dark:text-white">{app.volunteer?.name || 'Volunteer'}</p>
                    <p className="text-xs text-slate-500">{app.event?.title || 'Event'}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    pending
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">My Events</h2>
            <p className="text-sm text-slate-500">Event approval status</p>
          </div>
          <Link to="/my-ngo" className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> Create Event
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.length === 0 ? (
            <div className="col-span-full py-8 text-center text-sm text-slate-500">
              No events created yet. Create one after your organization is approved.
            </div>
          ) : (
            events.slice(0, 6).map((event) => (
              <div key={event._id} className="rounded-xl border border-navy-700/10 p-4 dark:border-white/10">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-navy-800 dark:text-white">{event.title}</p>
                    <p className="text-xs text-slate-500">
                      {event.date?.slice(0, 10)} · {event.location}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      event.approvalStatus === 'approved' || event.status === 'upcoming'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : event.approvalStatus === 'rejected'
                          ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                    }`}
                  >
                    {event.approvalStatus || event.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
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
