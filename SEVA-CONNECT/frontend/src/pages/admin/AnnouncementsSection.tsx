import { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  Bell,
  CalendarClock,
  Pencil,
  Plus,
  Rocket,
  Search,
  Trash2,
} from 'lucide-react';
import { apiDelete, apiErrorMessage, apiGet, apiPatch, apiPost } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { Announcement, AnnouncementStatus, Pagination } from '../../types';
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
import { formatDateTime, humanize, toDateInput } from './utils';

const AUDIENCES = ['all', 'volunteer', 'ngo'] as const;
const STATUSES: AnnouncementStatus[] = ['draft', 'published', 'archived'];

type AnnouncementRow = Omit<Announcement, 'createdBy'> & {
  createdBy?: { name?: string; email?: string } | string | null;
};

interface FormState {
  title: string;
  message: string;
  link: string;
  audience: 'all' | 'volunteer' | 'ngo';
  status: AnnouncementStatus;
  expiresAt: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  message: '',
  link: '',
  audience: 'all',
  status: 'draft',
  expiresAt: '',
};

function authorName(announcement: AnnouncementRow): string {
  if (announcement.createdBy && typeof announcement.createdBy === 'object') {
    return announcement.createdBy.name || announcement.createdBy.email || 'Administrator';
  }
  return 'Administrator';
}

export default function AnnouncementsSection() {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();

  const [draft, setDraft] = useState({ q: '', status: '', audience: '' });
  const [filters, setFilters] = useState({ q: '', status: '', audience: '' });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<AnnouncementRow>('/admin/announcements', {
        page,
        limit: 20,
        q: filters.q.trim() || undefined,
        status: filters.status || undefined,
        audience: filters.audience || undefined,
      });
      setItems(res.data ?? []);
      setPagination(res.pagination ?? null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load announcements.'));
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
    setDraft({ q: '', status: '', audience: '' });
    setPage(1);
    setFilters({ q: '', status: '', audience: '' });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (announcement: AnnouncementRow) => {
    setEditing(announcement);
    setForm({
      title: announcement.title,
      message: announcement.message,
      link: announcement.link || '',
      audience: announcement.audience,
      status: announcement.status,
      expiresAt: toDateInput(announcement.expiresAt),
    });
    setFormError(null);
    setFormOpen(true);
  };

  const save = async (publishNow = false) => {
    setFormError(null);
    if (form.title.trim().length < 2) {
      setFormError('Give the announcement a title of at least 2 characters.');
      return;
    }
    if (form.message.trim().length < 2) {
      setFormError('The message must be at least 2 characters.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      link: form.link.trim() || undefined,
      audience: form.audience,
      status: publishNow ? 'published' : form.status,
      expiresAt: form.expiresAt || undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/admin/announcements/${editing._id}`, payload);
        toast('success', 'Announcement updated', payload.title);
      } else {
        await apiPost('/admin/announcements', payload);
        toast(
          'success',
          payload.status === 'published' ? 'Announcement published' : 'Announcement saved',
          payload.status === 'published'
            ? 'Audience members have been notified in-app.'
            : 'Saved as a draft — publish when ready.'
        );
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not save the announcement.');
      setFormError(message);
      toast('error', 'Could not save announcement', message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (announcement: AnnouncementRow, status: AnnouncementStatus) => {
    if (status === announcement.status) return;
    if (status === 'published') {
      const ok = await confirm({
        title: 'Publish this announcement?',
        message: `Every eligible ${announcement.audience === 'all' ? 'member' : `${announcement.audience} member`} will receive an in-app notification. Publishing again notifies people once.`,
        confirmLabel: 'Publish',
        tone: 'primary',
      });
      if (!ok) return;
    }

    setBusyId(announcement._id);
    try {
      await apiPatch(`/admin/announcements/${announcement._id}`, { status });
      setItems((prev) =>
        prev.map((item) => (item._id === announcement._id ? { ...item, status } : item))
      );
      toast('success', `Announcement ${status}`, announcement.title);
    } catch (err) {
      toast('error', 'Could not update announcement', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (announcement: AnnouncementRow) => {
    const ok = await confirm({
      title: 'Delete this announcement?',
      message: `"${announcement.title}" will be removed permanently. Notifications already delivered remain in member inboxes.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    setBusyId(announcement._id);
    try {
      await apiDelete(`/admin/announcements/${announcement._id}`);
      toast('success', 'Announcement deleted', announcement.title);
      await load();
    } catch (err) {
      toast('error', 'Could not delete announcement', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Communications"
        title="Announcements"
        description="Publish platform-wide notices. Drafts stay private until published; archiving removes them from the public site without deleting the record."
        actions={
          <button type="button" onClick={openCreate} className="btn btn-primary text-sm">
            <Plus className="h-4 w-4" /> New announcement
          </button>
        }
      />

      <div className="mt-5">
        <FilterBar onReset={reset}>
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="announcement-search" className="label">
              Search
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-navy-700/15 bg-white px-3 dark:border-white/15 dark:bg-navy-900">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                id="announcement-search"
                value={draft.q}
                onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    apply();
                  }
                }}
                placeholder="Title or message"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="announcement-status" className="label">
              Status
            </label>
            <select
              id="announcement-status"
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value })}
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
          <div>
            <label htmlFor="announcement-audience" className="label">
              Audience
            </label>
            <select
              id="announcement-audience"
              value={draft.audience}
              onChange={(event) => setDraft({ ...draft, audience: event.target.value })}
              className="input w-auto"
            >
              <option value="">Everyone</option>
              {AUDIENCES.map((item) => (
                <option key={item} value={item}>
                  {item === 'all' ? 'All members' : humanize(item)}
                </option>
              ))}
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
            icon={<Bell className="h-6 w-6" />}
            title="No announcements yet"
            description="Create your first announcement to keep volunteers and organisations informed."
            action={
              <button type="button" onClick={openCreate} className="btn btn-primary text-sm">
                New announcement
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-700/10 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
                  <th scope="col" className="px-5 py-3 font-semibold">Announcement</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Audience</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Published</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/10 dark:divide-white/10">
                {items.map((announcement) => (
                  <tr key={announcement._id} className="align-top hover:bg-slate-50/70 dark:hover:bg-white/5">
                    <td className="max-w-[24rem] px-5 py-3">
                      <p className="font-medium text-navy-800 dark:text-slate-200">{announcement.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{announcement.message}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {authorName(announcement)}
                        {announcement.expiresAt ? ` · expires ${formatDateTime(announcement.expiresAt)}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={announcement.audience === 'all' ? 'sky' : 'violet'}>
                        {announcement.audience === 'all' ? 'everyone' : announcement.audience}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={announcement.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {announcement.publishedAt ? formatDateTime(announcement.publishedAt) : 'Not published'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(announcement)}
                          className="btn btn-ghost text-xs"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        {announcement.status === 'published' ? (
                          <button
                            type="button"
                            onClick={() => void setStatus(announcement, 'archived')}
                            disabled={busyId === announcement._id}
                            className="btn btn-outline text-xs"
                          >
                            <Archive className="h-3.5 w-3.5" /> Archive
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void setStatus(announcement, 'published')}
                            disabled={busyId === announcement._id}
                            className="btn btn-primary text-xs"
                          >
                            <Rocket className="h-3.5 w-3.5" /> Publish
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void remove(announcement)}
                          disabled={busyId === announcement._id}
                          aria-label={`Delete ${announcement.title}`}
                          className="btn text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      <Modal
        open={formOpen}
        title={editing ? 'Edit announcement' : 'New announcement'}
        description="Publishing notifies the selected audience once. Editing a live announcement does not resend notifications."
        onClose={() => setFormOpen(false)}
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setFormOpen(false)} className="btn btn-outline text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save(false)}
              disabled={saving}
              className="btn btn-outline text-sm"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {(!editing || editing.status !== 'published') && (
              <button
                type="button"
                onClick={() => void save(true)}
                disabled={saving}
                className="btn btn-primary text-sm"
              >
                <Rocket className="h-4 w-4" /> Publish now
              </button>
            )}
          </>
        }
      >
        {formError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {formError}
          </div>
        )}

        <div className="space-y-4">
          <Field label="Title" htmlFor="announcement-title">
            <input
              id="announcement-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              maxLength={120}
              className="input"
              placeholder="Scheduled maintenance this weekend"
            />
          </Field>

          <Field label="Message" htmlFor="announcement-message" hint={`${form.message.length}/1000 characters`}>
            <textarea
              id="announcement-message"
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              rows={5}
              maxLength={1000}
              className="input resize-y"
              placeholder="Explain what is changing and what members should do."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audience" htmlFor="announcement-form-audience">
              <select
                id="announcement-form-audience"
                value={form.audience}
                onChange={(event) =>
                  setForm({ ...form, audience: event.target.value as FormState['audience'] })
                }
                className="input"
              >
                <option value="all">All members</option>
                <option value="volunteer">Volunteers</option>
                <option value="ngo">NGO representatives</option>
              </select>
            </Field>

            <Field label="Status" htmlFor="announcement-form-status">
              <select
                id="announcement-form-status"
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as AnnouncementStatus })
                }
                className="input"
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {humanize(item)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Link (optional)" htmlFor="announcement-link" hint="In-app path or https URL.">
              <input
                id="announcement-link"
                value={form.link}
                onChange={(event) => setForm({ ...form, link: event.target.value })}
                maxLength={300}
                className="input"
                placeholder="/events"
              />
            </Field>

            <Field
              label="Expires (optional)"
              htmlFor="announcement-expires"
              hint="Expired announcements disappear from the public site."
            >
              <div className="relative">
                <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="announcement-expires"
                  type="date"
                  value={form.expiresAt}
                  onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
                  className="input pl-9"
                />
              </div>
            </Field>
          </div>
        </div>
      </Modal>

      {dialog}
    </div>
  );
}
