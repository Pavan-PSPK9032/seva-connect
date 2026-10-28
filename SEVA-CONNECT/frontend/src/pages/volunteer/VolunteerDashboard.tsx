import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Sparkles,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import { apiGet, apiPatch, apiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { Application, ApplicationStatus, ApplicationSummary, Certificate, EventItem } from '../../types';
import { GridSkeleton } from '../../components/Skeleton';
import EventCard from '../../components/EventCard';

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  approved: 'bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  withdrawn: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  completed: 'bg-navy-100 text-navy-800 dark:bg-white/10 dark:text-white',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
};

type Filter = 'all' | ApplicationStatus;

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function VolunteerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [applications, setApplications] = useState<Application[] | null>(null);
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);
  const [certificates, setCertificates] = useState<Record<string, string>>({});
  const [recommended, setRecommended] = useState<EventItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [appRes, certRes, recRes] = await Promise.allSettled([
        apiGet<Application>('/applications/mine'),
        apiGet<Certificate>('/certificates/mine'),
        apiGet<EventItem>('/events/recommended'),
      ]);

      if (appRes.status === 'fulfilled') {
        setApplications(appRes.value.data ?? []);
        const summaryData = appRes.value.summary as ApplicationSummary | Record<string, number> | undefined;
        if (summaryData && typeof summaryData === 'object' && 'total' in summaryData) {
          setSummary(summaryData as ApplicationSummary);
        } else {
          setSummary(null);
        }
      } else {
        setApplications([]);
      }

      if (certRes.status === 'fulfilled') {
        const map: Record<string, string> = {};
        (certRes.value.data ?? []).forEach((cert: any) => {
          const appId = cert.applicationId || cert.application?._id;
          const code = cert.code || cert.certificateId;
          if (appId && code) map[String(appId)] = code;
        });
        setCertificates(map);
      }

      if (recRes.status === 'fulfilled') {
        setRecommended(recRes.value.data ?? []);
      } else {
        setRecommended([]);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your dashboard.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const withdraw = async (application: Application) => {
    setBusyId(application._id);
    try {
      await apiPatch(`/applications/${application._id}/withdraw`, {});
      toast('success', 'Application withdrawn', 'Your seat has been released if it was confirmed.');
      await load();
    } catch (err) {
      toast('error', 'Could not withdraw', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'Volunteer';
  const visible =
    applications?.filter((application) => (filter === 'all' ? true : application.status === filter)) || [];

  if (applications === null) {
    return (
      <div className="container-x py-14">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-slate-200 dark:bg-white/10" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-white/10" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-slate-200 dark:bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-x space-y-10 py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Volunteer Dashboard</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-navy-800 dark:text-white sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Track applications, hours and opportunities.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/events" className="btn-primary">
            <Sparkles className="h-4 w-4" /> Find opportunities
          </Link>
          <Link to="/profile" className="btn-outline">
            Manage profile
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Clock3 className="h-5 w-5" />} label="Pending" value={summary?.pending ?? 0} tone="amber" />
        <StatCard icon={<UserRoundCheck className="h-5 w-5" />} label="Approved" value={summary?.approved ?? 0} tone="primary" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Completed" value={summary?.completed ?? 0} tone="navy" />
        <StatCard icon={<Award className="h-5 w-5" />} label="Verified hours" value={summary?.hours ?? 0} tone="emerald" />
      </div>

      <section className="card p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-navy-700/10 p-5 dark:border-white/10">
          <div>
            <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">My applications</h2>
            <p className="text-sm text-slate-500">Requests you’ve sent to organisations</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {(['all', 'pending', 'approved', 'rejected', 'completed', 'withdrawn'] as Filter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1.5 capitalize ${filter === key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <CalendarClock className="mx-auto mb-3 h-8 w-8" />
            <p className="font-medium text-navy-700 dark:text-slate-200">No applications yet</p>
            <p className="mt-1 text-sm">Browse approved opportunities and apply to get started.</p>
            <Link to="/events" className="btn-primary mx-auto mt-4">
              Browse events
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-navy-700/10 dark:divide-white/10">
            {visible.map((application) => {
              const event = application.event;
              return (
                <li key={application._id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        to={`/events/${application.eventId}`}
                        className="font-display text-lg font-semibold text-navy-800 hover:text-primary-700 dark:text-white dark:hover:text-primary-400"
                      >
                        {event?.title ?? 'Opportunity'}
                      </Link>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                        {event?.date && <span>{formatDate(event.date)}</span>}
                        {event?.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {event.location}
                          </span>
                        )}
                        {event?.ngoName && <span>{event.ngoName}</span>}
                      </p>
                    </div>
                    <span className={`chip capitalize ${STATUS_STYLE[application.status]}`}>{application.status}</span>
                  </div>

                  {application.coverNote && (
                    <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      {application.coverNote}
                    </p>
                  )}
                  {application.status === 'rejected' && application.decisionNote && (
                    <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                      Reason: {application.decisionNote}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Applied {formatDate(application.createdAt)}
                      {application.status === 'completed' && application.hoursCredited > 0
                        ? ` · ${application.hoursCredited} verified hour(s)`
                        : ''}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {certificates[application._id] && (
                        <Link to={`/certificates/${certificates[application._id]}`} className="btn-primary text-sm">
                          <Award className="h-4 w-4" /> Certificate
                        </Link>
                      )}
                      <Link to={`/events/${application.eventId}`} className="btn-ghost text-sm">
                        View event
                      </Link>
                      {(application.status === 'pending' || application.status === 'approved') && (
                        <button
                          type="button"
                          onClick={() => withdraw(application)}
                          disabled={busyId === application._id}
                          className="btn-outline text-sm"
                        >
                          {busyId === application._id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Recommended</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-navy-800 dark:text-white">Opportunities for you</h2>
            <p className="text-sm text-slate-500">Matched to your skills and interests</p>
          </div>
          <Link to="/events" className="btn-ghost hidden sm:inline-flex">
            Browse all
          </Link>
        </div>
        {recommended && recommended.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center text-slate-500">
            <Sparkles className="mx-auto mb-3 h-8 w-8" />
            <p className="font-medium text-navy-700 dark:text-slate-200">No recommendations yet</p>
            <p className="mt-1 text-sm">Update your profile with skills and interests to get matches.</p>
            <Link to="/profile" className="btn-outline mx-auto mt-4">
              Edit profile
            </Link>
          </div>
        )}
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
