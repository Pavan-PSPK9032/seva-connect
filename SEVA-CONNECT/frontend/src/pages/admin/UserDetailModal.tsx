import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BadgeCheck,
  Ban,
  CalendarDays,
  Clock3,
  Loader2,
  MailWarning,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { apiErrorMessage, apiGetOne, apiPatch } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { AdminUserDetail, Role } from '../../types';
import {
  Badge,
  ErrorState,
  Field,
  Modal,
  StatusBadge,
  TableSkeleton,
  useConfirm,
} from './ui';
import { formatDate, formatDateTime, humanize, initials } from './utils';

const ROLES: Role[] = ['volunteer', 'ngo', 'admin'];

export default function UserDetailModal({
  userId,
  currentUserId,
  onClose,
  onChanged,
}: {
  userId: string | null;
  currentUserId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Role>('volunteer');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetOne<AdminUserDetail>(`/admin/users/${userId}`);
      if (!res.data) throw new Error(res.message || 'User not found.');
      setDetail(res.data);
      setRole(res.data.user.role);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this user.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void load();
    else {
      setDetail(null);
      setError(null);
    }
  }, [userId, load]);

  const isSelf = detail?.user._id === currentUserId;

  const changeStatus = async () => {
    if (!detail) return;
    const next = detail.user.accountStatus === 'suspended' ? 'active' : 'suspended';
    const ok = await confirm({
      title: next === 'suspended' ? 'Suspend this account?' : 'Reactivate this account?',
      message:
        next === 'suspended'
          ? `${detail.user.name} will be signed out and blocked from protected features until reactivated.`
          : `${detail.user.name} will regain access to their dashboard and applications.`,
      confirmLabel: next === 'suspended' ? 'Suspend account' : 'Reactivate',
      tone: next === 'suspended' ? 'danger' : 'primary',
    });
    if (!ok) return;

    setBusy(true);
    try {
      await apiPatch(`/admin/users/${detail.user._id}/status`, { accountStatus: next });
      toast('success', next === 'suspended' ? 'Account suspended' : 'Account reactivated', detail.user.email);
      await load();
      onChanged();
    } catch (err) {
      toast('error', 'Could not change account status', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async () => {
    if (!detail || role === detail.user.role) return;
    const ok = await confirm({
      title: `Change role to ${role}?`,
      message: `${detail.user.name} (${detail.user.email}) will receive ${role} permissions immediately. Administrators must sign in again for the new role to apply.`,
      confirmLabel: 'Update role',
      tone: role === 'admin' ? 'danger' : 'primary',
    });
    if (!ok) return;

    setBusy(true);
    try {
      await apiPatch(`/admin/users/${detail.user._id}/role`, { role });
      toast('success', 'Role updated', `${detail.user.email} is now ${role}.`);
      await load();
      onChanged();
    } catch (err) {
      toast('error', 'Could not change role', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={Boolean(userId)}
        title="User profile"
        description="Account details, participation and administrative controls."
        onClose={onClose}
        size="lg"
        footer={
          detail ? (
            <>
              <button type="button" onClick={onClose} className="btn btn-outline text-sm">
                Close
              </button>
              {!isSelf && (
                <>
                  <button
                    type="button"
                    onClick={() => void changeStatus()}
                    disabled={busy}
                    className={`btn text-sm ${
                      detail.user.accountStatus === 'suspended'
                        ? 'btn-primary'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : detail.user.accountStatus === 'suspended' ? (
                      <RotateCcw className="h-4 w-4" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                    {detail.user.accountStatus === 'suspended' ? 'Reactivate' : 'Suspend'}
                  </button>
                </>
              )}
            </>
          ) : null
        }
      >
        {loading ? (
          <TableSkeleton rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : detail ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-lg font-bold text-white">
                {initials(detail.user.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold text-navy-800 dark:text-white">{detail.user.name}</p>
                <p className="truncate text-sm text-slate-500">{detail.user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={detail.user.role === 'admin' ? 'violet' : detail.user.role === 'ngo' ? 'sky' : 'slate'}>
                    {detail.user.role}
                  </Badge>
                  <StatusBadge status={detail.user.accountStatus || 'active'} />
                  <Badge tone={detail.user.emailVerified === false ? 'amber' : 'emerald'}>
                    {detail.user.emailVerified === false ? (
                      <>
                        <MailWarning className="h-3 w-3" /> unverified
                      </>
                    ) : (
                      <>
                        <BadgeCheck className="h-3 w-3" /> verified
                      </>
                    )}
                  </Badge>
                  {isSelf && <Badge tone="violet">this is you</Badge>}
                </div>
              </div>
            </div>

            <dl className="grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Phone</dt>
                <dd className="mt-0.5 text-navy-800 dark:text-slate-200">{detail.user.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Location</dt>
                <dd className="mt-0.5 text-navy-800 dark:text-slate-200">{detail.user.location || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Registered</dt>
                <dd className="mt-0.5 text-navy-800 dark:text-slate-200">{formatDateTime(detail.user.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Last login</dt>
                <dd className="mt-0.5 text-navy-800 dark:text-slate-200">
                  {detail.user.lastLoginAt ? formatDateTime(detail.user.lastLoginAt) : 'Never'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Email verified</dt>
                <dd className="mt-0.5 text-navy-800 dark:text-slate-200">
                  {detail.user.emailVerifiedAt ? formatDateTime(detail.user.emailVerifiedAt) : 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Skills</dt>
                <dd className="mt-0.5 flex flex-wrap gap-1 text-navy-800 dark:text-slate-200">
                  {detail.user.skills && detail.user.skills.length > 0
                    ? detail.user.skills.map((skill) => (
                        <span key={skill} className="chip bg-white text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {skill}
                        </span>
                      ))
                    : '—'}
                </dd>
              </div>
            </dl>

            <div className="grid gap-3 sm:grid-cols-4">
              <MiniStat label="Applications" value={detail.stats.applications} />
              <MiniStat label="Approved" value={detail.stats.approved} />
              <MiniStat label="Completed" value={detail.stats.completed} />
              <MiniStat label="Hours" value={detail.stats.hours} icon={<Clock3 className="h-3.5 w-3.5" />} />
            </div>

            {!isSelf && (
              <div className="rounded-2xl border border-navy-700/10 p-4 dark:border-white/10">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy-800 dark:text-white">
                  <ShieldCheck className="h-4 w-4 text-primary-600" /> Role assignment
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Role changes are checked server-side. The last active administrator cannot be demoted.
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Field label="Account role" htmlFor="admin-role">
                    <select
                      id="admin-role"
                      value={role}
                      onChange={(event) => setRole(event.target.value as Role)}
                      className="input w-auto"
                    >
                      {ROLES.map((item) => (
                        <option key={item} value={item}>
                          {humanize(item)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    type="button"
                    onClick={() => void changeRole()}
                    disabled={busy || role === detail.user.role}
                    className="btn btn-outline text-sm"
                  >
                    Update role
                  </button>
                </div>
              </div>
            )}

            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-800 dark:text-white">
                <CalendarDays className="h-4 w-4 text-primary-600" /> Applications ({detail.applications.length})
              </h3>
              {detail.applications.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No applications recorded.</p>
              ) : (
                <ul className="mt-3 divide-y divide-navy-700/10 rounded-xl border border-navy-700/10 dark:divide-white/10 dark:border-white/10">
                  {detail.applications.map((application) => (
                    <li key={application._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy-800 dark:text-slate-200">
                          {application.event?.title || 'Activity'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Applied {formatDate(application.createdAt)}
                          {application.event?.date ? ` · event ${formatDate(application.event.date)}` : ''}
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

            {detail.ngos.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-navy-800 dark:text-white">Organisations</h3>
                <ul className="mt-2 space-y-2">
                  {detail.ngos.map((ngo) => (
                    <li
                      key={ngo._id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-700/10 px-4 py-2.5 dark:border-white/10"
                    >
                      <span className="text-sm text-navy-800 dark:text-slate-200">{ngo.organizationName}</span>
                      <span className="flex items-center gap-2">
                        <StatusBadge status={ngo.status || 'active'} />
                        <Badge tone={ngo.verified ? 'emerald' : 'amber'}>{ngo.verified ? 'verified' : 'unverified'}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
      {dialog}
    </>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-navy-700/10 p-3 dark:border-white/10">
      <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-500">
        {icon} {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold text-navy-800 dark:text-white">{value}</p>
    </div>
  );
}
