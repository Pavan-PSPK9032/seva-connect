import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Bell,
  Bookmark,
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
import { apiGet, apiPatch, apiErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type {
  Application,
  ApplicationStatus,
  ApplicationSummary,
  Certificate,
  EventItem,
  NotificationItem,
} from '../types';
import { GridSkeleton } from '../components/Skeleton';
import EventCard from '../components/EventCard';

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  approved: 'bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  withdrawn: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  completed: 'bg-navy-100 text-navy-800 dark:bg-white/10 dark:text-white',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
};

const FILTERS = ['all', 'pending', 'approved', 'completed', 'rejected', 'withdrawn', 'cancelled'] as const;
type Filter = (typeof FILTERS)[number];

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

function relativeTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

function startOfToday(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Application[]>([]);
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);
  const [certificates, setCertificates] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<EventItem[]>([]);
  const [recommended, setRecommended] = useState<EventItem[]>([]);
  const [recommendationNote, setRecommendationNote] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Application>('/applications/mine');
      setItems(res.data ?? []);
      const raw = res.summary;
      setSummary(
        raw && typeof raw === 'object' && 'total' in raw ? (raw as ApplicationSummary) : null
      );

      try {
        const certRes = await apiGet<Certificate>('/certificates/mine');
        const map: Record<string, string> = {};
        (certRes.data ?? []).forEach((cert) => {
          map[cert.applicationId] = cert.certificateId;
        });
        setCertificates(map);
      } catch {
        /* certificates are optional; never block the dashboard */
      }

      try {
        const notifyRes = await apiGet<NotificationItem>('/notifications', { limit: 5 });
        setNotifications(notifyRes.data ?? []);
        setUnreadCount(notifyRes.unreadCount ?? 0);
      } catch {
        /* notifications are optional; the dashboard still works */
      }

      try {
        const [savedRes, recommendedRes] = await Promise.all([
          apiGet<EventItem>('/users/me/saved-events'),
          apiGet<EventItem>('/events/recommended'),
        ]);
        setSaved(savedRes.data ?? []);
        setRecommended(recommendedRes.data ?? []);
        setRecommendationNote(recommendedRes.note ?? '');
      } catch {
        /* personalisation is optional; the core dashboard still works */
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((a) => a.status === filter)),
    [items, filter]
  );

  const upcoming = useMemo(() => {
    const today = startOfToday();
    return items
      .filter((application) => {
        if (application.status !== 'approved') return false;
        const raw = application.event?.date;
        if (!raw) return false;
        const time = new Date(raw).getTime();
        return Number.isFinite(time) && time >= today;
      })
      .sort((a, b) => {
        const aTime = a.event?.date ? new Date(a.event.date).getTime() : 0;
        const bTime = b.event?.date ? new Date(b.event.date).getTime() : 0;
        return aTime - bTime;
      })
      .slice(0, 4);
  }, [items]);

  const profileCompletion = useMemo(() => {
    const fields = [
      { label: 'Phone', done: Boolean(user?.phone) },
      { label: 'Location', done: Boolean(user?.location) },
      { label: 'Skills', done: Boolean(user?.skills && user.skills.length > 0) },
      { label: 'Interests', done: Boolean(user?.interests && user.interests.length > 0) },
      { label: 'Availability', done: Boolean(user?.availability) },
      { label: 'Profile photo', done: Boolean(user?.profileImage) },
    ];
    const done = fields.filter((field) => field.done).length;
    return {
      percent: Math.round((done / fields.length) * 100),
      missing: fields.filter((field) => !field.done).map((field) => field.label),
      done,
      total: fields.length,
    };
  }, [user]);

  const withdraw = async (application: Application) => {
    setBusyId(application._id);
    try {
      await apiPatch(`/applications/${application._id}/withdraw`, {});
      toast('success', 'Application withdrawn', 'Your seat has been released.');
      await load();
    } catch (err) {
      toast('error', 'Could not withdraw', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container-x py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Volunteer dashboard</p>
          <h1 className="mt-2 section-title">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
          <p className="section-sub">Track your applications, confirmed activities and verified volunteering hours.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/notifications" className="btn btn-outline relative">
            <Bell className="h-4 w-4" /> Notifications
            {unreadCount > 0 && (
              <span className="ml-1 rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <Link to="/events" className="btn btn-primary">
            <Sparkles className="h-4 w-4" /> Find opportunities
          </Link>
        </div>
      </div>

      {user && profileCompletion.percent < 100 && (
        <section
          className="card mt-6 border-l-4 border-l-amber-400 p-5"
          aria-label="Complete your volunteer profile"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-800 dark:text-white">
                <UserRoundCheck className="h-4 w-4 text-amber-500" /> Complete your profile
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Organisations use these details to match you with suitable activities. You have completed{' '}
                {profileCompletion.done} of {profileCompletion.total} fields.
              </p>
              {profileCompletion.missing.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {profileCompletion.missing.map((label) => (
                    <span key={label} className="chip bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                      {label}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <Link to="/profile" className="btn btn-outline text-sm">
              Update profile
            </Link>
          </div>
          <div className="mt-4">
            <div
              role="progressbar"
              aria-valuenow={profileCompletion.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile completion"
              className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all"
                style={{ width: `${profileCompletion.percent}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-slate-500">{profileCompletion.percent}% complete</p>
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<CalendarClock className="h-5 w-5" />} label="Applications" value={summary?.total ?? 0} />
        <StatCard icon={<CalendarCheck2 className="h-5 w-5" />} label="Confirmed" value={summary?.approved ?? 0} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Completed" value={summary?.completed ?? 0} />
        <StatCard icon={<Clock3 className="h-5 w-5" />} label="Verified hours" value={summary?.hours ?? 0} />
      </div>

      {(upcoming.length > 0 || notifications.length > 0) && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-heading" className="card p-5">
              <div className="flex items-center justify-between gap-2">
                <h2
                  id="upcoming-heading"
                  className="flex items-center gap-2 font-display text-lg font-bold text-navy-800 dark:text-white"
                >
                  <CalendarCheck2 className="h-5 w-5 text-primary-600" /> Upcoming activities
                </h2>
                <Link to="/events" className="text-xs font-semibold text-primary-600 hover:underline">
                  Browse more
                </Link>
              </div>
              <ul className="mt-4 space-y-3">
                {upcoming.map((application) => {
                  const event = application.event;
                  return (
                    <li key={application._id} className="rounded-xl border border-navy-700/10 p-3 dark:border-white/10">
                      <Link
                        to={`/events/${application.eventId}`}
                        className="font-medium text-navy-800 hover:text-primary-700 dark:text-slate-200 dark:hover:text-primary-400"
                      >
                        {event?.title ?? 'Activity'}
                      </Link>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        {event?.date && <span>{formatDate(event.date)}</span>}
                        {event?.time && <span>{event.time}</span>}
                        {event?.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {event.location}
                          </span>
                        )}
                      </p>
                      {event?.ngoName && <p className="mt-1 text-xs text-slate-400">{event.ngoName}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {notifications.length > 0 && (
            <section aria-labelledby="notifications-heading" className="card p-5">
              <div className="flex items-center justify-between gap-2">
                <h2
                  id="notifications-heading"
                  className="flex items-center gap-2 font-display text-lg font-bold text-navy-800 dark:text-white"
                >
                  <Bell className="h-5 w-5 text-primary-600" /> Recent notifications
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                      {unreadCount} new
                    </span>
                  )}
                </h2>
                <Link to="/notifications" className="text-xs font-semibold text-primary-600 hover:underline">
                  View all
                </Link>
              </div>
              <ul className="mt-4 space-y-3">
                {notifications.map((notification) => (
                  <li key={notification._id} className="rounded-xl border border-navy-700/10 p-3 dark:border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-navy-800 dark:text-slate-200">{notification.title}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(notification.createdAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{notification.message}</p>
                    {notification.link && (
                      <Link
                        to={notification.link}
                        className="mt-1.5 inline-block text-xs font-semibold text-primary-600 hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {saved.length > 0 && (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary-600">
                <Bookmark className="h-4 w-4" /> Saved opportunities
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-navy-800 dark:text-white">Your shortlist</h2>
            </div>
            <Link to="/events" className="btn-ghost text-sm">Find more</Link>
          </div>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saved.slice(0, 3).map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        </section>
      )}

      {recommended.length > 0 && (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary-600">
                <Sparkles className="h-4 w-4" /> Recommended for you
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-navy-800 dark:text-white">Matched to your profile</h2>
              {recommendationNote && <p className="mt-1 text-xs text-slate-500">{recommendationNote}</p>}
            </div>
            <Link to="/profile" className="btn-ghost text-sm">Update skills</Link>
          </div>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.slice(0, 3).map((event) => (
              <div key={event._id}>
                <EventCard event={event} />
                {event.matchReasons && event.matchReasons.length > 0 && (
                  <p className="mt-2 line-clamp-1 text-xs text-primary-700 dark:text-primary-300">
                    {event.matchReasons.join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10" aria-labelledby="history-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Participation</p>
            <h2 id="history-heading" className="mt-1 font-display text-xl font-bold text-navy-800 dark:text-white">
              Application history
            </h2>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              aria-pressed={filter === option}
              className={`chip capitalize transition ${
                filter === option
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
              }`}
            >
              {option}
              {option !== 'all' && summary ? ` (${summary[option as keyof ApplicationSummary] ?? 0})` : ''}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {loading ? (
            <GridSkeleton count={3} />
          ) : error ? (
            <div className="card p-8 text-center" role="alert">
              <XCircle className="mx-auto h-9 w-9 text-red-400" />
              <p className="mt-3 font-semibold text-navy-800 dark:text-white">{error}</p>
              <button type="button" onClick={load} className="btn btn-outline mt-4">
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="card p-10 text-center">
              <CalendarClock className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 font-semibold text-navy-800 dark:text-white">
                {filter === 'all' ? 'No applications yet' : `No ${filter} applications`}
              </p>
              <p className="mt-1 text-sm text-slate-500">Browse opportunities and apply to start contributing.</p>
              <Link to="/events" className="btn btn-primary mt-5">
                Browse opportunities
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {visible.map((application) => {
                const event = application.event;
                return (
                  <li key={application._id} className="card p-5">
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
                          <Link to={`/certificates/${certificates[application._id]}`} className="btn btn-primary text-sm">
                            <Award className="h-4 w-4" /> Certificate
                          </Link>
                        )}
                        <Link to={`/events/${application.eventId}`} className="btn btn-ghost text-sm">
                          View event
                        </Link>
                        {(application.status === 'pending' || application.status === 'approved') && (
                          <button
                            type="button"
                            onClick={() => withdraw(application)}
                            disabled={busyId === application._id}
                            className="btn btn-outline text-sm"
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
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
        {icon}
      </span>
      <div>
        <p className="font-display text-2xl font-bold text-navy-800 dark:text-white">{value}</p>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      </div>
    </div>
  );
}
