import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  CalendarPlus,
  MapPin,
  Search,
  UserCog,
  UserRoundCheck,
} from 'lucide-react';
import { apiErrorMessage, apiGet, apiGetOne, apiPost } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type {
  AdminVolunteer,
  AdminVolunteerDetail,
  EventItem,
  Pagination,
} from '../../types';
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Pager,
  StatusBadge,
  TableSkeleton,
  useConfirm,
  type ConfirmOptions,
} from './ui';
import { formatDate, formatDateTime, initials, ngoNameFromEvent } from './utils';

interface Filters {
  q: string;
  skill: string;
  availability: string;
  status: string;
  verified: string;
  sort: string;
}

const EMPTY_FILTERS: Filters = {
  q: '',
  skill: '',
  availability: '',
  status: '',
  verified: '',
  sort: 'newest',
};

export default function VolunteersSection() {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();

  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminVolunteer[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<AdminVolunteer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<AdminVolunteer>('/admin/volunteers', {
        page,
        limit: 20,
        q: filters.q.trim() || undefined,
        skill: filters.skill.trim() || undefined,
        availability: filters.availability.trim() || undefined,
        status: filters.status || undefined,
        verified: filters.verified || undefined,
        sort: filters.sort,
      });
      setItems(res.data ?? []);
      setPagination(res.pagination ?? null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load volunteers.'));
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = () => {
    setPage(1);
    setFilters({ ...draft });
  };

  const reset = () => {
    setDraft(EMPTY_FILTERS);
    setPage(1);
    setFilters({ ...EMPTY_FILTERS });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Volunteer management"
        title="Volunteers"
        description="Review profiles, participation records and assign volunteers to upcoming or ongoing activities."
      />

      <div className="mt-5">
        <FilterBar onReset={reset}>
          <div className="min-w-[11rem] flex-1">
            <label htmlFor="volunteer-search" className="label">Search</label>
            <div className="flex items-center gap-2 rounded-xl border border-navy-700/15 bg-white px-3 dark:border-white/15 dark:bg-navy-900">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                id="volunteer-search"
                value={draft.q}
                onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    apply();
                  }
                }}
                placeholder="Name, email, location, skill"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="volunteer-skill" className="label">Skill</label>
            <input
              id="volunteer-skill"
              value={draft.skill}
              onChange={(event) => setDraft({ ...draft, skill: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && apply()}
              placeholder="e.g. Teaching"
              className="input w-36"
            />
          </div>
          <div>
            <label htmlFor="volunteer-availability" className="label">Availability</label>
            <input
              id="volunteer-availability"
              value={draft.availability}
              onChange={(event) => setDraft({ ...draft, availability: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && apply()}
              placeholder="e.g. weekends"
              className="input w-36"
            />
          </div>
          <div>
            <label htmlFor="volunteer-status" className="label">Status</label>
            <select
              id="volunteer-status"
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value })}
              className="input w-auto"
            >
              <option value="">Any</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div>
            <label htmlFor="volunteer-verified" className="label">Email</label>
            <select
              id="volunteer-verified"
              value={draft.verified}
              onChange={(event) => setDraft({ ...draft, verified: event.target.value })}
              className="input w-auto"
            >
              <option value="">Any</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
          <div>
            <label htmlFor="volunteer-sort" className="label">Sort</label>
            <select
              id="volunteer-sort"
              value={draft.sort}
              onChange={(event) => setDraft({ ...draft, sort: event.target.value })}
              className="input w-auto"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
              <option value="login">Recent login</option>
            </select>
          </div>
          <button type="button" onClick={apply} className="btn btn-primary text-sm">
            Apply filters
          </button>
        </FilterBar>
      </div>

      <div className="card mt-4 overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<UserCog className="h-6 w-6" />}
            title="No volunteers match these filters"
            description="Adjust the filters to see more volunteer profiles."
            action={
              <button type="button" onClick={reset} className="btn btn-outline text-sm">
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-700/10 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
                  <th scope="col" className="px-5 py-3 font-semibold">Volunteer</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Skills</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Participation</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/10 dark:divide-white/10">
                {items.map((volunteer) => (
                  <tr key={volunteer._id} className="align-middle hover:bg-slate-50/70 dark:hover:bg-white/5">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                          {initials(volunteer.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-navy-800 dark:text-slate-200">{volunteer.name}</p>
                          <p className="truncate text-xs text-slate-500">{volunteer.email}</p>
                          {volunteer.location && (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                              <MapPin className="h-3 w-3" /> {volunteer.location}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[14rem] px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(volunteer.skills ?? []).slice(0, 3).map((skill) => (
                          <span key={skill} className="chip bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                            {skill}
                          </span>
                        ))}
                        {(volunteer.skills?.length ?? 0) > 3 && (
                          <span className="chip bg-slate-100 text-slate-500 dark:bg-white/10">
                            +{(volunteer.skills?.length ?? 0) - 3}
                          </span>
                        )}
                        {(volunteer.skills?.length ?? 0) === 0 && <span className="text-xs text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      <p>{volunteer.stats.applications} application{volunteer.stats.applications === 1 ? '' : 's'}</p>
                      <p className="mt-0.5 text-slate-500">
                        {volunteer.stats.completed} completed · {volunteer.stats.hours}h
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={volunteer.accountStatus || 'active'} />
                        <Badge tone={volunteer.emailVerified === false ? 'amber' : 'emerald'}>
                          {volunteer.emailVerified === false ? 'unverified' : 'verified'}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailId(volunteer._id)}
                          className="btn btn-ghost text-xs"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignTarget(volunteer)}
                          disabled={volunteer.accountStatus === 'suspended' || volunteer.emailVerified === false}
                          title={
                            volunteer.emailVerified === false
                              ? 'Email must be verified before assignment'
                              : volunteer.accountStatus === 'suspended'
                                ? 'Suspended volunteers cannot be assigned'
                                : 'Assign to an activity'
                          }
                          className="btn btn-outline text-xs"
                        >
                          <CalendarPlus className="h-3.5 w-3.5" /> Assign
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pager pagination={pagination} page={page} onPage={setPage} />

      <VolunteerDetailModal
        volunteerId={detailId}
        onClose={() => setDetailId(null)}
        onAssign={(volunteer) => {
          setDetailId(null);
          setAssignTarget(volunteer);
        }}
      />

      <AssignVolunteerModal
        volunteer={assignTarget}
        onClose={() => setAssignTarget(null)}
        onAssigned={() => {
          setAssignTarget(null);
          void load();
          toast('success', 'Volunteer assigned', 'The volunteer and organisation have been notified.');
        }}
        onConfirm={confirm}
      />

      {dialog}
    </div>
  );
}

/* ---------------------------- Volunteer detail ----------------------------- */

function VolunteerDetailModal({
  volunteerId,
  onClose,
  onAssign,
}: {
  volunteerId: string | null;
  onClose: () => void;
  onAssign: (volunteer: AdminVolunteer) => void;
}) {
  const [detail, setDetail] = useState<AdminVolunteerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!volunteerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetOne<AdminVolunteerDetail>(`/admin/volunteers/${volunteerId}`);
      if (!res.data) throw new Error(res.message || 'Volunteer not found.');
      setDetail(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this volunteer.'));
    } finally {
      setLoading(false);
    }
  }, [volunteerId]);

  useEffect(() => {
    if (volunteerId) void load();
    else setDetail(null);
  }, [volunteerId, load]);

  const volunteer = detail?.volunteer;

  return (
    <Modal
      open={Boolean(volunteerId)}
      title="Volunteer profile"
      description="Participation history, skills and issued certificates."
      onClose={onClose}
      size="lg"
      footer={
        volunteer ? (
          <>
            <button type="button" onClick={onClose} className="btn btn-outline text-sm">
              Close
            </button>
            <button
              type="button"
              onClick={() =>
                onAssign({
                  ...volunteer,
                  stats: {
                    applications: detail?.stats.applications ?? 0,
                    completed: detail?.stats.completed ?? 0,
                    hours: detail?.stats.hours ?? 0,
                  },
                })
              }
              disabled={volunteer.accountStatus === 'suspended' || volunteer.emailVerified === false}
              className="btn btn-primary text-sm"
            >
              <CalendarPlus className="h-4 w-4" /> Assign to activity
            </button>
          </>
        ) : null
      }
    >
      {loading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : detail && volunteer ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-lg font-bold text-white">
              {initials(volunteer.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold text-navy-800 dark:text-white">{volunteer.name}</p>
              <p className="truncate text-sm text-slate-500">{volunteer.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={volunteer.accountStatus || 'active'} />
                <Badge tone={volunteer.emailVerified === false ? 'amber' : 'emerald'}>
                  {volunteer.emailVerified === false ? 'unverified' : 'verified'}
                </Badge>
                {volunteer.location && <Badge tone="slate">{volunteer.location}</Badge>}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Applications" value={detail.stats.applications} />
            <Metric label="Pending" value={detail.stats.pending ?? 0} />
            <Metric label="Completed" value={detail.stats.completed} />
            <Metric label="Verified hours" value={detail.stats.hours} />
          </div>

          <dl className="grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-white/5 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Availability</dt>
              <dd className="mt-0.5 text-navy-800 dark:text-slate-200">{volunteer.availability || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Phone</dt>
              <dd className="mt-0.5 text-navy-800 dark:text-slate-200">{volunteer.phone || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Interests</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {(volunteer.interests ?? []).length > 0
                  ? volunteer.interests?.map((interest) => (
                      <span key={interest} className="chip bg-white text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {interest}
                      </span>
                    ))
                  : <span className="text-slate-400">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Skills</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {(volunteer.skills ?? []).length > 0
                  ? volunteer.skills?.map((skill) => (
                      <span key={skill} className="chip bg-white text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {skill}
                      </span>
                    ))
                  : <span className="text-slate-400">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Registered</dt>
              <dd className="mt-0.5 text-navy-800 dark:text-slate-200">{formatDateTime(volunteer.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Last login</dt>
              <dd className="mt-0.5 text-navy-800 dark:text-slate-200">
                {volunteer.lastLoginAt ? formatDateTime(volunteer.lastLoginAt) : 'Never'}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-800 dark:text-white">
              <UserRoundCheck className="h-4 w-4 text-primary-600" /> Participation history ({detail.applications.length})
            </h3>
            {detail.applications.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No applications yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-navy-700/10 rounded-xl border border-navy-700/10 dark:divide-white/10 dark:border-white/10">
                {detail.applications.map((application) => (
                  <li key={application._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-800 dark:text-slate-200">
                        {application.event?.title || 'Activity'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {application.event?.date ? `${formatDate(application.event.date)} · ` : ''}
                        {application.event?.location || 'Location not set'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {application.hoursCredited > 0 && (
                        <span className="text-xs text-slate-500">{application.hoursCredited}h</span>
                      )}
                      <StatusBadge status={application.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {detail.certificates.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-800 dark:text-white">
                <Award className="h-4 w-4 text-primary-600" /> Certificates ({detail.certificates.length})
              </h3>
              <ul className="mt-3 space-y-2">
                {detail.certificates.map((certificate) => (
                  <li
                    key={certificate._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-700/10 px-4 py-2.5 dark:border-white/10"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy-800 dark:text-slate-200">{certificate.eventTitle}</p>
                      <p className="text-xs text-slate-500">
                        Issued {formatDate(certificate.issuedAt)} · {certificate.hours}h
                      </p>
                    </div>
                    <a
                      href={`/certificates/${certificate.certificateId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline text-xs"
                    >
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

/* ------------------------------ Assign dialog ------------------------------ */

function AssignVolunteerModal({
  volunteer,
  onClose,
  onAssigned,
  onConfirm,
}: {
  volunteer: AdminVolunteer | null;
  onClose: () => void;
  onAssigned: () => void;
  onConfirm: (options: ConfirmOptions) => Promise<boolean>;
}) {
  const { toast } = useToast();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventId, setEventId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!volunteer) return;
    let active = true;
    setLoading(true);
    setError(null);
    setEventId('');
    Promise.all([
      apiGet<EventItem>('/admin/events', { status: 'upcoming', limit: 60, sort: 'oldest' }),
      apiGet<EventItem>('/admin/events', { status: 'ongoing', limit: 60, sort: 'oldest' }),
    ])
      .then(([upcoming, ongoing]) => {
        if (!active) return;
        const seen = new Set<string>();
        const merged = [...(ongoing.data ?? []), ...(upcoming.data ?? [])].filter((event) => {
          if (seen.has(event._id)) return false;
          seen.add(event._id);
          return true;
        });
        setEvents(merged);
      })
      .catch((err) => {
        if (active) setError(apiErrorMessage(err, 'Could not load activities.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [volunteer]);

  const submit = async () => {
    if (!volunteer || !eventId) {
      setError('Choose an activity to assign this volunteer to.');
      return;
    }
    const selected = events.find((event) => event._id === eventId);
    const ok = await onConfirm({
      title: 'Assign volunteer?',
      message: `${volunteer.name} will be approved for "${selected?.title ?? 'the activity'}" and both the volunteer and organisation will be notified.`,
      confirmLabel: 'Assign',
      tone: 'primary',
    });
    if (!ok) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/admin/volunteers/${volunteer._id}/assign`, { eventId });
      onAssigned();
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not assign this volunteer.');
      setError(message);
      toast('error', 'Assignment failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(volunteer)}
      title="Assign to an activity"
      description={volunteer ? `${volunteer.name} · ${volunteer.email}` : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-outline text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !eventId}
            className="btn btn-primary text-sm"
          >
            {submitting ? 'Assigning…' : 'Assign volunteer'}
          </button>
        </>
      }
    >
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={3} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus className="h-6 w-6" />}
          title="No open activities"
          description="Only upcoming or ongoing activities can receive volunteer assignments."
        />
      ) : (
        <Field
          label="Activity"
          htmlFor="assign-event"
          hint="Seats are reserved atomically; a full activity cannot be oversubscribed."
        >
          <select
            id="assign-event"
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            className="input"
          >
            <option value="">Choose an activity…</option>
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.title} · {formatDate(event.date)} · {event.registeredVolunteers ?? 0}/
                {event.requiredVolunteers ?? 0} seats
                {ngoNameFromEvent(event) ? ` · ${ngoNameFromEvent(event)}` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}

      {eventId && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
          {(() => {
            const selected = events.find((event) => event._id === eventId);
            if (!selected) return null;
            return (
              <>
                <p className="font-medium text-navy-800 dark:text-slate-200">{selected.title}</p>
                <p className="mt-1 text-xs">
                  {formatDate(selected.date)} at {selected.time} · {selected.location}
                </p>
                <p className="mt-1 text-xs">
                  {selected.registeredVolunteers ?? 0} of {selected.requiredVolunteers ?? 0} seats filled
                </p>
              </>
            );
          })()}
        </div>
      )}
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-navy-700/10 p-3 dark:border-white/10">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-navy-800 dark:text-white">{value}</p>
    </div>
  );
}
