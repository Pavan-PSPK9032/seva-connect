import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, KeyRound, Loader2, MailCheck } from 'lucide-react';
import { apiPost, apiErrorMessage } from '../services/api';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type Form = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Form) => {
    setServerError(null);
    try {
      const res = await apiPost<never>('/auth/forgot-password', values);
      setSent(true);
      setDevLink(res.devResetUrl || null);
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Could not send the reset link. Please try again.'));
    }
  };

  return (
    <div className="container-x flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
            <KeyRound className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-navy-800 dark:text-white">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the email you registered with and we will send a secure reset link.
          </p>
        </div>

        {serverError && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {serverError}
          </div>
        )}

        {sent ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:bg-primary-500/10 dark:text-primary-200">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p>If an account exists for that address, a reset link is on its way. It expires in 30 minutes.</p>
            </div>
            {devLink && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <p className="font-semibold">Development mode</p>
                <p className="mt-1 break-all">No mail provider is configured, so use this link:</p>
                <Link to={devLink.replace(/^https?:\/\/[^/]+/, '')} className="mt-1 inline-block font-semibold underline">
                  Open reset link
                </Link>
              </div>
            )}
            <Link to="/login" className="btn-outline w-full">
              <ArrowLeft className="h-4 w-4" /> Back to log in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" autoComplete="email" className="input" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
