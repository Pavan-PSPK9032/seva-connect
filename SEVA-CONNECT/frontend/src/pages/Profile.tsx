import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock, Heart, Link2, Loader2, MapPin, Save, ShieldCheck, UserCircle2 } from 'lucide-react';
import { useAuth, apiErrorMessage } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiPatch } from '../services/api';
import Spinner from '../components/Spinner';
import GoogleSignInButton from '../components/GoogleSignInButton';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  phone: z.string().trim().max(30, 'Phone number is too long').optional().or(z.literal('')),
  profileImage: z.string().trim().url('Must be a valid URL').optional().or(z.literal('')),
  location: z.string().trim().max(100, 'Location is too long').optional().or(z.literal('')),
  availability: z.string().trim().max(120, 'Availability is too long').optional().or(z.literal('')),
  skills: z.string().trim().optional(),
  interests: z.string().trim().optional(),
  preferredCauses: z.string().trim().optional(),
  leaderboardOptOut: z.boolean().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function Profile() {
  const { user, refreshUser, linkGoogle } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        phone: user.phone || '',
        profileImage: user.profileImage || '',
        location: user.location || '',
        availability: user.availability || '',
        skills: (user.skills || []).join(', '),
        interests: (user.interests || []).join(', '),
        preferredCauses: (user.preferredCauses || []).join(', '),
        leaderboardOptOut: Boolean(user.leaderboardOptOut),
      });
    }
  }, [user, reset]);

  const values = watch();

  if (!user) return <Spinner />;

  const completenessFields = [
    values.name,
    values.phone,
    values.location,
    values.availability,
    values.skills,
    values.interests,
    values.preferredCauses,
    values.profileImage,
  ];
  const completeness = Math.round(
    (completenessFields.filter((value) => String(value || '').trim().length > 0).length / completenessFields.length) *
      100
  );

  const onSubmit = async (data: ProfileForm) => {
    setServerError(null);
    setSaving(true);
    try {
      const res = await apiPatch('/users/me', {
        name: data.name,
        phone: data.phone || '',
        profileImage: data.profileImage || '',
        location: data.location || '',
        availability: data.availability || '',
        skills: data.skills ? splitList(data.skills) : [],
        interests: data.interests ? splitList(data.interests) : [],
        preferredCauses: data.preferredCauses ? splitList(data.preferredCauses) : [],
        leaderboardOptOut: Boolean(data.leaderboardOptOut),
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

  const handleLinkGoogle = async (credential: string, nonce: string) => {
    setGoogleError(null);
    try {
      await linkGoogle(credential, nonce);
      toast('success', 'Google linked', 'You can now sign in with Continue with Google.');
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not link Google. Please try again.');
      setGoogleError(message);
      toast('error', 'Google link failed', message);
    }
  };

  return (
    <div className="container-x max-w-3xl py-14">
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-xl font-bold text-white">
          {user.profileImage ? (
            <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
          ) : (
            user.name
              .split(' ')
              .map((p) => p.charAt(0))
              .slice(0, 2)
              .join('')
              .toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-navy-800 dark:text-white">Your profile</h1>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
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
        <div className="w-full sm:w-48">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Profile completeness</span>
            <span className="font-semibold text-primary-700 dark:text-primary-300">{completeness}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${completeness}%` }} />
          </div>
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
            <input id="phone" className="input" placeholder="+91 98765 43210" {...register('phone')} />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="label">Email (cannot be changed)</label>
          <input id="email" value={user.email} disabled className="input cursor-not-allowed bg-navy-700/5 opacity-70 dark:bg-white/5" />
        </div>

        <div>
          <label htmlFor="profileImage" className="label">Profile image URL</label>
          <input id="profileImage" className="input" placeholder="https://example.com/photo.jpg" {...register('profileImage')} />
          {errors.profileImage && <p className="mt-1 text-xs text-red-600">{errors.profileImage.message}</p>}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="location" className="label">Location</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="location" className="input !pl-9" placeholder="City, State" {...register('location')} />
            </div>
            {errors.location && <p className="mt-1 text-xs text-red-600">{errors.location.message}</p>}
          </div>
          <div>
            <label htmlFor="availability" className="label">Availability</label>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="availability" className="input !pl-9" placeholder="Weekends, weekday evenings" {...register('availability')} />
            </div>
            {errors.availability && <p className="mt-1 text-xs text-red-600">{errors.availability.message}</p>}
          </div>
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

        <div>
          <label htmlFor="preferredCauses" className="label">Preferred causes (comma separated)</label>
          <div className="relative">
            <Heart className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id="preferredCauses" className="input !pl-9" placeholder="Education, Environment, Health" {...register('preferredCauses')} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Used only to rank recommended opportunities; it does not affect your applications.</p>
        </div>

        {user.role === 'volunteer' && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-700/10 p-4 dark:border-white/10">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-primary-600" {...register('leaderboardOptOut')} />
            <span>
              <span className="block text-sm font-medium text-navy-800 dark:text-white">Hide me from the public leaderboard</span>
              <span className="mt-0.5 block text-xs text-slate-500">Your hours still count for certificates and your own dashboard.</span>
            </span>
          </label>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={() => reset()} className="btn-ghost">Reset</button>
          <button type="submit" disabled={isSubmitting || saving} className="btn-primary">
            {isSubmitting || saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </button>
        </div>
      </form>

      <section className="card mt-6 p-7" aria-labelledby="google-link-heading">
        <h2
          id="google-link-heading"
          className="flex items-center gap-2 font-display text-lg font-bold text-navy-800 dark:text-white"
        >
          <Link2 className="h-4 w-4" /> Google sign-in
        </h2>
        {user.googleLinked ? (
          <p className="mt-2 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
            Google is linked to this account. You can sign in with either your password or{' '}
            <strong>Continue with Google</strong>.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Link Google to sign in faster. The Google account email must match{' '}
              <span className="font-semibold">{user.email}</span>; for security, linking is only
              available while you are signed in with your password.
            </p>
            <div className="mt-4 max-w-sm">
              <GoogleSignInButton
                onCredential={handleLinkGoogle}
                onError={setGoogleError}
                text="continue_with"
              />
            </div>
            {googleError && (
              <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
                {googleError}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
