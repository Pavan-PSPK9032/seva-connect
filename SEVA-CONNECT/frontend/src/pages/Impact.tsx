import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarCheck,
  Clock,
  HeartHandshake,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { apiGetOne, apiErrorMessage } from '../services/api';
import type { ImpactData } from '../types';
import Spinner from '../components/Spinner';

function Metric({ icon: Icon, label, value, hint }: { icon: typeof UsersRound; label: string; value: string; hint: string }) {
  return (
    <div className="card p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 font-display text-3xl font-bold text-navy-800 dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

export default function Impact() {
  const [data, setData] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetOne<ImpactData>('/stats/impact');
      setData(res.data ?? null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Impact data is unavailable right now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <section className="bg-navy-900 py-16 text-white">
        <div className="container-x flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-400">Measured impact</p>
            <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight sm:text-5xl">
              Every number is <span className="text-primary-400">earned</span>.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-300">
              This page reports live platform activity: completed volunteer engagements, verified hours and the causes
              and communities behind them.
            </p>
          </div>
          <Link to="/leaderboard" className="btn-accent shrink-0">
            View leaderboard
          </Link>
        </div>
      </section>

      <section className="container-x py-12">
        {loading ? (
          <Spinner label="Calculating impact" />
        ) : error || !data ? (
          <div className="card flex flex-col items-center p-12 text-center">
            <Activity className="h-10 w-10 text-red-400" />
            <p className="mt-3 font-semibold text-navy-800 dark:text-white">{error || 'No impact data yet.'}</p>
            <button type="button" onClick={() => void load()} className="btn-outline mt-5">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric icon={Clock} label="Verified hours" value={data.totals.verifiedHours.toLocaleString()} hint="Completed activities only" />
              <Metric icon={CalendarCheck} label="Completed activities" value={data.totals.completedActivities.toLocaleString()} hint="Attendance recorded by NGOs" />
              <Metric icon={UsersRound} label="Active contributors" value={data.totals.activeContributors.toLocaleString()} hint="Volunteers with completed service" />
              <Metric icon={Building2} label="Verified NGOs" value={data.totals.verifiedNgos.toLocaleString()} hint={`${data.totals.ngos} organisations registered`} />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <div className="card p-6 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Verified hours by month</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Last 12 months of completed service</p>
                  </div>
                  <HeartHandshake className="h-5 w-5 text-primary-600" />
                </div>
                <div className="mt-6 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.monthly}>
                      <defs>
                        <linearGradient id="hoursFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="hours" stroke="#059669" fill="url(#hoursFill)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Opportunity outcomes</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">All-time event status</p>
                <dl className="mt-5 space-y-4">
                  {[
                    ['Completed', data.eventStats.completed],
                    ['Upcoming', data.eventStats.upcoming],
                    ['Ongoing', data.eventStats.ongoing],
                    ['Cancelled', data.eventStats.cancelled],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between border-b border-navy-700/10 pb-3 last:border-0 dark:border-white/10">
                      <dt className="text-sm text-slate-600 dark:text-slate-300">{label}</dt>
                      <dd className="font-display text-lg font-semibold text-navy-800 dark:text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-5 rounded-xl bg-primary-50 p-3 text-xs text-primary-800 dark:bg-primary-500/10 dark:text-primary-300">
                  Completion rate: {data.eventStats.completionRate}% of {data.eventStats.total} total opportunities.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="card p-6">
                <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Impact by cause</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Verified hours completed per cause</p>
                {data.byCause.length === 0 ? (
                  <p className="mt-6 text-sm text-slate-500">No completed activities yet.</p>
                ) : (
                  <div className="mt-6 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byCause} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="cause" width={110} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="hours" fill="#0f766e" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="card p-6">
                <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Top NGOs by verified hours</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Based on completed activities only</p>
                {data.topNGOs.length === 0 ? (
                  <p className="mt-6 text-sm text-slate-500">No completed NGO activities yet.</p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {data.topNGOs.map((ngo, index) => (
                      <li key={ngo.ngoId} className="flex items-center gap-3 rounded-xl border border-navy-700/10 p-3 dark:border-white/10">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-700/5 font-display text-sm font-bold text-navy-700 dark:bg-white/10 dark:text-slate-200">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-navy-800 dark:text-white">
                            {ngo.name}
                            {ngo.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary-600" />}
                          </p>
                          <p className="text-xs text-slate-500">{ngo.activities} completed activities</p>
                        </div>
                        <span className="font-display text-sm font-bold text-primary-700 dark:text-primary-300">{ngo.hours} h</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="card p-6">
                <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Where volunteers served</h2>
                <div className="mt-4 space-y-3">
                  {data.byLocation.length === 0 && <p className="text-sm text-slate-500">No completed activities yet.</p>}
                  {data.byLocation.map((row) => (
                    <div key={row.location} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300">{row.location}</span>
                      <span className="font-medium text-navy-800 dark:text-white">{row.hours} h</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-6">
                <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Application activity</h2>
                <div className="mt-6 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.applicationTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="applications" fill="#f97316" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <p className="mt-8 text-xs leading-relaxed text-slate-500">
              {data.notes.source} {data.notes.period} Generated {new Date(data.generatedAt).toLocaleString()}.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
