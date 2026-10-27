import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Building2,
  CalendarDays,
  Clock3,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Users,
} from 'lucide-react';
import { apiErrorMessage, apiGetOne } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { AdminReport } from '../../types';
import {
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  StatCard,
  TableSkeleton,
} from './ui';
import { dateRangeSummary, defaultRange, downloadAdminCsv, formatDate } from './utils';

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: '#0b1120',
  color: '#f8fafc',
  fontSize: 12,
  padding: '8px 10px',
};

const EXPORTS: { type: 'users' | 'volunteers' | 'ngos' | 'events' | 'applications'; label: string }[] = [
  { type: 'users', label: 'Users' },
  { type: 'volunteers', label: 'Volunteers' },
  { type: 'ngos', label: 'Organisations' },
  { type: 'events', label: 'Activities' },
  { type: 'applications', label: 'Applications' },
];

function periodLabel(period: string, groupFormat: string): string {
  if (groupFormat === '%Y-%m') {
    const [year, month] = period.split('-').map(Number);
    if (year && month) {
      return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en', {
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
      });
    }
  }
  const date = new Date(`${period}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export default function ReportsSection() {
  const { toast } = useToast();
  const initial = defaultRange(30);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [range, setRange] = useState(initial);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetOne<AdminReport>('/admin/reports', {
        from: range.from || undefined,
        to: range.to || undefined,
      });
      if (!res.data) throw new Error(res.message || 'No report data returned.');
      setReport(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the report.'));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyRange = () => {
    if (!from || !to) {
      toast('error', 'Choose a date range', 'Both start and end dates are required.');
      return;
    }
    if (from > to) {
      toast('error', 'Invalid range', 'The start date must be before the end date.');
      return;
    }
    setRange({ from, to });
  };

  const resetRange = () => {
    const fresh = defaultRange(30);
    setFrom(fresh.from);
    setTo(fresh.to);
    setRange(fresh);
  };

  const runExport = async (type: (typeof EXPORTS)[number]['type']) => {
    setExporting(type);
    try {
      await downloadAdminCsv(type, range);
      toast('success', 'Export ready', `${type} CSV downloaded.`);
    } catch (err) {
      toast('error', 'Export failed', apiErrorMessage(err, 'Could not generate the CSV export.'));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Reporting"
        title="Reports &amp; exports"
        description="Range-based analytics computed from live records. Every export is scoped and audited server-side."
      />

      <div className="card mt-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="From" htmlFor="report-from">
          <input
            id="report-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="input w-auto"
          />
        </Field>
        <Field label="To" htmlFor="report-to">
          <input
            id="report-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="input w-auto"
          />
        </Field>
        <button type="button" onClick={applyRange} className="btn btn-primary text-sm">
          <RefreshCw className="h-4 w-4" /> Update report
        </button>
        <button type="button" onClick={resetRange} className="btn btn-ghost text-sm">
          Last 30 days
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-500">
            <FileSpreadsheet className="mr-1 inline h-3.5 w-3.5" />
            Export
          </span>
          {EXPORTS.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => void runExport(item.type)}
              disabled={exporting !== null}
              className="btn btn-outline text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === item.type ? 'Preparing…' : item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card mt-5">
          <TableSkeleton rows={5} />
        </div>
      ) : error ? (
        <div className="mt-5">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : !report ? (
        <div className="card mt-5">
          <EmptyState title="No report data" description="Adjust the range and try again." />
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs text-slate-500">
            Showing {dateRangeSummary(range.from, range.to)} · {report.range.days} day
            {report.range.days === 1 ? '' : 's'} · grouped by{' '}
            {report.range.groupFormat === '%Y-%m' ? 'month' : 'day'}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="New registrations"
              value={report.registrations.total}
              hint={`${report.registrations.verified} verified · ${report.registrations.unverified} unverified`}
            />
            <StatCard
              icon={<CalendarDays className="h-5 w-5" />}
              label="Applications"
              value={report.participation.applications}
              hint={`${report.participation.approved} approved · ${report.participation.pending} pending`}
              tone="sky"
            />
            <StatCard
              icon={<Clock3 className="h-5 w-5" />}
              label="Verified hours"
              value={report.participation.hours}
              hint={`${report.participation.completed} completed participations`}
            />
            <StatCard
              icon={<Building2 className="h-5 w-5" />}
              label="New organisations"
              value={report.ngos.created}
              hint={`${report.ngos.verified} verified in this period`}
              tone="violet"
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div className="card p-5">
              <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">
                Registrations over time
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {report.registrations.volunteers} volunteers · {report.registrations.ngos} NGO reps ·{' '}
                {report.registrations.admins} admins
              </p>
              <div className="mt-4 h-64">
                {report.series.length === 0 ? (
                  <p className="py-16 text-center text-sm text-slate-500">
                    No registrations in this range.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={report.series.map((point) => ({
                        ...point,
                        label: periodLabel(point.period, report.range.groupFormat),
                      }))}
                      margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="reportRegistrations" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Area
                        type="monotone"
                        dataKey="registrations"
                        name="Registrations"
                        stroke="#10b981"
                        fill="url(#reportRegistrations)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">
                Applications &amp; completions
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {report.participation.completed} completed of {report.participation.applications} applications
              </p>
              <div className="mt-4 h-64">
                {report.series.length === 0 ? (
                  <p className="py-16 text-center text-sm text-slate-500">
                    No applications in this range.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.series.map((point) => ({
                        ...point,
                        label: periodLabel(point.period, report.range.groupFormat),
                      }))}
                      margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="applications"
                        name="Applications"
                        fill="#0ea5e9"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <BreakdownCard
              title="Participation"
              rows={[
                ['Applications', report.participation.applications],
                ['Pending', report.participation.pending],
                ['Approved', report.participation.approved],
                ['Completed', report.participation.completed],
                ['Rejected', report.participation.rejected],
                ['Hours credited', report.participation.hours],
              ]}
            />
            <BreakdownCard
              title="Activities"
              rows={[
                ['Created in range', report.activities.created],
                ['Total records', report.activities.total],
                ['Upcoming', report.activities.upcoming],
                ['Ongoing', report.activities.ongoing],
                ['Completed', report.activities.completed],
                ['Cancelled', report.activities.cancelled],
              ]}
            />
            <BreakdownCard
              title="Registrations by role"
              rows={[
                ['Total', report.registrations.total],
                ['Volunteers', report.registrations.volunteers],
                ['NGO representatives', report.registrations.ngos],
                ['Administrators', report.registrations.admins],
                ['Email verified', report.registrations.verified],
                ['Awaiting verification', report.registrations.unverified],
              ]}
              footer={`Range: ${formatDate(report.range.from)} → ${formatDate(report.range.to)}`}
            />
          </div>
        </>
      )}
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: [string, number][];
  footer?: string;
}) {
  return (
    <div className="card p-5">
      <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">{title}</h2>
      <dl className="mt-3 divide-y divide-navy-700/10 text-sm dark:divide-white/10">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold text-navy-800 dark:text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>
      {footer && <p className="mt-3 text-[11px] text-slate-400">{footer}</p>}
    </div>
  );
}
