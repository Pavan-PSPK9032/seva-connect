import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe2,
  GraduationCap,
  Loader2,
  MapPin,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { apiGet, apiGetOne, apiPatch, apiPost, apiDelete, apiErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Application, ApplicationStatus, EventItem } from '../types';
import Spinner from '../components/Spinner';
import EventCard from '../components/EventCard';

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  approved: 'bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  withdrawn: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  completed: 'bg-navy-100 text-navy-800 dark:bg-white/10 dark:text-white',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
};

function formatDate(value?: string | null, withYear = true) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export default function EventDetail() {
  const { id = '' } = useParams();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverNote, setCoverNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const isVolunteer = user?.role === 'volunteer';
  const canManage = user?.role === 'ngo' || user?.role === 'admin';
  const saved = Boolean(user?.savedEvents?.includes(id));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetOne<EventItem>(`/events/${id}`);
      setEvent(res.data ?? null);

      if (user?.role === 'volunteer') {
        const mine = await apiGet<Application>('/applications/mine');
        const found = (mine.data ?? []).find((a) => a.eventId === id) ?? null;
        setApplication(found);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'This opportunity could not be found.'));
    } finally {
      setLoading(false);
    }
  }, [id, user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = async () => {
    setBusy(true);
    try {
      const res = await apiPost<Application>('/applications', { eventId: id, coverNote: coverNote.trim() || undefined });
      setApplication(res.data ?? null);
      setShowForm(false);
      setCoverNote('');
      toast('success', 'Application sent', 'The NGO will review your application and you will be notified.');
      await load();
    } catch (err) {
      toast('error', 'Could not apply', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!application) return;
    setBusy(true);
    try {
      await apiPatch(`/applications/${application._id}/withdraw`, {});
      toast('success', 'Application withdrawn', 'Your seat has been released.');
      await load();
    } catch (err) {
      toast('error', 'Could not withdraw', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleSave = async () => {
    if (!isVolunteer) return;
    setSaving(true);
    try {
      if (saved) {
        await apiDelete(`/users/me/saved-events/${id}`);
        toast('info', 'Removed from saved', 'This opportunity is no longer in your saved list.');
      } else {
        await apiPost(`/users/me/saved-events/${id}`, {});
        toast('success', 'Opportunity saved', 'Find it under Saved opportunities in your dashboard.');
      }
      await refreshUser();
    } catch (err) {
      toast('error', 'Could not update saved list', apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container-x flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="container-x py-24">
        <div className="card mx-auto max-w-lg p-10 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-400" />
          <h1 className="mt-4 font-display text-xl font-semibold text-navy-800 dark:text-white">Opportunity not found</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Link to="/events" className="btn btn-primary mt-6">
            Browse opportunities
          </Link>
        </div>
      </div>
    );
  }

  const required = event.requiredVolunteers ?? 0;
  const registered = event.registeredVolunteers ?? 0;
  const spots = Math.max(0, required - registered);
  const full = required > 0 && spots === 0;
  const deadlinePassed = Boolean(event.applicationDeadline) && new Date(event.applicationDeadline as string).getTime() < Date.now();
  const closed = event.status !== 'upcoming' && event.status !== 'ongoing';
  const canApply = !full && !deadlinePassed && !closed;
  const capacityPct = required > 0 ? Math.min(100, Math.round((registered / required) * 100)) : 0;

  return (
    <div className="container-x py-12">
      <Link to="/events" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> All opportunities
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {event.status && <span className="chip bg-primary-100 text-primary-800 capitalize dark:bg-primary-500/15 dark:text-primary-300">{event.status}</span>}
            {event.online && (
              <span className="chip bg-navy-100 text-navy-700 dark:bg-white/10 dark:text-slate-200">
                <Globe2 className="h-3.5 w-3.5" /> Online
              </span>
            )}
            {event.causes?.map((cause) => (
              <span key={cause} className="chip bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                {cause}
              </span>
            ))}
          </div>

          <h1 className="mt-4 font-display text-3xl font-bold text-navy-800 dark:text-white sm:text-4xl">{event.title}</h1>

          {event.ngo && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <UsersRound className="h-4 w-4 text-primary-600" />
              <span className="font-medium text-navy-700 dark:text-slate-200">{event.ngo.organizationName}</span>
              {event.ngo.verified && (
                <span className="inline-flex items-center gap-1 text-primary-700 dark:text-primary-400">
                  <BadgeCheck className="h-4 w-4" /> Verified
                </span>
              )}
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Date" value={formatDate(event.date)} />
            <InfoRow icon={<Clock className="h-4 w-4" />} label="Time" value={event.time} />
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={event.location} />
            <InfoRow icon={<UsersRound className="h-4 w-4" />} label="Seats" value={`${registered} of ${required} filled`} />
          </div>

          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">About this opportunity</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{event.description}</p>
          </section>

          {event.requiredSkills && event.requiredSkills.length > 0 && (
            <section className="mt-8">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-navy-800 dark:text-white">
                <GraduationCap className="h-5 w-5 text-primary-600" /> Skills we are looking for
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {event.requiredSkills.map((skill) => (
                  <span key={skill} className="chip bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {event.eligibility && (
            <section className="mt-8">
              <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Eligibility</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{event.eligibility}</p>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Seats filled</span>
              <span className="font-display text-lg font-semibold text-navy-800 dark:text-white">
                {registered}/{required}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-primary-600 transition-all"
                style={{ width: `${capacityPct}%` }}
                role="progressbar"
                aria-valuenow={capacityPct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {full ? 'This opportunity is full.' : `${spots} seat${spots === 1 ? '' : 's'} remaining.`}
            </p>

            {event.applicationDeadline && (
              <p className={`mt-4 text-xs font-medium ${deadlinePassed ? 'text-red-600' : 'text-slate-500'}`}>
                Applications close {formatDate(event.applicationDeadline)}
              </p>
            )}

            <div className="mt-6">
              {canManage ? (
                <Link to="/my-ngo" className="btn btn-primary w-full">
                  Manage in NGO dashboard
                </Link>
              ) : !user ? (
                <Link to="/login" className="btn btn-primary w-full">
                  Log in to apply
                </Link>
              ) : !isVolunteer ? (
                <p className="text-sm text-slate-500">Only volunteer accounts can apply to opportunities.</p>
              ) : application && application.status !== 'withdrawn' && application.status !== 'rejected' ? (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-navy-700 dark:text-slate-200">Your application</span>
                    <span className={`chip capitalize ${STATUS_STYLE[application.status]}`}>{application.status}</span>
                  </div>
                  {application.hoursCredited > 0 && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-primary-700 dark:text-primary-400">
                      <CheckCircle2 className="h-4 w-4" /> {application.hoursCredited} verified hour(s)
                    </p>
                  )}
                  {(application.status === 'pending' || application.status === 'approved') && (
                    <button type="button" onClick={withdraw} disabled={busy} className="btn btn-outline mt-4 w-full">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Withdraw application
                    </button>
                  )}
                </div>
              ) : !canApply ? (
                <div>
                  <p className="text-sm text-slate-500">
                    {closed ? 'This opportunity is closed for applications.' : deadlinePassed ? 'The application deadline has passed.' : 'This opportunity is full.'}
                  </p>
                  {application?.status === 'rejected' && (
                    <p className="mt-2 text-xs text-slate-400">Your previous application was not accepted.</p>
                  )}
                </div>
              ) : showForm ? (
                <div className="space-y-3">
                  <label className="label" htmlFor="coverNote">
                    Why would you like to join? <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    id="coverNote"
                    className="input min-h-28"
                    maxLength={1000}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    placeholder="Share your relevant skills or availability…"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={apply} disabled={busy} className="btn btn-primary flex-1">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send application
                    </button>
                    <button type="button" onClick={() => setShowForm(false)} disabled={busy} className="btn btn-ghost">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary w-full">
                  Apply to volunteer
                </button>
              )}
            </div>

            {isVolunteer && (
              <button
                type="button"
                onClick={toggleSave}
                disabled={saving}
                className="btn-outline mt-3 w-full"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
                {saved ? 'Saved for later' : 'Save for later'}
              </button>
            )}
          </div>

          {event.ngo && (
            <div className="card p-6">
              <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">About the organisation</h2>
              <p className="mt-2 line-clamp-4 text-sm text-slate-600 dark:text-slate-300">{event.ngo.description}</p>
              {event.ngo.location && <p className="mt-2 text-xs text-slate-500">{event.ngo.location}</p>}
              <Link to={`/ngos/${event.ngo._id}`} className="mt-4 inline-flex text-sm font-semibold text-primary-700 hover:underline dark:text-primary-400">
                View organisation
              </Link>
            </div>
          )}
        </aside>
      </div>

      {event.related && event.related.length > 0 && (
        <section className="mt-14">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Keep serving</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-navy-800 dark:text-white">Related opportunities</h2>
            </div>
            <Link to="/events" className="btn-ghost hidden sm:inline-flex">Browse all</Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {event.related.map((related) => (
              <EventCard key={related._id} event={related} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-navy-700/10 p-3 dark:border-white/10">
      <span className="mt-0.5 text-primary-600 dark:text-primary-400">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm font-medium text-navy-800 dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}
