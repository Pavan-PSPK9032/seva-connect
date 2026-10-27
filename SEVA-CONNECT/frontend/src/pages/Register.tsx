import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, HeartHandshake, Loader2, MailCheck, ShieldAlert, UserPlus } from 'lucide-react';
import { useAuth, apiErrorMessage } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import type { Role } from '../types';

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter at least 2 characters').max(60, 'Keep it under 60 characters'),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/, 'Enter a valid phone number (optional)').optional().or(z.literal('')),
    role: z.enum(['volunteer', 'ngo'], { message: 'Choose an account type' }),
    password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Keep it under 128 characters'),
    confirm: z.string(),
    skills: z.string().optional(),
    acceptTerms: z.literal(true, {
      message: 'Please accept the terms and privacy policy to continue',
    }),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

function homeForRole(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'ngo') return '/my-ngo';
  return '/dashboard';
}

export default function Register() {
  const { register: registerAccount, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [smtpUnavailable, setSmtpUnavailable] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'volunteer', acceptTerms: false as unknown as true },
  });

  const termsAccepted = watch('acceptTerms');

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null);
    setConflict(false);
    setSmtpUnavailable(false);
    const skills = values.skills
      ? values.skills.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    try {
      const result = await registerAccount({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone || undefined,
        role: values.role,
        skills,
        acceptTerms: values.acceptTerms,
      });
      toast('success', 'Check your email', `We sent a six-digit code to ${result.email}.`);
      navigate('/verify-email', {
        replace: true,
        state: {
          email: result.email,
          expiresInSeconds: result.expiresInSeconds ?? 5 * 60,
          resendAfterSeconds: result.resendAfterSeconds ?? 60,
          justRegistered: true,
        },
      });
    } catch (err) {
      const message = apiErrorMessage(err, 'Registration failed. Please try again.');
      const status = (err as { response?: { status?: number } })?.response?.status;
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;

      // An existing but unverified account continues on the verification screen
      // instead of being told to log in.
      if (code === 'EMAIL_NOT_VERIFIED') {
        toast('info', 'Verify your email', message);
        navigate('/verify-email', { replace: true, state: { email: values.email } });
        return;
      }

      // Form values stay in react-hook-form, so a retry does not require
      // retyping anything after a mail outage.
      if (code === 'EMAIL_DELIVERY_FAILED' || code === 'EMAIL_NOT_CONFIGURED') {
        setSmtpUnavailable(true);
      }

      setConflict(status === 409);
      setServerError(message);
      toast('error', 'Registration failed', message);
    }
  };

  const handleGoogle = async (credential: string, nonce: string) => {
    setServerError(null);
    setConflict(false);
    setSmtpUnavailable(false);
    try {
      const result = await loginWithGoogle(credential, nonce, true);
      toast(
        'success',
        result.isNewUser ? 'Account created' : 'Welcome back',
        result.isNewUser
          ? `You are signed in as ${result.user.email}.`
          : `Signed in as ${result.user.email}.`
      );
      navigate(homeForRole(result.user.role), { replace: true });
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      const message = apiErrorMessage(err, 'Google sign-in failed. Please try again.');
      if (code === 'GOOGLE_LINK_REQUIRED') {
        setConflict(true);
        toast('info', 'Use your password once', message);
      } else {
        toast('error', 'Google sign-in failed', message);
      }
      setServerError(message);
    }
  };

  return (
    <div className="container-x flex justify-center py-14">
      <div className="card w-full max-w-xl p-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
            <HeartHandshake className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-navy-800 dark:text-white">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Volunteers and NGOs both start here.</p>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-primary-50 px-3 py-2 text-xs text-primary-800 dark:bg-primary-500/10 dark:text-primary-200">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            We&apos;ll email a six-digit code to confirm your address. Your account is created only
            after the code is verified.
          </p>
        </div>

        {serverError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          >
            <p>{serverError}</p>
            {smtpUnavailable && (
              <p className="mt-2 flex items-start gap-2 text-xs">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Email delivery is temporarily unavailable. Your details are still filled in —
                wait a few minutes and select <strong>Create account</strong> again.
              </p>
            )}
            {conflict && (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                <Link to="/login" className="underline underline-offset-2">
                  Log in instead
                </Link>
                <Link to="/forgot-password" className="underline underline-offset-2">
                  Reset your password
                </Link>
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="label">Full name</label>
            <input id="name" type="text" autoComplete="name" className="input" placeholder="Asha Kumar" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" autoComplete="email" className="input" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label htmlFor="phone" className="label">Phone (optional)</label>
              <input id="phone" type="tel" autoComplete="tel" className="input" placeholder="+91 98765 43210" {...register('phone')} />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
            </div>
          </div>

          <div>
            <span className="label">I want to join as</span>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-navy-700/15 p-3 text-sm font-medium has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 has-[:checked]:text-primary-700 dark:border-white/15 dark:has-[:checked]:bg-primary-500/10 dark:has-[:checked]:text-primary-300">
                <input type="radio" value="volunteer" className="accent-primary-600" {...register('role')} />
                Volunteer
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-navy-700/15 p-3 text-sm font-medium has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 has-[:checked]:text-primary-700 dark:border-white/15 dark:has-[:checked]:bg-primary-500/10 dark:has-[:checked]:text-primary-300">
                <input type="radio" value="ngo" className="accent-primary-600" {...register('role')} />
                NGO organization
              </label>
            </div>
            {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
          </div>

          <div>
            <label htmlFor="skills" className="label">Skills (optional, comma separated)</label>
            <input id="skills" type="text" className="input" placeholder="Teaching, Healthcare, Design" {...register('skills')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="input pr-11"
                  placeholder="Min 6 characters"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:text-slate-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>
            <div>
              <label htmlFor="confirm" className="label">Confirm password</label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="input pr-11"
                  placeholder="Repeat password"
                  {...register('confirm')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:text-slate-200"
                  aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm.message}</p>}
            </div>
          </div>

          <div>
            <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-primary-600" {...register('acceptTerms')} />
              <span>
                I agree to the{' '}
                <Link to="/terms" className="font-semibold text-primary-600 hover:underline" target="_blank">
                  terms of use
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="font-semibold text-primary-600 hover:underline" target="_blank">
                  privacy policy
                </Link>
                .
              </span>
            </label>
            {errors.acceptTerms && <p className="mt-1 text-xs text-red-600">{errors.acceptTerms.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {isSubmitting ? 'Sending verification code…' : 'Create account'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-navy-700/10 dark:bg-white/10" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or</span>
          <span className="h-px flex-1 bg-navy-700/10 dark:bg-white/10" />
        </div>

        <GoogleSignInButton
          onCredential={handleGoogle}
          disabled={!termsAccepted || isSubmitting}
          text="signup_with"
        />

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
