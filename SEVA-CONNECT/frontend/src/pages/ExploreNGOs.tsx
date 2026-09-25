import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Search, SearchX } from 'lucide-react';
import { apiGet, apiErrorMessage } from '../services/api';
import type { NGO } from '../types';
import NGOCard, { NGOCardEmpty } from '../components/NGOCard';
import { GridSkeleton } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';

type VerifiedFilter = 'all' | 'true' | 'false';

export default function ExploreNGOs() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [verified, setVerified] = useState<VerifiedFilter>('all');
  const [ngos, setNgos] = useState<NGO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const params: Record<string, string | undefined> = { limit: '12' };
        if (query.trim()) params.q = query.trim();
        if (verified !== 'all') params.verified = verified;
        const res = await apiGet<NGO>('/ngos', params);
        if (!active) return;
        setNgos(res.data ?? []);
      } catch (err) {
        if (active) {
          setError(apiErrorMessage(err));
          toast('error', 'Could not load NGOs', apiErrorMessage(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [query, verified, toast]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="container-x py-14">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Directory</p>
        <h1 className="mt-2 section-title">Explore NGOs</h1>
        <p className="section-sub">
          Search verified organizations, filter by cause and verification status, and find your next cause.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl border border-navy-700/10 bg-white p-2 shadow-soft sm:max-w-md dark:border-white/10 dark:bg-navy-800">
          <Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, location or cause…"
            className="w-full bg-transparent px-2 py-2 text-sm outline-none"
          />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={verified}
            onChange={(e) => setVerified(e.target.value as VerifiedFilter)}
            className="input w-auto"
            aria-label="Verification status"
          >
            <option value="all">All NGOs</option>
            <option value="true">Verified only</option>
            <option value="false">Pending only</option>
          </select>
        </div>
      </div>

      <div className="mt-10">
        {loading ? (
          <GridSkeleton count={6} />
        ) : error ? (
          <div className="card flex flex-col items-center p-12 text-center">
            <SearchX className="h-10 w-10 text-red-400" />
            <p className="mt-3 font-semibold text-navy-800 dark:text-white">{error}</p>
          </div>
        ) : ngos.length === 0 ? (
          <NGOCardEmpty />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ngos.map((ngo) => (
              <NGOCard key={ngo._id} ngo={ngo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}