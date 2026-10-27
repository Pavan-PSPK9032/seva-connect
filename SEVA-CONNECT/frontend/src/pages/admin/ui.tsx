import {
  useCallback,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, X, XCircle } from 'lucide-react';
import type { Pagination } from '../../types';
import { humanize } from './utils';

/* --------------------------------- Badges --------------------------------- */

type Tone = 'emerald' | 'amber' | 'red' | 'sky' | 'slate' | 'violet';

const TONE_CLASSES: Record<Tone, string> = {
  emerald: 'bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};

export function toneForStatus(status?: string | null): Tone {
  switch ((status || '').toLowerCase()) {
    case 'active':
    case 'approved':
    case 'verified':
    case 'completed':
    case 'published':
    case 'upcoming':
    case 'issued':
      return 'emerald';
    case 'pending':
    case 'draft':
    case 'requested':
    case 'ongoing':
    case 'unverified':
      return 'amber';
    case 'suspended':
    case 'rejected':
    case 'cancelled':
    case 'archived':
    case 'withdrawn':
      return 'red';
    default:
      return 'slate';
  }
}

export function Badge({
  children,
  tone = 'slate',
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={`chip capitalize ${TONE_CLASSES[tone]} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge tone="slate">unknown</Badge>;
  return <Badge tone={toneForStatus(status)}>{humanize(status)}</Badge>;
}

/* -------------------------------- Page header ------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-navy-800 dark:text-white sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------- Stat cards -------------------------------- */

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'emerald',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  const iconClasses: Record<Tone, string> = {
    emerald: 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-navy-800 dark:text-white">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClasses[tone]}`}>
          {icon}
        </span>
      </div>
      {hint && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

/* ---------------------------------- States --------------------------------- */

export function TableSkeleton({ rows = 6, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`divide-y divide-navy-700/10 dark:divide-white/10 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-4 px-5 py-4">
          <div className="h-9 w-9 shrink-0 rounded-full bg-slate-200 dark:bg-white/10" />
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-1/3 rounded bg-slate-200 dark:bg-white/10" />
            <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-white/10" />
          </div>
          <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-12 text-center">
      {icon && (
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-slate-500">
          {icon}
        </span>
      )}
      <p className="mt-4 font-semibold text-navy-800 dark:text-white">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card p-8 text-center" role="alert">
      <XCircle className="mx-auto h-9 w-9 text-red-400" />
      <p className="mt-3 font-semibold text-navy-800 dark:text-white">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-outline mt-4">
          Try again
        </button>
      )}
    </div>
  );
}

export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
    >
      {message}
    </div>
  );
}

export function LoadingButton({
  loading,
  children,
  className = 'btn-primary',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; className?: string }) {
  return (
    <button {...rest} disabled={rest.disabled || loading} className={className}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* -------------------------------- Pagination -------------------------------- */

export function Pager({
  pagination,
  page,
  onPage,
}: {
  pagination: Pagination | null;
  page: number;
  onPage: (page: number) => void;
}) {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <span className="text-slate-500">
        Page {page} of {pagination.pages} · {pagination.total} record{pagination.total === 1 ? '' : 's'}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="btn btn-outline text-sm"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pagination.pages}
          className="btn btn-outline text-sm"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

/* ---------------------------------- Modal ---------------------------------- */

const MODAL_SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
  xl: 'sm:max-w-6xl',
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof MODAL_SIZES;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-navy-950/60 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-navy-700/10 bg-white shadow-card dark:border-white/10 dark:bg-navy-800 sm:rounded-2xl ${MODAL_SIZES[size]}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-navy-700/10 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-navy-700/10 px-5 py-4 dark:border-white/10">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Confirmation ------------------------------ */

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

export function ConfirmDialog({
  open,
  options,
  onResolve,
  loading,
}: {
  open: boolean;
  options: ConfirmOptions | null;
  onResolve: (value: boolean) => void;
  loading?: boolean;
}) {
  if (!open || !options) return null;
  const danger = options.tone !== 'primary';

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={options.title}
        className="w-full max-w-md rounded-2xl border border-navy-700/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-navy-800"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              danger
                ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                : 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">{options.title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{options.message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => onResolve(false)} className="btn btn-outline text-sm">
            {options.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            disabled={loading}
            className={`btn text-sm ${danger ? 'bg-red-600 text-white hover:bg-red-700' : 'btn-primary'}`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {options.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Promise-based confirmation dialog.
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (await confirm({ title, message })) { ... }
 */
export function useConfirm() {
  const [pending, setPending] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);
  const [loading] = useState(false);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve });
      }),
    []
  );

  const resolve = useCallback(
    (value: boolean) => {
      if (pending) pending.resolve(value);
      setPending(null);
    },
    [pending]
  );

  const dialog = (
    <ConfirmDialog
      open={Boolean(pending)}
      options={pending?.options ?? null}
      onResolve={resolve}
      loading={loading}
    />
  );

  return { confirm, dialog };
}

/* -------------------------------- Form field -------------------------------- */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = '',
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* ------------------------------ Filter toolbar ------------------------------ */

export function FilterBar({ children, onReset }: { children: ReactNode; onReset?: () => void }) {
  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
      {children}
      {onReset && (
        <button type="button" onClick={onReset} className="btn btn-ghost text-sm">
          Reset
        </button>
      )}
    </div>
  );
}
