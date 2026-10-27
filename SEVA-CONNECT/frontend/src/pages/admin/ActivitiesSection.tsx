import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  MapPin,
  Pencil,
  Search,
  Users,
} from 'lucide-react';
import { apiErrorMessage, apiGet, apiPatch, apiPost } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { EventItem, NGO, Pagination } from '../../types';
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
import { formatDate, ngoNameFromEvent, toDateInput } from './utils';

const STATUSES = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled', 'archived'] as const;
const CANCELLATION_WARNING =
  'Open applications will be closed, reserved seats released and affected volunteers notified.';

interface Filters {
  q: string;
  status: string;
  from: string;
  to: string;
  sort: string;
}

const EMPTY_FILTERS: Filters = { q: '', status: '', from: '', to: '', sort: 'newest' };

interface EventFormState {
  title: string;
  description: string;
  ngoId: string;
  date: string;
  time: string;
  location: string;
  online: boolean;
  requiredVolunteers: string;
  status: string;
  causes: string;
  requiredSkills: string;
  eligibility: string;
  applicationDeadline: string;
}

const EMPTY_FORM: EventFormState = {
  title: '',
  description: '',
  ngoId: '',
  date: '',
  time: '',
  location: '',
  online: false,
  requiredVolunteers: '',
  status: 'draft',
  causes: '',
  requiredSkills: '',
  eligibility: '',
  applicationDeadline: '',
};

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ActivitiesSection() {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();

  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<EventItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ngos, setNgos] = useState<NGO[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<EventItem>('/admin/events', {
        page,
        limit: 20,
        q: filters.q.trim() || undefined,
        status: filters.status || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        sort: filters.sort,
      });
      setItems(res.data ?? []);
      setPagination(res.pagination ?? null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load activities.'));
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    apiGet<NGO>('/admin/ngos', { limit: 60, sort: 'name' })
      .then((res) => {
        if (active) setNgos(res.data ?? []);
      })
      .catch(() => {
        /* the activity list still works without the NGO picker */
      });
    return () => {
      active = false;
    };
  }, []);

  const apply = () => {
    setPage(1);
    setFilters({ ...draft });
  };

  const reset = () => {
    setDraft(EMPTY_FILTERS);
    setPage(1);
    setFilters({ ...EMPTY_FILTERS });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, ngoId: ngos[0]?._id || '' });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (event: EventItem) => {
    setEditing(event);
    setForm({
      title: event.title,
      description: event.description,
      ngoId: typeof event.ngoId === 'string' ? event.ngoId : event.ngoId?._id || '',
      date: toDateInput(event.date),
      time: event.time,
      location: event.location,
      online: Boolean(event.online),
      requiredVolunteers: event.requiredVolunteers ? String(event.requiredVolunteers) : '',
      status: event.status || 'draft',
      causes: (event.causes ?? []).join(', '),
      requiredSkills: (event.requiredSkills ?? []).join(', '),
      eligibility: event.eligibility || '',
      applicationDeadline: toDateInput(event.applicationDeadline),
    });
    setFormError(null);
    setFormOpen(true);
  };

  const save = async () => {
    setFormError(null);
    if (!form.title.trim() || !form.description.trim()) {
      setFormError('A title and description are required.');
      return;
    }
    if (!form.ngoId) {
      setFormError('Choose the organisation that owns this activity.');
      return;
    }
    if (!form.date || !form.time || !form.location.trim()) {
      setFormError('Date, time and location are required.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      ngoId: form.ngoId,
      date: form.date,
      time: form.time.trim(),
      location: form.location.trim(),
      online: form.online,
      requiredVolunteers: form.requiredVolunteers ? Number(form.requiredVolunteers) : undefined,
      status: form.status,
      causes: splitList(form.causes),
      requiredSkills: splitList(form.requiredSkills),
      eligibility: form.eligibility.trim(),
      applicationDeadline: form.applicationDeadline || undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/events/${editing._id}`, payload);
        toast('success', 'Activity updated', form.title.trim());
      } else {
        await apiPost('/events', payload);
        toast('success', 'Activity created', `${form.title.trim()} is now ${form.status}.`);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not save the activity.');
      setFormError(message);
      toast('error', 'Could not save activity', message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (event: EventItem, status: string) => {
    if (status === event.status) return;
    if (status === 'cancelled') {
      const ok = await confirm({
        title: `Cancel "${event.title}"?`,
        message: CANCELLATION_WARNING,
        confirmLabel: 'Cancel activity',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusyId(event._id);
    try {
      await apiPatch(`/admin/events/${event._id}/status`, { status });
      setItems((prev) => prev.map((item) => (item._id === event._id ? { ...item, status } : item)));
      toast('success', 'Activity status updated', `"${event.title}" is now ${status}.`);
    } catch (err) {
      toast('error', 'Could not update status', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Activity management"
        title="Activities & events"
        description="Create, publish and moderate volunteering opportunities. Cancelling an activity releases seats and notifies applicants."
        actions={
          <button type="button" onClick={openCreate} className="btn btn-primary text-sm">
            <CalendarPlus className="h-4 w-4" /> New activity
          </button>
        }
      />

      <div className="mt-5">
        <FilterBar onReset={reset}>
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="event-search" className="label">Search</label>
            <div className="flex items-center gap-2 rounded-xl border border-navy-700/15 bg-white px-3 dark:border-white/15 dark:bg-navy-900">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                id="event-search"
                value={draft.q}
                onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    apply();
                  }
                }}
                placeholder="Title, location or description"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="event-status" className="label">Status</label>
            <select
              id="event-status"
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value })}
              className="input w-auto"
            >
              <option value="">Any status</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="event-from" className="label">From</label>
            <input
              id="event-from"
              type="date"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
              className="input w-auto"
            />
          </div>
          <div>
            <label htmlFor="event-to" className="label">To</label>
            <input
              id="event-to"
              type="date"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
              className="input w-auto"
            />
          </div>
          <div>
            <label htmlFor="event-sort" className="label">Sort</label>
            <select
              id="event-sort"
              value={draft.sort}
              onChange={(event) => setDraft({ ...draft, sort: event.target.value })}
              className="input w-auto"
            >
              <option value="newest">Newest date</option>
              <option value="oldest">Oldest date</option>
              <option value="title">Title A–Z</option>
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
            icon={<CalendarDays className="h-6 w-6" />}
            title="No activities match these filters"
            description="Create an activity or adjust the filters."
            action={
              <button type="button" onClick={openCreate} className="btn btn-primary text-sm">
                New activity
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-700/10 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
                  <th scope="col" className="px-5 py-3 font-semibold">Activity</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Schedule</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Seats</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/10 dark:divide-white/10">
                {items.map((event) => (
                  <tr key={event._id} className="align-middle hover:bg-slate-50/70 dark:hover:bg-white/5">
                    <td className="px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-navy-800 dark:text-slate-200">{event.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {ngoNameFromEvent(event) || 'Organisation not set'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      <p>{formatDate(event.date) || '—'}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-slate-500">
                        <MapPin className="h-3 w-3" /> {event.location || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {event.registeredVolunteers ?? 0}/{event.requiredVolunteers ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusBadge status={event.status} />
                        <select
                          value={event.status || 'upcoming'}
                          onChange={(ev) => void changeStatus(event, ev.target.value)}
                          disabled={busyId === event._id}
                          aria-label={`Change status for ${event.title}`}
                          className="rounded-lg border border-navy-700/15 bg-white px-2 py-1 text-xs dark:border-white/15 dark:bg-navy-900"
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" onClick={() => openEdit(event)} className="btn btn-ghost text-xs">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pager pagination={pagination} page={page} onPage={setPage} />

      <Modal
        open={formOpen}
        title={editing ? 'Edit activity' : 'Create activity'}
        description={
          editing
            ? 'Update schedule, capacity or content. Changes are audited and applicants are notified of schedule changes.'
            : 'Activities start as drafts until you publish them.'
        }
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setFormOpen(false)} className="btn btn-outline text-sm">
              Cancel
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-primary text-sm">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create activity'}
            </button>
          </>
        }
      >
        {formError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {formError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="event-title" className="sm:col-span-2">
            <input
              id="event-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              maxLength={120}
              className="input"
              placeholder="Weekend teaching drive"
            />
          </Field>

          <Field label="Organisation" htmlFor="event-ngo" className="sm:col-span-2">
            <select
              id="event-ngo"
              value={form.ngoId}
              onChange={(event) => setForm({ ...form, ngoId: event.target.value })}
              className="input"
            >
              <option value="">Choose an organisation…</option>
              {ngos.map((ngo) => (
                <option key={ngo._id} value={ngo._id}>
                  {ngo.organizationName}
                  {ngo.verified ? ' (verified)' : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description" htmlFor="event-description" className="sm:col-span-2">
            <textarea
              id="event-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={4}
              maxLength={3000}
              className="input resize-y"
              placeholder="What will volunteers do? Who will it help?"
            />
          </Field>

          <Field label="Date" htmlFor="event-date">
            <input
              id="event-date"
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              className="input"
            />
          </Field>

          <Field label="Time" htmlFor="event-time">
            <input
              id="event-time"
              value={form.time}
              onChange={(event) => setForm({ ...form, time: event.target.value })}
              className="input"
              placeholder="09:00 – 13:00"
            />
          </Field>

          <Field label="Location" htmlFor="event-location">
            <input
              id="event-location"
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
              className="input"
              placeholder="Community hall, Bengaluru"
            />
          </Field>

          <Field label="Capacity" htmlFor="event-capacity" hint="Leave blank for unlimited applications.">
            <input
              id="event-capacity"
              type="number"
              min={1}
              value={form.requiredVolunteers}
              onChange={(event) => setForm({ ...form, requiredVolunteers: event.target.value })}
              className="input"
              placeholder="25"
            />
          </Field>

          <Field label="Status" htmlFor="event-form-status" hint="Only published statuses appear publicly.">
            <select
              id="event-form-status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className="input"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Application deadline" htmlFor="event-deadline">
            <input
              id="event-deadline"
              type="date"
              value={form.applicationDeadline}
              onChange={(event) => setForm({ ...form, applicationDeadline: event.target.value })}
              className="input"
            />
          </Field>

          <Field label="Causes" htmlFor="event-causes" hint="Comma separated, e.g. Education, Health" className="sm:col-span-2">
            <input
              id="event-causes"
              value={form.causes}
              onChange={(event) => setForm({ ...form, causes: event.target.value })}
              className="input"
            />
          </Field>

          <Field label="Required skills" htmlFor="event-skills" hint="Comma separated." className="sm:col-span-2">
            <input
              id="event-skills"
              value={form.requiredSkills}
              onChange={(event) => setForm({ ...form, requiredSkills: event.target.value })}
              className="input"
            />
          </Field>

          <Field label="Eligibility notes" htmlFor="event-eligibility" className="sm:col-span-2">
            <textarea
              id="event-eligibility"
              value={form.eligibility}
              onChange={(event) => setForm({ ...form, eligibility: event.target.value })}
              rows={2}
              maxLength={500}
              className="input resize-y"
              placeholder="Age limits, required training, what to bring…"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.online}
              onChange={(event) => setForm({ ...form, online: event.target.checked })}
              className="h-4 w-4 rounded accent-primary-600"
            />
            This is an online / remote activity
          </label>
        </div>

        {ngos.length === 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <Badge tone="amber">No organisations</Badge>
            Create or verify an organisation before publishing activities.
          </p>
        )}
      </Modal>

      {dialog}
    </div>
  );
}
