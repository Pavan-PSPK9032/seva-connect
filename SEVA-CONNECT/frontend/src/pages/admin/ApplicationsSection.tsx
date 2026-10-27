import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Search,
  XCircle,
} from 'lucide-react';
import { apiErrorMessage, apiGet, apiPatch } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type {
  Application,
  ApplicationStatus,
  ApplicationVolunteer,
  ApplicationEvent,
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
} from './ui';
import { formatDate, humanize, initials } from './utils';

const STATUSES: ApplicationStatus[] = [
  'pending',
  'approved',
  'rejected',
  'completed',
  'withdrawn',
  'cancelled',
];

const SUMMARY_KEYS: ApplicationStatus[] = [
  'pending',
  'approved',
  'completed',
  'rejected',
  'withdrawn',
  'cancelled',
];

type AdminApplication = Application & {
  volunteerId: string | ApplicationVolunteer;
  eventId: string | ApplicationEvent;
};

function volunteerOf(application: AdminApplication): ApplicationVolunteer | null {
  return typeof application.volunteerId === 'object' ? application.volunteerId : null;
}

function eventOf(application: AdminApplication): ApplicationEvent | null {
  return typeof application.eventId === 'object' ? application.eventId : null;
}

export default function ApplicationsSection() {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminApplication[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completeTarget, setCompleteTarget] = useState<AdminApplication | null>(null);
  const [hours, setHours] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<AdminApplication>('/admin/applications', {
        page,
        limit: 20,
        status: status || undefined,
      });
      setItems(res.data ?? []);
      setPagination(res.pagination ?? null);
      if (res.summary && typeof res.summary === 'object') {
        setSummary(res.summary as Record<string, number>);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load applications.'));
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (application: AdminApplication, next: 'approved' | 'rejected') => {
    const volunteer = volunteerOf(application);
    const event = eventOf(application);
    const ok = await confirm({
      title: next === 'approved' ? 'Approve this application?' : 'Reject this application?',
      message:
        next === 'approved'
          ? `${volunteer?.name || 'The volunteer'} will be approved for "${event?.title || 'the activity'}" and notified. Seats are reserved atomically.`
          : `${volunteer?.name || 'The volunteer'} will be notified that their application was not accepted.`,
      confirmLabel: next === 'approved' ? 'Approve' : 'Reject',
      tone: next === 'approved' ? 'primary' : 'danger',
    });
    if (!ok) return;

    setBusyId(application._id);
    try {
      await apiPatch(`/applications/${application._id}/status`, { status: next });
      setItems((prev) =>
        prev.map((item) => (item._id === application._id ? { ...item, status: next } : item))
      );
      toast('success', next === 'approved' ? 'Application approved' : 'Application rejected', volunteer?.email);
      void load();
    } catch (err) {
      toast('error', 'Could not update application', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const openComplete = (application: AdminApplication) => {
    const event = eventOf(application);
    setHours('');
    setCompleteError(null);
    setCompleteTarget(application);
    if (event?.date) {
      // Suggest the activity duration when the schedule contains a range.
      const match = event.time?.match(/(\d{1,2})(?::(\d{2}))?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?/);
      if (match) {
        const start = Number(match[1]) + (match[2] ? Number(match[2]) / 60 : 0);
        const end = Number(match[3]) + (match[4] ? Number(match[4]) / 60 : 0);
        if (end > start) setHours(String(Math.round(end - start)));
      }
    }
  };

  const submitComplete = async () => {
    if (!completeTarget) return;
    const value = Number(hours);
    if (!hours || !Number.isFinite(value) || value < 0) {
      setCompleteError('Enter the verified hours credited to this volunteer (0 or more).');
      return;
    }
    if (value > 1000) {
      setCompleteError('Hours cannot exceed 1000.');
      return;
    }

    const volunteer = volunteerOf(completeTarget);
    const ok = await confirm({
      title: 'Mark participation complete?',
      message: `${volunteer?.name || 'This volunteer'} will receive ${value} verified hour${value === 1 ? '' : 's'} and a certificate becomes available once issued.`,
      confirmLabel: 'Mark complete',
      tone: 'primary',
    });
    if (!ok) return;

    setCompleting(true);
    setCompleteError(null);
    try {
      await apiPatch(`/applications/${completeTarget._id}/status`, {
        status: 'completed',
        hoursCredited: value,
      });
      toast('success', 'Participation completed', `${value} hour${value === 1 ? '' : 's'} credited.`);
      setCompleteTarget(null);
      await load();
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not complete this application.');
      setCompleteError(message);
      toast('error', 'Could not complete application', message);
    } finally {
      setCompleting(false);
    }
  };

  const filtered = search.trim()
    ? items.filter((application) => {
        const volunteer = volunteerOf(application);
        const event = eventOf(application);
        const haystack = `${volunteer?.name || ''} ${volunteer?.email || ''} ${event?.title || ''} ${
          event?.location || ''
        }`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      })
    : items;

  return (
    <div>
      <PageHeader
        eyebrow="Application oversight"
        title="Applications"
        description="Review participation requests across the platform. Approving reserves a seat; completing credits verified hours."
      />

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {SUMMARY_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setStatus(status === key ? '' : key);
              setPage(1);
            }}
            aria-pressed={status === key}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              status === key
                ? 'border-primary-500 bg-primary-50 dark:border-primary-500/50 dark:bg-primary-500/10'
                : 'border-navy-700/10 bg-white hover:border-primary-500/40 dark:border-white/10 dark:bg-navy-800'
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{key}</p>
            <p className="mt-0.5 font-display text-lg font-bold text-navy-800 dark:text-white">
              {summary[key] ?? 0}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <FilterBar
          onReset={() => {
            setStatus('');
            setSearch('');
            setPage(1);
          }}
        >
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="application-search" className="label">
              Search this page
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-navy-700/15 bg-white px-3 dark:border-white/15 dark:bg-navy-900">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                id="application-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Volunteer, email or activity"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="application-status" className="label">
              Status
            </label>
            <select
              id="application-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="input w-auto"
            >
              <option value="">Any status</option>
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {humanize(item)}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>
      </div>

      <div className="card mt-4 overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title={search ? 'No applications match this search' : 'No applications yet'}
            description={
              search
                ? 'Search only filters the current page. Clear it to see all loaded applications.'
                : 'Applications submitted by volunteers will appear here.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[50rem] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-700/10 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
                  <th scope="col" className="px-5 py-3 font-semibold">Volunteer</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Activity</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Applied</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/10 dark:divide-white/10">
                {filtered.map((application) => {
                  const volunteer = volunteerOf(application);
                  const event = eventOf(application);
                  const busy = busyId === application._id;
                  return (
                    <tr key={application._id} className="align-middle hover:bg-slate-50/70 dark:hover:bg-white/5">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                            {initials(volunteer?.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-navy-800 dark:text-slate-200">
                              {volunteer?.name || 'Volunteer'}
                            </p>
                            <p className="truncate text-xs text-slate-500">{volunteer?.email || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[16rem] px-4 py-3">
                        <p className="truncate font-medium text-navy-800 dark:text-slate-200">
                          {event?.title || 'Activity'}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {event?.date ? formatDate(event.date) : 'Date not set'}
                          {event?.location ? ` · ${event.location}` : ''}
                        </p>
                        {application.hoursCredited > 0 && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-primary-700 dark:text-primary-300">
                            <Clock3 className="h-3 w-3" /> {application.hoursCredited}h credited
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(application.createdAt)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={application.status} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {application.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => void decide(application, 'approved')}
                                disabled={busy}
                                className="btn btn-primary text-xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => void decide(application, 'rejected')}
                                disabled={busy}
                                className="btn text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </button>
                            </>
                          )}
                          {application.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() => openComplete(application)}
                              disabled={busy}
                              className="btn btn-outline text-xs"
                            >
                              <Clock3 className="h-3.5 w-3.5" /> Complete
                            </button>
                          )}
                          {['completed', 'rejected', 'withdrawn', 'cancelled'].includes(application.status) && (
                            <span className="text-xs text-slate-400">No action</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pager pagination={pagination} page={page} onPage={setPage} />

      <Modal
        open={Boolean(completeTarget)}
        title="Complete participation"
        description={
          completeTarget
            ? `${volunteerOf(completeTarget)?.name || 'Volunteer'} · ${
                eventOf(completeTarget)?.title || 'Activity'
              }`
            : undefined
        }
        onClose={() => setCompleteTarget(null)}
        footer={
          <>
            <button type="button" onClick={() => setCompleteTarget(null)} className="btn btn-outline text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitComplete()}
              disabled={completing}
              className="btn btn-primary text-sm"
            >
              {completing ? 'Saving…' : 'Mark complete'}
            </button>
          </>
        }
      >
        {completeError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {completeError}
          </div>
        )}
        <Field
          label="Verified hours"
          htmlFor="application-hours"
          hint="Only hours confirmed by the organisation or platform team should be credited."
        >
          <input
            id="application-hours"
            type="number"
            min={0}
            max={1000}
            step={0.5}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className="input"
            placeholder="4"
          />
        </Field>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
          <p className="flex items-center gap-1.5 font-medium text-navy-800 dark:text-slate-200">
            <Badge tone="emerald">Completed</Badge>
          </p>
          <p className="mt-2">
            Completing credits hours to the volunteer's impact record and notifies both the volunteer and the
            organisation. This action is audited.
          </p>
        </div>
      </Modal>

      {dialog}
    </div>
  );
}
