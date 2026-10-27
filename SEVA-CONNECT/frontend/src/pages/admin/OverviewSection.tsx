import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock3,
  MailWarning,
  TrendingUp,
  Users,
} from 'lucide-react';
import { apiErrorMessage, apiGetOne } from '../../services/api';
import type { AdminOverview } from '../../types';
import {
  Badge,
  ErrorState,
  PageHeader,
  StatCard,
  StatusBadge,
  TableSkeleton,
} from './ui';
import { formatDate, formatDateTime, humanize, initials } from './utils';

const PIE_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: '#0b1120',
  color: '#f8fafc',
  fontSize: 12,
  padding: '8px 10px',
};

function ChartCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function hasValues(rows: { value: number }[]): boolean {
  return rows.some((row) => row.value > 0);
}

export default function OverviewSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetOne<AdminOverview>('/admin/overview');
      if (!res.data) throw new Error(res.message || 'No overview data returned.');
      setOverview(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Administration" title="Platform overview" description="Live statistics from the database." />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="card h-[7.5rem] animate-pulse bg-slate-100/60 dark:bg-white/5" />
          ))}
        </div>
        <div className="card mt-6">
          <TableSkeleton rows={4} />
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div>
        <PageHeader eyebrow="Administration" title="Platform overview" />
        <div className="mt-6">
          <ErrorState message={error || 'No overview data is available.'} onRetry={load} />
        </div>
      </div>
    );
  }

  const { users, ngos, events, applications, charts } = overview;
  const engagementTotal = charts.engagement.reduce((sum, row) => sum + row.applications, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        description="Every number below is calculated from live records in the database."
        actions={
          <div className="flex flex-wrap gap-2">
            {applications.pending > 0 && (
              <button type="button" onClick={() => onNavigate('applications')} className="btn btn-outline text-sm">
                <ClipboardList className="h-4 w-4" /> {applications.pending} pending
              </button>
            )}
            {ngos.pending > 0 && (
              <button type="button" onClick={() => onNavigate('ngos')} className="btn btn-outline text-sm">
                <BadgeCheck className="h-4 w-4" /> {ngos.pending} verifications
              </button>
            )}
          </div>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Registered users"
          value={users.total}
          hint={`${users.verified} verified · ${users.unverified} awaiting verification`}
        />
        <StatCard
          icon={<BadgeCheck className="h-5 w-5" />}
          label="Active volunteers"
          value={users.volunteers}
          hint={`${users.ngoUsers} NGO representatives · ${users.admins} admins`}
          tone="sky"
        />
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Organisations"
          value={ngos.total}
          hint={`${ngos.verified} verified · ${ngos.pending} pending review`}
          tone="violet"
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Active activities"
          value={events.active}
          hint={`${events.completed} completed · ${events.cancelled} cancelled`}
          tone="amber"
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Applications"
          value={applications.total}
          hint={`${applications.pending} pending · ${applications.approved} approved`}
          tone="sky"
        />
        <StatCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Verified hours"
          value={overview.verifiedHours}
          hint="Hours credited on completed participation"
        />
        <StatCard
          icon={<Award className="h-5 w-5" />}
          label="Certificates issued"
          value={overview.certificates}
          hint="Generated only for completed participation"
          tone="violet"
        />
        <StatCard
          icon={<MailWarning className="h-5 w-5" />}
          label="Unverified accounts"
          value={users.unverified}
          hint={`${users.suspended} suspended account${users.suspended === 1 ? '' : 's'}`}
          tone={users.unverified > 0 ? 'amber' : 'slate'}
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="User growth"
          description="New registrations over the last six months"
          action={<Badge tone="emerald">Live</Badge>}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.userGrowth} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="volunteersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="users" name="All users" stroke="#10b981" fill="url(#usersGradient)" strokeWidth={2} />
                <Area
                  type="monotone"
                  dataKey="volunteers"
                  name="Volunteers"
                  stroke="#0ea5e9"
                  fill="url(#volunteersGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Monthly engagement"
          description={`${engagementTotal} applications in the last six months`}
          action={<TrendingUp className="h-4 w-4 text-primary-600" />}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.engagement} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="applications" name="Applications" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Activity status" description="Distribution of all activities">
          {hasValues(charts.activityStatus) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.activityStatus.filter((row) => row.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={86}
                    paddingAngle={2}
                  >
                    {charts.activityStatus
                      .filter((row) => row.value > 0)
                      .map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">No activities have been created yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Community mix" description="Accounts by role">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={charts.roleBreakdown}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={82} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="value" name="Accounts" radius={[0, 6, 6, 0]}>
                  {charts.roleBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-navy-700/10 px-5 py-4 dark:border-white/10">
            <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">Recent registrations</h2>
            <button
              type="button"
              onClick={() => onNavigate('users')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {overview.recentUsers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No accounts yet.</p>
          ) : (
            <ul className="divide-y divide-navy-700/10 dark:divide-white/10">
              {overview.recentUsers.map((user) => (
                <li key={user._id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                    {initials(user.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy-800 dark:text-slate-200">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={user.role === 'admin' ? 'violet' : user.role === 'ngo' ? 'sky' : 'slate'}>
                      {user.role}
                    </Badge>
                    <span className="text-[11px] text-slate-400">{formatDate(user.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-navy-700/10 px-5 py-4 dark:border-white/10">
            <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">Recent admin activity</h2>
            <button
              type="button"
              onClick={() => onNavigate('audit')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
            >
              Audit log <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {overview.recentActivity.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No privileged actions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-navy-700/10 dark:divide-white/10">
              {overview.recentActivity.map((entry) => (
                <li key={entry._id} className="px-5 py-3">
                  <p className="text-sm font-medium text-navy-800 dark:text-slate-200">{entry.summary}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <StatusBadge status={entry.action.split('.')[0]} />
                    <span>{humanize(entry.action)}</span>
                    {entry.actorName && <span>· {entry.actorName}</span>}
                    <span className="ml-auto text-slate-400">{formatDateTime(entry.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
