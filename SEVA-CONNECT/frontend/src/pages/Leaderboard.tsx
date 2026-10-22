import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Clock, Info, Medal, RefreshCw, Trophy, UsersRound } from 'lucide-react';
import { apiGetOne, apiErrorMessage } from '../services/api';
import type { LeaderboardData } from '../types';
import Spinner from '../components/Spinner';

type Period = 'all' | 'month' | 'week';

const PERIODS: { value: Period; label: string; hint: string }[] = [
  { value: 'all', label: 'All time', hint: 'Every completed activity' },
  { value: 'month', label: 'Last 30 days', hint: 'Recent service' },
  { value: 'week', label: 'Last 7 days', hint: 'This week' },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>('all');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextPeriod: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetOne<LeaderboardData>('/stats/leaderboard', { period: nextPeriod, limit: 25 });
      setData(res.data ?? null);
    } catch (err) {
      setError(apiErrorMessage(err, 'The leaderboard is unavailable right now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(period);
  }, [period]);

  const podium = data?.entries.slice(0, 3) ?? [];

  return (
    <div>
      <section className="bg-navy-900 py-16 text-white">
        <div className="container-x">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-400">Volunteer leaderboard</p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            Celebrating <span className="text-primary-400">verified service</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            Rankings use approved, completed activities and the hours credited by NGOs. No estimates, no purchased
            points, no hidden weighting.
          </p>
        </div>
      </section>

      <section className="container-x py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-navy-700/10 bg-white p-1 dark:border-white/10 dark:bg-navy-800">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  period === item.value
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
                title={item.hint}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void load(period)} className="btn-ghost !px-3" aria-label="Refresh leaderboard">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {loading ? (
          <Spinner label="Loading rankings" />
        ) : error || !data ? (
          <div className="card mt-8 flex flex-col items-center p-12 text-center">
            <Trophy className="h-10 w-10 text-red-400" />
            <p className="mt-3 font-semibold text-navy-800 dark:text-white">{error || 'No rankings available.'}</p>
          </div>
        ) : data.entries.length === 0 ? (
          <div className="card mt-8 flex flex-col items-center p-12 text-center">
            <Trophy className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="mt-3 font-display font-semibold text-navy-800 dark:text-white">No verified hours in this period yet</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Rankings appear after NGOs mark volunteer activities complete. Be the first by joining an opportunity.
            </p>
            <Link to="/events" className="btn-primary mt-5">Explore opportunities</Link>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {podium.map((entry, index) => (
                <div
                  key={entry.volunteerId}
                  className={`card relative p-6 text-center ${
                    index === 0 ? 'border-primary-400/60 ring-2 ring-primary-500/20' : ''
                  }`}
                >
                  <div className="absolute right-4 top-4 text-slate-300 dark:text-slate-600">
                    {index === 0 ? <Trophy className="h-6 w-6 text-accent-500" /> : <Medal className="h-6 w-6" />}
                  </div>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-500 to-navy-700 font-display text-lg font-bold text-white">
                    {entry.profileImage ? (
                      <img src={entry.profileImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials(entry.name)
                    )}
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-primary-600">Rank {entry.rank}</p>
                  <h2 className="mt-1 font-display text-lg font-semibold text-navy-800 dark:text-white">{entry.name}</h2>
                  {entry.location && <p className="text-xs text-slate-500">{entry.location}</p>}
                  <p className="mt-4 font-display text-3xl font-bold text-primary-700 dark:text-primary-300">{entry.hours}</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">verified hours</p>
                  <p className="mt-2 text-sm text-slate-500">{entry.activities} completed activities</p>
                </div>
              ))}
            </div>

            <div className="card mt-6 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-700/10 p-5 dark:border-white/10">
                <div className="flex items-center gap-2 font-display font-semibold text-navy-800 dark:text-white">
                  <Award className="h-5 w-5 text-primary-600" /> All ranked volunteers
                </div>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" /> {data.totalParticipants} participants</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {data.totalHours} total hours</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-navy-700/5 text-xs uppercase tracking-wider text-slate-500 dark:bg-white/5">
                    <tr>
                      <th className="px-5 py-3">Rank</th>
                      <th className="px-5 py-3">Volunteer</th>
                      <th className="px-5 py-3">Location</th>
                      <th className="px-5 py-3 text-right">Activities</th>
                      <th className="px-5 py-3 text-right">Verified hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/10 dark:divide-white/10">
                    {data.entries.map((entry) => (
                      <tr key={entry.volunteerId} className="hover:bg-navy-700/[0.03] dark:hover:bg-white/[0.03]">
                        <td className="px-5 py-3 font-display font-semibold text-navy-700 dark:text-slate-200">#{entry.rank}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
                              {entry.profileImage ? <img src={entry.profileImage} alt="" className="h-full w-full object-cover" /> : initials(entry.name)}
                            </span>
                            <span className="font-medium text-navy-800 dark:text-white">{entry.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{entry.location || '—'}</td>
                        <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{entry.activities}</td>
                        <td className="px-5 py-3 text-right font-semibold text-primary-700 dark:text-primary-300">{entry.hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-navy-700/10 bg-white p-5 text-sm text-slate-600 sm:flex-row sm:items-start dark:border-white/10 dark:bg-navy-800 dark:text-slate-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
              <div>
                <p>{data.scoring}</p>
                <Link to="/profile" className="mt-2 inline-block font-medium text-primary-700 hover:underline dark:text-primary-300">
                  Manage leaderboard visibility in your profile
                </Link>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
