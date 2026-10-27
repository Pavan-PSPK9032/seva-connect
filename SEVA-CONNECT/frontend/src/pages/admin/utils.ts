import { api } from '../../services/api';

/** Format an ISO date as "12 Mar 2026" (empty string when absent/invalid). */
export function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format an ISO date with time, e.g. "12 Mar 2026, 14:05". */
export function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** ISO timestamp → `YYYY-MM-DD` for `<input type="date">`. */
export function toDateInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** Default reporting range: the last 30 days, as date-input strings. */
export function defaultRange(days = 30): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { from: toDateInput(from.toISOString()), to: toDateInput(to.toISOString()) };
}

export function dateRangeSummary(from?: string, to?: string): string {
  const parts = [from ? formatDate(from) : '', to ? formatDate(to) : ''].filter(Boolean);
  return parts.length === 2 ? `${parts[0]} → ${parts[1]}` : parts[0] || '';
}

/** Human label for audit/status tokens: `application_approved` → `application approved`. */
export function humanize(value?: string): string {
  if (!value) return '';
  return value.replace(/[_.-]+/g, ' ').trim();
}

export function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ngoNameFromEvent(event: {
  ngoName?: string;
  ngoId?: string | { organizationName?: string };
}): string {
  if (event.ngoName) return event.ngoName;
  if (event.ngoId && typeof event.ngoId === 'object') return event.ngoId.organizationName || '';
  return '';
}

/**
 * Download a CSV export from the admin API.
 *
 * Authorization and personal-data scope are enforced server-side; this helper
 * only turns the authenticated response into a browser download.
 */
export async function downloadAdminCsv(
  type: 'users' | 'volunteers' | 'ngos' | 'events' | 'applications',
  range?: { from?: string; to?: string }
): Promise<void> {
  const res = await api.get('/admin/export', {
    params: { type, from: range?.from || undefined, to: range?.to || undefined },
    responseType: 'blob',
  });

  const url = URL.createObjectURL(res.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `seva-connect-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
