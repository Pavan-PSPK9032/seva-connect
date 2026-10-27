import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ScrollText, Search, ShieldCheck } from 'lucide-react';
import { apiErrorMessage, apiGet } from '../../services/api';
import type { AuditEntry, Pagination, Role } from '../../types';
import {
  Badge,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Pager,
  StatusBadge,
  TableSkeleton,
} from './ui';
import { formatDateTime, humanize } from './utils';

const ENTITY_TYPES = [
  'User',
  'NGO',
  'Event',
  'Application',
  'Announcement',
  'Report',
  'PlatformSetting',
];

const ROLES: Role[] = ['volunteer', 'ngo', 'admin'];

interface Filters {
  q: string;
  actorRole: string;
  entityType: string;
  action: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  q: '',
  actorRole: '',
  entityType: '',
  action: '',
  from: '',
  to: '',
};

function actionTone(action: string): 'emerald' | 'amber' | 'red' | 'sky' | 'violet' | 'slate' {
  if (/(delete|suspend|reject|cancel|revoke|unverified)/i.test(action)) return 'red';
  if (/(publish|verify|approve|complete|create|assign)/i.test(action)) return 'emerald';
  if (/(update|role|archive|profile)/i.test(action)) return 'amber';
  if (/(report|export|view)/i.test(action)) return 'sky';
  if (/session|security/.test(action)) return 'violet';
  return 'slate';
}

export default function AuditSection() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<AuditEntry>('/admin/audit', {
        page,
        limit: 25,
        q: filters.q.trim() || undefined,
        actorRole: filters.actorRole || undefined,
        entityType: filters.entityType || undefined,
        action: filters.action.trim() || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      setItems(res.data ?? []);
      setPagination(res.pagination ?? null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the audit log.'));
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
    setFilters(EMPTY_FILTERS);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Accountability"
        title="Audit log"
        description="Every privileged action is recorded server-side with the actor, entity and timestamp. Entries cannot be edited from the panel."
      />

      <div className="mt-5">
        <FilterBar onReset={reset}>
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="audit-search" className="label">
              Search
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-navy-700/15 bg-white px-3 dark:border-white/15 dark:bg-navy-900">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                id="audit-search"
                value={draft.q}
                onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    apply();
                  }
                }}
                placeholder="Summary, actor or action"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="audit-actor" className="label">
              Actor role
            </label>
            <select
              id="audit-actor"
              value={draft.actorRole}
              onChange={(event) => setDraft({ ...draft, actorRole: event.target.value })}
              className="input w-auto"
            >
              <option value="">Any role</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {humanize(role)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="audit-entity" className="label">
              Entity
            </label>
            <select
              id="audit-entity"
              value={draft.entityType}
              onChange={(event) => setDraft({ ...draft, entityType: event.target.value })}
              className="input w-auto"
            >
              <option value="">Any entity</option>
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="audit-action" className="label">
              Action
            </label>
            <input
              id="audit-action"
              value={draft.action}
              onChange={(event) => setDraft({ ...draft, action: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && apply()}
              placeholder="e.g. user.suspended"
              className="input w-40"
            />
          </div>
          <div>
            <label htmlFor="audit-from" className="label">
              From
            </label>
            <input
              id="audit-from"
              type="date"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
              className="input w-auto"
            />
          </div>
          <div>
            <label htmlFor="audit-to" className="label">
              To
            </label>
            <input
              id="audit-to"
              type="date"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
              className="input w-auto"
            />
          </div>
          <button type="button" onClick={apply} className="btn btn-primary text-sm">
            Apply filters
          </button>
        </FilterBar>
      </div>

      <div className="card mt-4 overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-6 w-6" />}
            title="No audit entries match these filters"
            description="Privileged actions such as suspensions, role changes and exports appear here."
            action={
              <button type="button" onClick={reset} className="btn btn-outline text-sm">
                Clear filters
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-navy-700/10 dark:divide-white/10">
            {items.map((entry) => {
              const open = expanded === entry._id;
              const meta = entry.meta && Object.keys(entry.meta).length > 0 ? entry.meta : null;
              return (
                <li key={entry._id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={actionTone(entry.action)}>{humanize(entry.action)}</Badge>
                        <Badge tone="slate">{humanize(entry.entityType)}</Badge>
                        {entry.actorRole === 'admin' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-300">
                            <ShieldCheck className="h-3 w-3" /> admin
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm text-navy-800 dark:text-slate-200">{entry.summary}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.actorName || 'System'}
                        {entry.actorRole ? ` · ${entry.actorRole}` : ''}
                        {entry.ip ? ` · ${entry.ip}` : ''} · {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                    {meta && (
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : entry._id)}
                        aria-expanded={open}
                        className="btn btn-ghost text-xs"
                      >
                        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        Details
                      </button>
                    )}
                  </div>
                  {open && meta && (
                    <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      {JSON.stringify(meta, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Pager pagination={pagination} page={page} onPage={setPage} />
    </div>
  );
}
