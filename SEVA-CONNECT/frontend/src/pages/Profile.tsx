import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, ShieldCheck, UserCircle2 } from 'lucide-react';
import { useAuth, apiErrorMessage } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiPatch } from '../services/api';
import Spinner from '../components/Spinner';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  phone: z.string().trim().max(30, 'Phone number is too long').optional().or(z.literal('')),
  profileImage: z
    .string()
    .trim()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
  skills: z.string().trim().optional(),
  interests: z.string().trim().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        phone: user.phone || '',
        profileImage: user.profileImage || '',
        skills: (user.skills || []).join(', '),
        interests: (user.interests || []).join(', '),
      });
    }
  }, [user, reset]);

  if (!user) return <Spinner />;

  const onSubmit = async (values: ProfileForm) => {
    setServerError(null);
    setSaving(true);
    try {
      const res = await apiPatch('/users/me', {
        name: values.name,
        phone: values.phone || '',
        profileImage: values.profileImage || '',
        skills: values.skills ? splitList(values.skills) : [],
        interests: values.interests ? splitList(values.interests) : [],
      });
      if (!res.success) throw new Error(res.message || 'Update failed');
      await refreshUser();
      toast('success', 'Profile updated');
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not update your profile.');
      setServerError(message);
      toast('error', 'Update failed', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-x max-w-3xl py-14">
      <div className="mb-8 flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-xl font-bold text-white">
          {user.name
            .split(' ')
            .map((p) => p.charAt(0))
            .slice(0, 2)
            .join('')
            .toUpperCase()}
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800 dark:text-white">Your profile</h1>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-navy-700/5 px-2.5 py-0.5 text-xs font-semibold capitalize text-navy-600 dark:bg-white/10 dark:text-slate-300">
              <UserCircle2 className="h-3.5 w-3.5" /> {user.role}
            </span>
            {user.role !== 'volunteer' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                <ShieldCheck className="h-3.5 w-3.5" /> can manage content
              </span>
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-7">
        {serverError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {serverError}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="label">Full name</label>
            <input id="name" className="input" placeholder="Your name" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="phone" className="label">Phone</label>
            <input id="phone" className="input" placeholder="+91 …" {...register('phone')} />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="label">Email (cannot be changed)</label>
          <input id="email" value={user.email} disabled className="input cursor-not-allowed bg-navy-700/5 opacity-70 dark:bg-white/5" />
        </div>

        <div>
          <label htmlFor="profileImage" className="label">Profile image URL</label>
          <input id="profileImage" className="input" placeholder="https://…" {...register('profileImage')} />
          {errors.profileImage && <p className="mt-1 text-xs text-red-600">{errors.profileImage.message}</p>}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="skills" className="label">Skills (comma separated)</label>
            <input id="skills" className="input" placeholder="Teaching, Coding, Fundraising" {...register('skills')} />
            {errors.skills && <p className="mt-1 text-xs text-red-600">{errors.skills.message}</p>}
          </div>
          <div>
            <label htmlFor="interests" className="label">Interests (comma separated)</label>
            <input id="interests" className="input" placeholder="Education, Wildlife, Health" {...register('interests')} />
            {errors.interests && <p className="mt-1 text-xs text-red-600">{errors.interests.message}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={() => reset()} className="btn-ghost">Reset</button>
          <button type="submit" disabled={isSubmitting || saving} className="btn-primary">
            {isSubmitting || saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}