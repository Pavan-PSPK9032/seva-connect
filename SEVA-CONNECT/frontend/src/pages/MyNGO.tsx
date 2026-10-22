import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth, apiErrorMessage } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
import type { Application, ApplicationStatus, EventItem, NGO } from '../types';
import Spinner from '../components/Spinner';

function splitList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ---------------------------------- NGO form ---------------------------------- */

const ngoSchema = z.object({
  organizationName: z.string().trim().min(2, 'Organization name is required').max(100),
  description: z.string().trim().min(10, 'Describe the NGO (min 10 characters)').max(2000),
  location: z.string().trim().min(2, 'Location is required'),
  contactEmail: z.string().trim().email('Enter a valid email'),
  causes: z.string().trim().optional(),
  website: z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
  logo: z.string().trim().url('Enter a valid image URL').optional().or(z.literal('')),
});

type NGOForm = z.infer<typeof ngoSchema>;

const emptyNgo = { organizationName: '', description: '', location: '', contactEmail: '', causes: '', website: '', logo: '' };

function toNgoForm(ngo: NGO): NGOForm {
  return {
    organizationName: ngo.organizationName,
    description: ngo.description,
    location: ngo.location,
    contactEmail: ngo.contactEmail,
    causes: (ngo.causes || []).join(', '),
    website: ngo.website || '',
    logo: ngo.logo || '',
  };
}

function NGOFormCard({
  initial,
  onCancel,
  onSave,
}: {
  initial: NGOForm;
  onCancel: () => void;
  onSave: (values: NGOForm) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NGOForm>({ resolver: zodResolver(ngoSchema), defaultValues: initial });

  return (
    <form onSubmit={handleSubmit(onSave)} noValidate className="card space-y-4 border-primary-500/40 p-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-navy-800 dark:text-white">
          <Building2 className="h-5 w-5 text-primary-600" /> {initial.organizationName ? 'Edit NGO' : 'Add new NGO'}
        </h3>
        <button type="button" onClick={onCancel} className="btn-ghost !px-2"><X className="h-4 w-4" /></button>
      </div>

      <div>
        <label className="label">Organization name</label>
        <input className="input" {...register('organizationName')} placeholder="Hope Foundation" />
        {errors.organizationName && <p className="mt-1 text-xs text-red-600">{errors.organizationName.message}</p>}
      </div>

      <div>
        <label className="label">Description</label>
        <textarea className="input min-h-24" {...register('description')} placeholder="What does this NGO do?" />
        {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Location</label>
          <input className="input" {...register('location')} placeholder="Delhi, India" />
          {errors.location && <p className="mt-1 text-xs text-red-600">{errors.location.message}</p>}
        </div>
        <div>
          <label className="label">Contact email</label>
          <input className="input" type="email" {...register('contactEmail')} placeholder="ngo@example.org" />
          {errors.contactEmail && <p className="mt-1 text-xs text-red-600">{errors.contactEmail.message}</p>}
        </div>
      </div>

      <div>
        <label className="label">Causes (comma separated)</label>
        <input className="input" {...register('causes')} placeholder="Education, Health, Environment" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Website</label>
          <input className="input" {...register('website')} placeholder="https://…" />
          {errors.website && <p className="mt-1 text-xs text-red-600">{errors.website.message}</p>}
        </div>
        <div>
          <label className="label">Logo URL</label>
          <input className="input" {...register('logo')} placeholder="https://…" />
          {errors.logo && <p className="mt-1 text-xs text-red-600">{errors.logo.message}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save NGO
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------- Event form --------------------------------- */

const eventSchema = z.object({
  title: z.string().trim().min(3, 'Event title is required').max(120),
  description: z.string().trim().min(10, 'Event description is required').max(3000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  time: z.string().trim().min(1, 'Time is required'),
  location: z.string().trim().min(2, 'Location is required'),
  online: z.boolean().optional(),
  causes: z.string().trim().optional(),
  requiredVolunteers: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().int().min(1, 'At least 1 volunteer').max(10000).optional()
  ),
  requiredSkills: z.string().trim().optional(),
  eligibility: z.string().trim().max(500, 'Keep eligibility under 500 characters').optional(),
  applicationDeadline: z.string().trim().optional(),
  status: z.string().optional(),
  ngoId: z.string().min(1, 'Choose the NGO hosting the event'),
});

type EventForm = z.infer<typeof eventSchema>;

const emptyEvent = {
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  online: false,
  causes: '',
  requiredVolunteers: undefined,
  requiredSkills: '',
  eligibility: '',
  applicationDeadline: '',
  status: 'upcoming',
  ngoId: '',
};

function toEventForm(ev: EventItem): EventForm {
  return {
    title: ev.title,
    description: ev.description,
    date: ev.date?.slice(0, 10) || '',
    time: ev.time || '',
    location: ev.location,
    online: Boolean(ev.online),
    causes: (ev.causes || []).join(', '),
    requiredVolunteers: ev.requiredVolunteers,
    requiredSkills: (ev.requiredSkills || []).join(', '),
    eligibility: ev.eligibility || '',
    applicationDeadline: ev.applicationDeadline?.slice(0, 10) || '',
    status: ev.status || 'upcoming',
    ngoId: typeof ev.ngoId === 'string' ? ev.ngoId : ev.ngoId?._id || '',
  };
}

function EventFormCard({
  initial,
  ownedNgos,
  onCancel,
  onSave,
}: {
  initial: EventForm;
  ownedNgos: NGO[];
  onCancel: () => void;
  onSave: (values: EventForm) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventForm>({ resolver: zodResolver(eventSchema), defaultValues: initial });

  return (
    <form onSubmit={handleSubmit(onSave)} noValidate className="card space-y-4 border-primary-500/40 p-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-navy-800 dark:text-white">
          <CalendarDays className="h-5 w-5 text-primary-600" /> {initial.title ? 'Edit event' : 'Add new event'}
        </h3>
        <button type="button" onClick={onCancel} className="btn-ghost !px-2"><X className="h-4 w-4" /></button>
      </div>

      <div>
        <label className="label">Title</label>
        <input className="input" {...register('title')} placeholder="River clean-up drive" />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
      </div>

      <div>
        <label className="label">Description</label>
        <textarea className="input min-h-20" {...register('description')} placeholder="What will volunteers do?" />
        {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" {...register('date')} />
          {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>}
        </div>
        <div>
          <label className="label">Time</label>
          <input className="input" type="time" {...register('time')} />
          {errors.time && <p className="mt-1 text-xs text-red-600">{errors.time.message}</p>}
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" {...register('status')}>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Location</label>
          <input className="input" {...register('location')} placeholder="Yamuna Bank, Delhi" />
          {errors.location && <p className="mt-1 text-xs text-red-600">{errors.location.message}</p>}
        </div>
        <div>
          <label className="label">Required volunteers</label>
          <input className="input" type="number" min={1} {...register('requiredVolunteers')} placeholder="25" />
          {errors.requiredVolunteers && <p className="mt-1 text-xs text-red-600">{errors.requiredVolunteers.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Causes (comma separated)</label>
          <input className="input" {...register('causes')} placeholder="Environment" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pt-6 text-sm font-medium text-navy-700 dark:text-slate-200">
          <input type="checkbox" className="h-4 w-4 accent-primary-600" {...register('online')} />
          Online event
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Required skills (comma separated)</label>
          <input className="input" {...register('requiredSkills')} placeholder="Teaching, First aid" />
        </div>
        <div>
          <label className="label">Application deadline</label>
          <input className="input" type="date" {...register('applicationDeadline')} />
          {errors.applicationDeadline && <p className="mt-1 text-xs text-red-600">{errors.applicationDeadline.message}</p>}
        </div>
      </div>

      <div>
        <label className="label">Eligibility</label>
        <textarea className="input min-h-20" {...register('eligibility')} placeholder="Who can apply? Any requirements, age limits or training?" />
        {errors.eligibility && <p className="mt-1 text-xs text-red-600">{errors.eligibility.message}</p>}
      </div>

      <div>
        <label className="label">Hosting NGO</label>
        <select className="input" {...register('ngoId')}>
          <option value="">Select an NGO…</option>
          {ownedNgos.map((n) => (
            <option key={n._id} value={n._id}>{n.organizationName}</option>
          ))}
        </select>
        {errors.ngoId && <p className="mt-1 text-xs text-red-600">{errors.ngoId.message}</p>}
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save event
        </button>
      </div>
    </form>
  );
}

/* ------------------------------- Applicants ------------------------------- */

const APP_STATUS_STYLE: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  approved: 'bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  withdrawn: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  completed: 'bg-navy-100 text-navy-800 dark:bg-white/10 dark:text-white',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
};

function EventApplicants({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Application[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hours, setHours] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await apiGet<Application>(`/applications/event/${eventId}`);
      setItems(res.data ?? []);
    } catch (err) {
      toast('error', 'Could not load applicants', apiErrorMessage(err));
      setItems([]);
    }
  }, [eventId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (application: Application, status: 'approved' | 'rejected' | 'completed') => {
    setBusyId(application._id);
    try {
      await apiPatch(`/applications/${application._id}/status`, {
        status,
        ...(status === 'completed' ? { hoursCredited: Number(hours[application._id] ?? 0) || 0 } : {}),
      });
      toast(
        'success',
        `Application ${status}`,
        application.volunteer?.name ? `${application.volunteer.name} has been notified.` : undefined
      );
      await load();
    } catch (err) {
      toast('error', 'Could not update application', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (!items) {
    return <p className="px-5 py-4 text-sm text-slate-500">Loading applicants…</p>;
  }
  if (items.length === 0) {
    return <p className="px-5 py-4 text-sm text-slate-500">No applications for this event yet.</p>;
  }

  return (
    <ul className="divide-y divide-navy-700/10 dark:divide-white/10">
      {items.map((application) => {
        const volunteer = application.volunteer;
        const busy = busyId === application._id;
        return (
          <li key={application._id} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-800 dark:text-slate-200">
                  {volunteer?.name ?? 'Volunteer'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {volunteer?.email}
                  {volunteer?.phone ? ` · ${volunteer.phone}` : ''}
                </p>
                {volunteer?.skills && volunteer.skills.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {volunteer.skills.slice(0, 6).map((skill) => (
                      <span key={skill} className="rounded-full bg-navy-700/5 px-2 py-0.5 text-[11px] font-medium text-navy-600 dark:bg-white/10 dark:text-slate-300">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className={`chip capitalize ${APP_STATUS_STYLE[application.status]}`}>{application.status}</span>
            </div>

            {application.coverNote && (
              <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
                “{application.coverNote}”
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {application.status === 'pending' && (
                <>
                  <button type="button" onClick={() => decide(application, 'approved')} disabled={busy} className="btn-primary !px-3 !py-1.5 text-sm">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                  </button>
                  <button type="button" onClick={() => decide(application, 'rejected')} disabled={busy} className="btn-outline !px-3 !py-1.5 text-sm">
                    <X className="h-4 w-4" /> Reject
                  </button>
                </>
              )}
              {application.status === 'approved' && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-500">
                    Hours
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={hours[application._id] ?? ''}
                      onChange={(e) => setHours((prev) => ({ ...prev, [application._id]: e.target.value }))}
                      className="input w-20 !py-1.5"
                      placeholder="0"
                    />
                  </label>
                  <button type="button" onClick={() => decide(application, 'completed')} disabled={busy} className="btn-primary !px-3 !py-1.5 text-sm">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Mark completed
                  </button>
                </>
              )}
              {application.status === 'completed' && application.hoursCredited > 0 && (
                <span className="text-xs text-slate-500">{application.hoursCredited} verified hour(s)</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ----------------------------------- Page ----------------------------------- */

export default function MyNGO() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [ngos, setNgos] = useState<NGO[] | null>(null);
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ngoForm, setNgoForm] = useState<(NGOForm & { _id?: string }) | null>(null);
  const [eventForm, setEventForm] = useState<(EventForm & { _id?: string }) | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationNote, setVerificationNote] = useState('');
  const [verificationBusy, setVerificationBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ngoRes, eventRes] = await Promise.all([
        apiGet<NGO>('/ngos/mine'),
        apiGet<EventItem>('/events/mine'),
      ]);
      setNgos(ngoRes.data ?? []);
      setEvents(eventRes.data ?? []);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your organizations.'));
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (!user || (user.role !== 'ngo' && user.role !== 'admin')) {
    return (
      <div className="container-x max-w-xl py-20 text-center">
        <p className="text-lg font-semibold text-navy-800 dark:text-white">This area is for NGO representatives.</p>
        <p className="mt-2 text-sm text-slate-500">Register an NGO account to add organizations and manage events.</p>
      </div>
    );
  }

  const saveNgo = async (values: NGOForm) => {
    try {
      if (ngoForm?._id) {
        await apiPatch<NGO>(`/ngos/${ngoForm._id}`, { ...values, causes: splitList(values.causes) });
        toast('success', 'NGO updated');
      } else {
        await apiPost<NGO>('/ngos', { ...values, causes: splitList(values.causes) });
        toast('success', 'NGO submitted — pending verification');
      }
      setNgoForm(null);
      await load();
    } catch (err) {
      toast('error', 'Save failed', apiErrorMessage(err, 'Could not save the NGO.'));
    }
  };

  const deleteNgo = async (ngo: NGO) => {
    if (!window.confirm(`Delete "${ngo.organizationName}" and all its events? This cannot be undone.`)) return;
    try {
      await apiDelete(`/ngos/${ngo._id}`);
      toast('success', 'NGO removed');
      if (eventForm?.ngoId === ngo._id) setEventForm(null);
      await load();
    } catch (err) {
      toast('error', 'Delete failed', apiErrorMessage(err, 'Could not delete the NGO.'));
    }
  };

  const startVerification = (ngo: NGO) => {
    setVerifyingId(ngo._id);
    setVerificationNote(ngo.verificationNote || '');
  };

  const submitVerification = async (ngo: NGO) => {
    setVerificationBusy(true);
    try {
      await apiPatch(`/ngos/${ngo._id}/request-verification`, { note: verificationNote.trim() });
      toast('success', 'Verification requested', 'An administrator will review your organisation.');
      setVerifyingId(null);
      setVerificationNote('');
      await load();
    } catch (err) {
      toast('error', 'Could not request verification', apiErrorMessage(err));
    } finally {
      setVerificationBusy(false);
    }
  };

  const saveEvent = async (values: EventForm) => {
    try {
      const payload = {
        ...values,
        causes: splitList(values.causes),
        requiredSkills: splitList(values.requiredSkills),
        eligibility: values.eligibility || '',
        applicationDeadline: values.applicationDeadline || null,
        online: Boolean(values.online),
      };
      if (eventForm?._id) {
        await apiPatch<EventItem>(`/events/${eventForm._id}`, payload);
        toast('success', 'Event updated');
      } else {
        await apiPost<EventItem>('/events', payload);
        toast('success', 'Event created');
      }
      setEventForm(null);
      await load();
    } catch (err) {
      toast('error', 'Save failed', apiErrorMessage(err, 'Could not save the event.'));
    }
  };

  const deleteEvent = async (ev: EventItem) => {
    if (!window.confirm(`Delete the event "${ev.title}"?`)) return;
    try {
      await apiDelete(`/events/${ev._id}`);
      toast('success', 'Event removed');
      await load();
    } catch (err) {
      toast('error', 'Delete failed', apiErrorMessage(err, 'Could not delete the event.'));
    }
  };

  if (!ngos || !events) {
    return error ? (
      <div className="container-x max-w-xl py-20 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" onClick={() => void load()} className="btn-outline mt-4">Try again</button>
      </div>
    ) : (
      <div className="container-x max-w-4xl py-20"><Spinner /></div>
    );
  }

  return (
    <div className="container-x max-w-4xl space-y-10 py-14">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800 dark:text-white">Manage your organizations</h1>
          <p className="mt-1 text-sm text-slate-500">Add NGOs and post volunteering events to reach volunteers.</p>
        </div>
        <button type="button" onClick={() => setNgoForm(ngoForm ? null : emptyNgo)} className="btn-primary shrink-0">
          <Plus className="h-4 w-4" /> {ngoForm ? 'Close' : 'New NGO'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {ngoForm && <NGOFormCard initial={ngoForm} onCancel={() => setNgoForm(null)} onSave={saveNgo} />}

      <section className="space-y-4">
        {ngos.length === 0 && !ngoForm && (
          <div className="card p-10 text-center text-slate-500 dark:text-slate-400">
            <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-navy-700 dark:text-slate-200">No NGOs yet</p>
            <p className="mt-1 text-sm">Create your first organization to start posting events.</p>
            <button type="button" onClick={() => setNgoForm(emptyNgo)} className="btn-primary mx-auto mt-4">
              <Plus className="h-4 w-4" /> New NGO
            </button>
          </div>
        )}

        {ngos.map((ngo) => (
          <article key={ngo._id} className="card flex flex-wrap items-start justify-between gap-4 p-6">
            <div className="flex items-start gap-4">
              {ngo.logo ? (
                <img src={ngo.logo} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
                  <Building2 className="h-7 w-7" />
                </span>
              )}
              <div>
                <h2 className="font-display text-lg font-bold text-navy-800 dark:text-white">{ngo.organizationName}</h2>
                <p className="mt-0.5 text-sm text-slate-500">{ngo.location}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ngo.causes.map((c) => (
                    <span key={c} className="rounded-full bg-navy-700/5 px-2.5 py-0.5 text-xs font-medium capitalize text-navy-600 dark:bg-white/10 dark:text-slate-300">{c}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={ngo.verified
                  ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : ngo.verificationRequested
                    ? 'rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
                    : 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}
              >
                {ngo.verified ? 'Verified' : ngo.verificationRequested ? 'Verification requested' : 'Pending review'}
              </span>
              <Link to={`/ngos/${ngo._id}`} className="btn-outline !px-3 !py-2" title="View public page">
                <ExternalLink className="h-4 w-4" />
              </Link>
              {!ngo.verified && (
                <button
                  type="button"
                  onClick={() => startVerification(ngo)}
                  className="btn-outline !px-3 !py-2"
                  title={ngo.verificationRequested ? 'Update verification request' : 'Request verification'}
                >
                  <BadgeCheck className="h-4 w-4" /> {ngo.verificationRequested ? 'Update request' : 'Request verification'}
                </button>
              )}
              <button type="button" onClick={() => setNgoForm({ ...toNgoForm(ngo), _id: ngo._id })} className="btn-outline !px-3 !py-2" title="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => void deleteNgo(ngo)} className="btn-outline !px-3 !py-2 !text-red-600" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {verifyingId === ngo._id && (
              <div className="w-full rounded-xl border border-primary-500/30 bg-primary-50/50 p-4 dark:bg-primary-500/5">
                <label htmlFor={`verification-${ngo._id}`} className="label">
                  Verification information (optional)
                </label>
                <textarea
                  id={`verification-${ngo._id}`}
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                  maxLength={1000}
                  className="input min-h-24"
                  placeholder="Registration number, website, references, or anything that helps an administrator verify your organisation."
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setVerifyingId(null)} className="btn-ghost">Cancel</button>
                  <button
                    type="button"
                    onClick={() => void submitVerification(ngo)}
                    disabled={verificationBusy}
                    className="btn-primary"
                  >
                    {verificationBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send request
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-navy-800 dark:text-white">Your events</h2>
          <button type="button" onClick={() => setEventForm(eventForm ? null : { ...emptyEvent, ngoId: ngos[0]?._id || '' })} className="btn-primary" disabled={ngos.length === 0} title={ngos.length === 0 ? 'Create an NGO first' : undefined}>
            <Plus className="h-4 w-4" /> {eventForm ? 'Close' : 'New event'}
          </button>
        </div>

        {ngos.length === 0 && (
          <p className="rounded-xl bg-navy-700/5 px-4 py-3 text-sm text-navy-600 dark:bg-white/5 dark:text-slate-300">
            Create an NGO above before adding events.
          </p>
        )}

        {eventForm && <EventFormCard initial={eventForm} ownedNgos={ngos} onCancel={() => setEventForm(null)} onSave={saveEvent} />}

        {events.length === 0 && !eventForm && (
          <div className="card p-10 text-center text-slate-500 dark:text-slate-400">
            <CalendarDays className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-navy-700 dark:text-slate-200">No events yet</p>
            <p className="mt-1 text-sm">Post your first volunteering event.</p>
          </div>
        )}

        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev._id} className="card overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold text-navy-800 dark:text-white">{ev.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {ev.ngoName} · {ev.date?.slice(0, 10)} at {ev.time} · {ev.online ? 'Online' : ev.location}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {ev.registeredVolunteers ?? 0} of {ev.requiredVolunteers ?? 0} seats filled
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedEvent(expandedEvent === ev._id ? null : ev._id)}
                    className="btn-ghost !px-3 !py-2 text-sm"
                  >
                    <UserRound className="h-4 w-4" /> Applicants
                  </button>
                  <span className="rounded-full bg-navy-700/5 px-2.5 py-1 text-xs font-semibold capitalize text-navy-600 dark:bg-white/10 dark:text-slate-300">{ev.status}</span>
                  <button type="button" onClick={() => setEventForm({ ...toEventForm(ev), _id: ev._id })} className="btn-outline !px-3 !py-2" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => void deleteEvent(ev)} className="btn-outline !px-3 !py-2 !text-red-600" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {expandedEvent === ev._id && (
                <div className="border-t border-navy-700/10 bg-slate-50/50 dark:border-white/10 dark:bg-white/[0.02]">
                  <EventApplicants eventId={ev._id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}