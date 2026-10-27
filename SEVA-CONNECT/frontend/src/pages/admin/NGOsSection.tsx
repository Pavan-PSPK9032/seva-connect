import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { apiErrorMessage, apiGet, apiGetOne, apiPatch } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { AdminNGODetail, NGO, Pagination } from '../../types';
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
import { formatDate, formatDateTime } from './utils';

type NGORow = NGO & {
  createdBy?: string | { _id?: string; name?: string; email?: string; accountStatus?: string };
};

interface Filters {
  q: string;
  verified: string;
  requested: string;
  status: string;
  sort: string;
}

const EMPTY_FILTERS: Filters = { q: '', verified: '', requested: '', status: '', sort: 'newest' };

function ownerOf(ngo: NGORow): { name?: string; email?: string } | null {
  return ngo.createdBy && typeof ngo.createdBy === 'object' ? ngo.createdBy : null;
}

export default function NGOsSection() {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();

  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NGORow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<{ ngo: NGORow; verified: boolean } | null>(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<NGORow>('/admin/ngos', {
        page,
        limit: 20,
        q: filters.q.trim() || undefined,
        verified: filters.verified || undefined,
        requested: filters.requested || undefined,
        status: filters.status || undefined,
        sort: filters.sort,
      });
      setItems(res.data ?? []);
      setPagination(res.pagination ?? null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load organisations.'));
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

  const openVerify = (ngo: NGORow, verified: boolean) => {
    setVerifyNote(ngo.verificationNote || '');
    setVerifyState({ ngo, verified });
  };

  const submitVerify = async () => {
    if (!verifyState) return;
    setVerifying(true);
    try {
      await apiPatch(`/admin/ngos/${verifyState.ngo._id}/verify`, {
        verified: verifyState.verified,
        note: verifyNote.trim() || undefined,
      });
      toast(
        'success',
        verifyState.verified ? 'Organisation verified' : 'Verification revoked',
        verifyState.ngo.organizationName
      );
      setVerifyState(null);
      await load();
    } catch (err) {
      toast('error', 'Could not update verification', apiErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const toggleStatus = async (ngo: NGORow) => {
    const next = ngo.status === 'suspended' ? 'active' : 'suspended';
    const ok = await confirm({
      title: next === 'suspended' ? `Suspend ${ngo.organizationName}?` : `Reactivate ${ngo.organizationName}?`,
      message:
        next === 'suspended'
          ? 'The organisation profile will be hidden from public pages and its records become read-only. The owner is notified.'
          : 'The organisation will be publicly visible again and can manage activities.',
      confirmLabel: next === 'suspended' ? 'Suspend organisation' : 'Reactivate',
      tone: next === 'suspended' ? 'danger' : 'primary',
    });
    if (!ok) return;

    setBusyId(ngo._id);
    try {
      await apiPatch(`/admin/ngos/${ngo._id}/status`, { status: next });
      setItems((prev) => prev.map((item) => (item._id === ngo._id ? { ...item, status: next } : item)));
      toast('success', next === 'suspended' ? 'Organisation suspended' : 'Organisation reactivated', ngo.organizationName);
    } catch (err) {
      toast('error', 'Could not update organisation', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Organisation management"
        title="NGOs & organisations"
        description="Verify organisational details, revoke access when justified and review associated activities."
      />

      <div className="mt-5">
        <FilterBar onReset={reset}>
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="ngo-search" className="label">Search</label>
            <div className="flex items-center gap-2 rounded-xl border border-navy-700/15 bg-white px-3 dark:border-white/15 dark:bg-navy-900">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                id="ngo-search"
                value={draft.q}
                onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    apply();
                  }
                }}
                placeholder="Name, location or contact email"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="ngo-verified" className="label">Verification</label>
            <select
              id="ngo-verified"
              value={draft.verified}
              onChange={(event) => setDraft({ ...draft, verified: event.target.value, requested: '' })}
              className="input w-auto"
            >
              <option value="">Any</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
          </div>
          <div>
            <label htmlFor="ngo-requested" className="label">Requests</label>
            <select
              id="ngo-requested"
              value={draft.requested}
              onChange={(event) => setDraft({ ...draft, requested: event.target.value, verified: '' })}
              className="input w-auto"
            >
              <option value="">All</option>
              <option value="true">Verification requested</option>
            </select>
          </div>
          <div>
            <label htmlFor="ngo-status" className="label">Status</label>
            <select
              id="ngo-status"
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
            <label htmlFor="ngo-sort" className="label">Sort</label>
            <select
              id="ngo-sort"
              value={draft.sort}
              onChange={(event) => setDraft({ ...draft, sort: event.target.value })}
              className="input w-auto"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
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
            icon={<Building2 className="h-6 w-6" />}
            title="No organisations match these filters"
            description="Try a different search term or clear the filters."
            action={
              <button type="button" onClick={reset} className="btn btn-outline text-sm">
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[50rem] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-700/10 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
                  <th scope="col" className="px-5 py-3 font-semibold">Organisation</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Owner</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Verification</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Created</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/10 dark:divide-white/10">
                {items.map((ngo) => {
                  const owner = ownerOf(ngo);
                  return (
                    <tr key={ngo._id} className="align-middle hover:bg-slate-50/70 dark:hover:bg-white/5">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium text-navy-800 dark:text-slate-200">
                              {ngo.organizationName}
                              {ngo.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary-600" />}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {ngo.location || 'Location not set'}
                              {ngo.causes?.length ? ` · ${ngo.causes.slice(0, 2).join(', ')}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <p>{owner?.name || '—'}</p>
                        <p className="truncate text-slate-500">{owner?.email || ngo.contactEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={ngo.verified ? 'emerald' : 'amber'}>
                            {ngo.verified ? 'verified' : 'unverified'}
                          </Badge>
                          {!ngo.verified && ngo.verificationRequested && <Badge tone="sky">requested</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ngo.status || 'active'} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(ngo.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailId(ngo._id)}
                            className="btn btn-ghost text-xs"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openVerify(ngo, !ngo.verified)}
                            disabled={busyId === ngo._id}
                            className={`btn text-xs ${ngo.verified ? 'btn-outline' : 'btn-primary'}`}
                          >
                            <BadgeCheck className="h-3.5 w-3.5" />
                            {ngo.verified ? 'Revoke' : 'Verify'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleStatus(ngo)}
                            disabled={busyId === ngo._id}
                            aria-label={`${ngo.status === 'suspended' ? 'Reactivate' : 'Suspend'} ${ngo.organizationName}`}
                            className={`btn text-xs ${
                              ngo.status === 'suspended'
                                ? 'btn-outline'
                                : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10'
                            }`}
                          >
                            {ngo.status === 'suspended' ? (
                              <RotateCcw className="h-3.5 w-3.5" />
                            ) : (
                              <Ban className="h-3.5 w-3.5" />
                            )}
                            {ngo.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
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
        open={Boolean(verifyState)}
        title={verifyState?.verified ? 'Verify organisation' : 'Revoke verification'}
        description={
          verifyState
            ? `${verifyState.ngo.organizationName} · ${verifyState.ngo.contactEmail}`
            : undefined
        }
        onClose={() => setVerifyState(null)}
        footer={
          <>
            <button type="button" onClick={() => setVerifyState(null)} className="btn btn-outline text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitVerify()}
              disabled={verifying}
              className={`btn text-sm ${verifyState?.verified ? 'btn-primary' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
              {verifyState?.verified ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {verifying ? 'Saving…' : verifyState?.verified ? 'Verify organisation' : 'Revoke verification'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {verifyState?.verified
            ? 'Verified organisations are highlighted on public listings. The owner receives an in-app notification.'
            : 'Revoking verification removes the verified badge and notifies the organisation owner. Existing activities are not deleted.'}
        </p>
        <div className="mt-4">
          <Field
            label={verifyState?.verified ? 'Verification note (optional)' : 'Reason (optional)'}
            htmlFor="ngo-verify-note"
            hint="Stored with the audit record and shown in the organisation overview."
          >
            <textarea
              id="ngo-verify-note"
              value={verifyNote}
              onChange={(event) => setVerifyNote(event.target.value)}
              rows={3}
              maxLength={1000}
              className="input resize-y"
              placeholder="e.g. Registration certificate reviewed"
            />
          </Field>
        </div>
      </Modal>

      <NGODetailModal
        ngoId={detailId}
        onClose={() => setDetailId(null)}
        onVerify={(ngo, verified) => {
          setDetailId(null);
          openVerify(ngo as NGORow, verified);
        }}
        onChanged={load}
      />

      {dialog}
    </div>
  );
}

/* ------------------------------- NGO detail -------------------------------- */

function NGODetailModal({
  ngoId,
  onClose,
  onVerify,
  onChanged,
}: {
  ngoId: string | null;
  onClose: () => void;
  onVerify: (ngo: NGO, verified: boolean) => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [detail, setDetail] = useState<AdminNGODetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!ngoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetOne<AdminNGODetail>(`/admin/ngos/${ngoId}`);
      if (!res.data) throw new Error(res.message || 'Organisation not found.');
      setDetail(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this organisation.'));
    } finally {
      setLoading(false);
    }
  }, [ngoId]);

  useEffect(() => {
    if (ngoId) void load();
    else setDetail(null);
  }, [ngoId, load]);

  const toggleStatus = async () => {
    if (!detail) return;
    const ngo = detail.ngo;
    const next = ngo.status === 'suspended' ? 'active' : 'suspended';
    const ok = await confirm({
      title: next === 'suspended' ? 'Suspend this organisation?' : 'Reactivate this organisation?',
      message:
        next === 'suspended'
          ? 'Public visibility will be removed and organisation records become read-only.'
          : 'The organisation will be visible publicly and able to manage activities again.',
      confirmLabel: next === 'suspended' ? 'Suspend' : 'Reactivate',
      tone: next === 'suspended' ? 'danger' : 'primary',
    });
    if (!ok) return;

    setBusy(true);
    try {
      await apiPatch(`/admin/ngos/${ngo._id}/status`, { status: next });
      toast('success', 'Organisation updated', ngo.organizationName);
      await load();
      onChanged();
    } catch (err) {
      toast('error', 'Could not update organisation', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const ngo = detail?.ngo;

  return (
    <>
      <Modal
        open={Boolean(ngoId)}
        title="Organisation profile"
        description="Verification history, activities and participation."
        onClose={onClose}
        size="lg"
        footer={
          ngo ? (
            <>
              <button type="button" onClick={onClose} className="btn btn-outline text-sm">
                Close
              </button>
              <button
                type="button"
                onClick={() => void toggleStatus()}
                disabled={busy}
                className={`btn text-sm ${ngo.status === 'suspended' ? 'btn-primary' : 'bg-red-600 text-white hover:bg-red-700'}`}
              >
                {ngo.status === 'suspended' ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                {ngo.status === 'suspended' ? 'Reactivate' : 'Suspend'}
              </button>
              <button
                type="button"
                onClick={() => onVerify(ngo, !ngo.verified)}
                className={`btn text-sm ${ngo.verified ? 'btn-outline' : 'btn-primary'}`}
              >
                <BadgeCheck className="h-4 w-4" /> {ngo.verified ? 'Revoke verification' : 'Verify'}
              </button>
            </>
          ) : null
        }
      >
        {loading ? (
          <TableSkeleton rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : detail && ngo ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                <Building2 className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold text-navy-800 dark:text-white">{ngo.organizationName}</p>
                <p className="text-sm text-slate-500">
                  {ngo.location || 'Location not set'}
                  {ngo.website ? ' · ' : ''}
                  {ngo.website && (
                    <a href={ngo.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-600 hover:underline">
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={ngo.status || 'active'} />
                  <Badge tone={ngo.verified ? 'emerald' : 'amber'}>{ngo.verified ? 'verified' : 'unverified'}</Badge>
                  {ngo.verificationRequested && <Badge tone="sky">verification requested</Badge>}
                </div>
              </div>
            </div>

            {ngo.description && (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
                {ngo.description}
              </p>
            )}

            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Contact email</dt>
                <dd className="mt-0.5 text-navy-800 dark:text-slate-200">{ngo.contactEmail}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Owner</dt>
                <dd className="mt-0.5 text-navy-800 dark:text-slate-200">
                  {ngo.createdBy?.name || '—'}
                  {ngo.createdBy?.email ? ` · ${ngo.createdBy.email}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Verified at</dt>
                <dd className="mt-0.5 text-navy-800 dark:text-slate-200">
                  {ngo.verifiedAt ? formatDateTime(ngo.verifiedAt) : 'Not verified'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Created</dt>
                <dd className="mt-0.5 text-navy-800 dark:text-slate-200">{formatDateTime(ngo.createdAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Causes</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {(ngo.causes ?? []).length > 0
                    ? ngo.causes.map((cause) => (
                        <span key={cause} className="chip bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {cause}
                        </span>
                      ))
                    : <span className="text-slate-400">—</span>}
                </dd>
              </div>
              {ngo.verificationNote && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Latest verification note</dt>
                  <dd className="mt-0.5 text-navy-800 dark:text-slate-200">{ngo.verificationNote}</dd>
                </div>
              )}
            </dl>

            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Activities" value={detail.stats.events} />
              <Metric label="Upcoming" value={detail.stats.upcoming} />
              <Metric label="Applications" value={detail.stats.applications} />
              <Metric label="Volunteers" value={detail.stats.volunteers} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-navy-800 dark:text-white">Activities ({detail.events.length})</h3>
              {detail.events.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No activities have been created.</p>
              ) : (
                <ul className="mt-3 divide-y divide-navy-700/10 rounded-xl border border-navy-700/10 dark:divide-white/10 dark:border-white/10">
                  {detail.events.map((event) => (
                    <li key={event._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy-800 dark:text-slate-200">{event.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(event.date)} · {event.location || 'Location not set'} ·{' '}
                          {event.registeredVolunteers ?? 0}/{event.requiredVolunteers ?? 0} seats
                        </p>
                      </div>
                      <StatusBadge status={event.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-navy-800 dark:text-white">Verification history</h3>
              {detail.history.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No verification actions recorded yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-navy-700/10 rounded-xl border border-navy-700/10 dark:divide-white/10 dark:border-white/10">
                  {detail.history.map((entry) => (
                    <li key={entry._id} className="px-4 py-2.5">
                      <p className="text-sm text-navy-800 dark:text-slate-200">{entry.summary}</p>
                      <p className="text-xs text-slate-500">
                        {entry.action}
                        {entry.actorName ? ` · ${entry.actorName}` : ''} · {formatDateTime(entry.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
      {dialog}
    </>
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
