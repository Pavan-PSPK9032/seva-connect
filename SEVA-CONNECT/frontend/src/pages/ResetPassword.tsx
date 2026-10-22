import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Loader2, Lock, ShieldAlert } from 'lucide-react';
import { apiPost, apiErrorMessage } from '../services/api';

const schema = z
  .object({
    password: z.string().min(6, 'Use at least 6 characters').max(128),
    confirm: z.string().min(1, 'Please confirm your password'),
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

type Form = z.infer<typeof schema>;

export default function ResetPassword() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Form) => {
    setServerError(null);
    try {
      await apiPost<never>('/auth/reset-password', { token, password: values.password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setServerError(apiErrorMessage(err, 'This reset link is invalid or has expired.'));
    }
  };

  return (
    <div className="container-x flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
            <Lock className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-navy-800 dark:text-white">Choose a new password</h1>
          <p className="mt-1 text-sm text-slate-500">Make it at least 6 characters and hard to guess.</p>
        </div>

        {serverError && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p>{serverError}</p>
              <Link to="/forgot-password" className="mt-1 inline-block font-semibold underline">
                Request a new link
              </Link>
            </div>
          </div>
        )}

        {done ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:bg-primary-500/10 dark:text-primary-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Your password has been updated. Redirecting you to the login page…</p>
            </div>
            <Link to="/login" className="btn-primary w-full">
              Go to log in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="password" className="label">New password</label>
              <input id="password" type="password" autoComplete="new-password" className="input" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>
            <div>
              <label htmlFor="confirm" className="label">Confirm password</label>
              <input id="confirm" type="password" autoComplete="new-password" className="input" placeholder="••••••••" {...register('confirm')} />
              {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting || !token} className="btn-primary w-full">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {isSubmitting ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-primary-600 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
