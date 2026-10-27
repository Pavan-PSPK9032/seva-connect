import { useCallback, useEffect, useState } from 'react';
import { Ban, RotateCcw, Search, Users } from 'lucide-react';
import { apiErrorMessage, apiGet, apiPatch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { Pagination, User } from '../../types';
import {
  Badge,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Pager,
  StatusBadge,
  TableSkeleton,
  useConfirm,
} from './ui';
import { formatDate, initials } from './utils';
import UserDetailModal from './UserDetailModal';

interface Filters {
  q: string;
  role: string;
  status: string;
  verified: string;
  sort: string;
}

const EMPTY_FILTERS: Filters = { q: '', role: '', status: '', verified: '', sort: 'newest' };

export default function UsersSection() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();

  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<User>('/admin/users', {
        page,
        limit: 20,
        q: filters.q.trim() || undefined,
        role: filters.role || undefined,
        status: filters.status || undefined,
        verified: filters.verified || undefined,
        sort: filters.sort,
      });
      setItems(res.data ?? []);
      setPagination(res.pagination ?? null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load users.'));
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

  const toggleStatus = async (user: User) => {
    const next = user.accountStatus === 'suspended' ? 'active' : 'suspended';
    const ok = await confirm({
      title: next === 'suspended' ? `Suspend ${user.name}?` : `Reactivate ${user.name}?`,
      message:
        next === 'suspended'
          ? 'Suspended accounts are blocked from protected features and are notified in-app.'
          : 'This account will regain access immediately.',
      confirmLabel: next === 'suspended' ? 'Suspend' : 'Reactivate',
      tone: next === 'suspended' ? 'danger' : 'primary',
    });
    if (!ok) return;

    setBusyId(user._id);
    try {
      await apiPatch(`/admin/users/${user._id}/status`, { accountStatus: next });
      setItems((prev) =>
        prev.map((item) => (item._id === user._id ? { ...item, accountStatus: next } : item))
      );
      toast('success', next === 'suspended' ? 'Account suspended' : 'Account reactivated', user.email);
    } catch (err) {
      toast('error', 'Could not update account', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="User management"
        title="Users"
        description="Search accounts, inspect participation history and control access. Sensitive changes are confirmed and audited."
      />

      <div className="mt-5">
        <FilterBar
          onReset={reset}
        >
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="user-search" className="label">
              Search
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-navy-700/15 bg-white px-3 dark:border-white/15 dark:bg-navy-900">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                id="user-search"
                value={draft.q}
                onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    apply();
                  }
                }}
                placeholder="Name or email"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="user-role" className="label">
              Role
            </label>
            <select
              id="user-role"
              value={draft.role}
              onChange={(event) => setDraft({ ...draft, role: event.target.value })}
              className="input w-auto"
            >
              <option value="">All roles</option>
              <option value="volunteer">Volunteer</option>
              <option value="ngo">NGO representative</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div>
            <label htmlFor="user-status" className="label">
              Status
            </label>
            <select
              id="user-status"
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value })}
              className="input w-auto"
            >
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div>
            <label htmlFor="user-verified" className="label">
              Email
            </label>
            <select
              id="user-verified"
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
            <label htmlFor="user-sort" className="label">
              Sort
            </label>
            <select
              id="user-sort"
              value={draft.sort}
              onChange={(event) => setDraft({ ...draft, sort: event.target.value })}
              className="input w-auto"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
              <option value="email">Email A–Z</option>
              <option value="role">Role</option>
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
            icon={<Users className="h-6 w-6" />}
            title="No users match these filters"
            description="Try a different search term or clear the filters."
            action={
              <button type="button" onClick={reset} className="btn btn-outline text-sm">
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-700/10 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
                  <th scope="col" className="px-5 py-3 font-semibold">Member</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Role</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Account</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/10 dark:divide-white/10">
                {items.map((user) => {
                  const isSelf = user._id === currentUser?._id;
                  return (
                    <tr key={user._id} className="align-middle hover:bg-slate-50/70 dark:hover:bg-white/5">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                            {initials(user.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium text-navy-800 dark:text-slate-200">
                              {user.name}
                              {isSelf && <Badge tone="violet">you</Badge>}
                            </p>
                            <p className="truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={user.role === 'admin' ? 'violet' : user.role === 'ngo' ? 'sky' : 'slate'}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={user.emailVerified === false ? 'amber' : 'emerald'}>
                          {user.emailVerified === false ? 'unverified' : 'verified'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={user.accountStatus || 'active'} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailId(user._id)}
                            className="btn btn-ghost text-xs"
                          >
                            View
                          </button>
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => void toggleStatus(user)}
                              disabled={busyId === user._id}
                              aria-label={`${user.accountStatus === 'suspended' ? 'Reactivate' : 'Suspend'} ${user.name}`}
                              className={`btn text-xs ${
                                user.accountStatus === 'suspended'
                                  ? 'btn-outline'
                                  : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10'
                              }`}
                            >
                              {user.accountStatus === 'suspended' ? (
                                <RotateCcw className="h-3.5 w-3.5" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                              {user.accountStatus === 'suspended' ? 'Reactivate' : 'Suspend'}
                            </button>
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

      <UserDetailModal
        userId={detailId}
        currentUserId={currentUser?._id}
        onClose={() => setDetailId(null)}
        onChanged={load}
      />
      {dialog}
    </div>
  );
}
