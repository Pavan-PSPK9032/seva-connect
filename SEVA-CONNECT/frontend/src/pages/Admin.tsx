import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  Ban,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock3,
  Loader2,
  RotateCcw,
  ScrollText,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { apiGet, apiGetOne, apiPatch, apiErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import type { NGO, Pagination, User } from '../types';
import { CardSkeleton } from '../components/Skeleton';

interface OverviewData {
  users: { volunteers: number; ngoUsers: number; admins: number; suspended: number; total: number };
  ngos: { total: number; verified: number; pending: number };
  events: { upcoming: number; completed: number };
  applications: { total: number; pending: number };
  verifiedHours: number;
  recentUsers: Pick<User, '_id' | 'name' | 'email' | 'role' | 'createdAt'>[];
}

interface AuditEntry {
  _id: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entityType?: string;
  summary: string;
  createdAt: string;
}

type Tab = 'overview' | 'users' | 'ngos' | 'audit';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <ShieldCheck className="h-4 w-4" /> },
  { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { id: 'ngos', label: 'Organisations', icon: <Building2 className="h-4 w-4" /> },
  { id: 'audit', label: 'Audit log', icon: <ScrollText className="h-4 w-4" /> },
];

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Admin() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userRole, setUserRole] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState<Pagination | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);

  const [ngos, setNgos] = useState<NGO[]>([]);
  const [ngoFilter, setNgoFilter] = useState('');
  const [ngosPage, setNgosPage] = useState(1);
  const [ngosPagination, setNgosPagination] = useState<Pagination | null>(null);
  const [ngosLoading, setNgosLoading] = useState(false);

  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPagination, setAuditPagination] = useState<Pagination | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setError(null);
    try {
      const res = await apiGetOne<OverviewData>('/admin/overview');
      setOverview(res.data ?? null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async (page: number) => {
    setUsersLoading(true);
    try {
      const res = await apiGet<User>('/admin/users', {
        page,
        limit: 20,
        q: userQuery.trim() || undefined,
        role: userRole || undefined,
      });
      setUsers(res.data ?? []);
      setUsersPagination(res.pagination ?? null);
      setUsersPage(page);
    } catch (err) {
      toast('error', 'Could not load users', apiErrorMessage(err));
    } finally {
      setUsersLoading(false);
    }
  }, [userQuery, userRole, toast]);

  const loadNGOs = useCallback(async (page: number) => {
    setNgosLoading(true);
    try {
      const res = await apiGet<NGO>('/admin/ngos', {
        page,
        limit: 20,
        verified: ngoFilter || undefined,
      });
      setNgos(res.data ?? []);
      setNgosPagination(res.pagination ?? null);
      setNgosPage(page);
    } catch (err) {
      toast('error', 'Could not load organisations', apiErrorMessage(err));
    } finally {
      setNgosLoading(false);
    }
  }, [ngoFilter, toast]);

  const loadAudit = useCallback(async (page: number) => {
    setAuditLoading(true);
    try {
      const res = await apiGet<AuditEntry>('/admin/audit', { page, limit: 20 });
      setAudit(res.data ?? []);
      setAuditPagination(res.pagination ?? null);
      setAuditPage(page);
    } catch (err) {
      toast('error', 'Could not load audit log', apiErrorMessage(err));
    } finally {
      setAuditLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (tab === 'users') loadUsers(1);
  }, [tab, loadUsers]);

  useEffect(() => {
    if (tab === 'ngos') loadNGOs(1);
  }, [tab, loadNGOs]);

  useEffect(() => {
    if (tab === 'audit') loadAudit(1);
  }, [tab, loadAudit]);

  const toggleUserStatus = async (user: User) => {
    const next = user.accountStatus === 'suspended' ? 'active' : 'suspended';
    setBusyId(user._id);
    try {
      await apiPatch(`/admin/users/${user._id}/status`, { accountStatus: next });
      setUsers((prev) => prev.map((u) => (u._id === user._id ? { ...u, accountStatus: next } : u)));
      toast('success', next === 'suspended' ? 'Account suspended' : 'Account reactivated', `${user.name} (${user.email})`);
    } catch (err) {
      toast('error', 'Could not update account', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const toggleVerified = async (ngo: NGO) => {
    setBusyId(ngo._id);
    try {
      await apiPatch(`/admin/ngos/${ngo._id}/verify`, { verified: !ngo.verified });
      setNgos((prev) => prev.map((n) => (n._id === ngo._id ? { ...n, verified: !n.verified } : n)));
      toast('success', !ngo.verified ? 'NGO verified' : 'Verification revoked', ngo.organizationName);
    } catch (err) {
      toast('error', 'Could not update NGO', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container-x py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Administration</p>
        <h1 className="mt-2 section-title">Platform control centre</h1>
        <p className="section-sub">Review activity, manage accounts and verify organisations.</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === item.id
                ? 'bg-primary-600 text-white shadow-soft'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
            }`}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'overview' && (
          overviewLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
            </div>
          ) : error ? (
            <ErrorCard message={error} onRetry={loadOverview} />
          ) : overview ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric icon={<Users className="h-5 w-5" />} label="Total users" value={overview.users.total} hint={`${overview.users.volunteers} volunteers · ${overview.users.ngoUsers} NGO staff`} />
                <Metric icon={<Building2 className="h-5 w-5" />} label="Organisations" value={overview.ngos.total} hint={`${overview.ngos.verified} verified · ${overview.ngos.pending} pending`} />
                <Metric icon={<CalendarDays className="h-5 w-5" />} label="Upcoming events" value={overview.events.upcoming} hint={`${overview.events.completed} completed`} />
                <Metric icon={<Clock3 className="h-5 w-5" />} label="Verified hours" value={overview.verifiedHours} hint={`${overview.applications.pending} applications awaiting review`} />
              </div>

              <div className="card mt-6 overflow-hidden">
                <div className="border-b border-navy-700/10 px-5 py-4 dark:border-white/10">
                  <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">Newest members</h2>
                </div>
                <ul className="divide-y divide-navy-700/10 dark:divide-white/10">
                  {overview.recentUsers.map((user) => (
                    <li key={user._id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-navy-800 dark:text-slate-200">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="chip bg-slate-100 capitalize text-slate-600 dark:bg-white/10 dark:text-slate-300">{user.role}</span>
                        <span className="text-xs text-slate-400">{formatDate(user.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null
        )}

        {tab === 'users' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-navy-700/10 bg-white p-2 dark:border-white/10 dark:bg-navy-800 sm:max-w-xs">
                <Search className="ml-1 h-4 w-4 text-slate-400" />
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadUsers(1)}
                  placeholder="Search name or email"
                  className="w-full bg-transparent px-1 py-1 text-sm outline-none"
                />
              </div>
              <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="input w-auto">
                <option value="">All roles</option>
                <option value="volunteer">Volunteers</option>
                <option value="ngo">NGO staff</option>
                <option value="admin">Admins</option>
              </select>
              <button type="button" onClick={() => loadUsers(1)} className="btn btn-outline">
                Apply
              </button>
            </div>

            <div className="card mt-4 overflow-hidden">
              {usersLoading ? (
                <div className="p-5"><CardSkeleton /></div>
              ) : users.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No users match these filters.</p>
              ) : (
                <ul className="divide-y divide-navy-700/10 dark:divide-white/10">
                  {users.map((user) => (
                    <li key={user._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium text-navy-800 dark:text-slate-200">
                          {user.name}
                          {user.accountStatus === 'suspended' && (
                            <span className="chip bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300">suspended</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="chip bg-slate-100 capitalize text-slate-600 dark:bg-white/10 dark:text-slate-300">{user.role}</span>
                        {user.role !== 'admin' && (
                          <button
                            type="button"
                            onClick={() => toggleUserStatus(user)}
                            disabled={busyId === user._id}
                            className="btn btn-ghost text-sm"
                          >
                            {busyId === user._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : user.accountStatus === 'suspended' ? (
                              <RotateCcw className="h-4 w-4" />
                            ) : (
                              <Ban className="h-4 w-4" />
                            )}
                            {user.accountStatus === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Pager pagination={usersPagination} page={usersPage} onPage={loadUsers} />
          </>
        )}

        {tab === 'ngos' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <select value={ngoFilter} onChange={(e) => setNgoFilter(e.target.value)} className="input w-auto">
                <option value="">All organisations</option>
                <option value="true">Verified</option>
                <option value="false">Pending verification</option>
              </select>
            </div>

            <div className="card mt-4 overflow-hidden">
              {ngosLoading ? (
                <div className="p-5"><CardSkeleton /></div>
              ) : ngos.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No organisations found.</p>
              ) : (
                <ul className="divide-y divide-navy-700/10 dark:divide-white/10">
                  {ngos.map((ngo) => {
                    const owner = ngo.createdBy as unknown as { name?: string; email?: string } | undefined;
                    return (
                      <li key={ngo._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium text-navy-800 dark:text-slate-200">
                            {ngo.organizationName}
                            {ngo.verified && <BadgeCheck className="h-4 w-4 text-primary-600" />}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {ngo.contactEmail}
                            {owner?.name ? ` · managed by ${owner.name}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleVerified(ngo)}
                          disabled={busyId === ngo._id}
                          className={`btn text-sm ${ngo.verified ? 'btn-outline' : 'btn-primary'}`}
                        >
                          {busyId === ngo._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                          {ngo.verified ? 'Revoke' : 'Verify'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <Pager pagination={ngosPagination} page={ngosPage} onPage={loadNGOs} />
          </>
        )}

        {tab === 'audit' && (
          <>
            <div className="card overflow-hidden">
              {auditLoading ? (
                <div className="p-5"><CardSkeleton /></div>
              ) : audit.length === 0 ? (
                <div className="p-10 text-center">
                  <ClipboardList className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" />
                  <p className="mt-3 text-sm text-slate-500">No recorded activity yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-navy-700/10 dark:divide-white/10">
                  {audit.map((entry) => (
                    <li key={entry._id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-navy-800 dark:text-slate-200">{entry.summary}</p>
                        <span className="text-xs text-slate-400">{formatDate(entry.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {entry.action}
                        {entry.actorName ? ` · ${entry.actorName}` : ''}
                        {entry.actorRole ? ` (${entry.actorRole})` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Pager pagination={auditPagination} page={auditPage} onPage={loadAudit} />
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
          {icon}
        </span>
        <div>
          <p className="font-display text-2xl font-bold text-navy-800 dark:text-white">{value}</p>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        </div>
      </div>
      {hint && <p className="mt-3 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Pager({ pagination, page, onPage }: { pagination: Pagination | null; page: number; onPage: (p: number) => void }) {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-slate-500">
        Page {page} of {pagination.pages}
      </span>
      <div className="flex gap-2">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="btn btn-outline text-sm">
          Previous
        </button>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pagination.pages} className="btn btn-outline text-sm">
          Next
        </button>
      </div>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card p-8 text-center">
      <XCircle className="mx-auto h-9 w-9 text-red-400" />
      <p className="mt-3 font-semibold text-navy-800 dark:text-white">{message}</p>
      <button type="button" onClick={onRetry} className="btn btn-outline mt-4">
        Try again
      </button>
    </div>
  );
}
