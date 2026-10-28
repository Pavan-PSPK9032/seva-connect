import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth, apiErrorMessage } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Role } from '../types';

interface VerifyState {
  email?: string;
  justRegistered?: boolean;
  resendAfterSeconds?: number;
  expiresInSeconds?: number;
  from?: string;
}

const CODE_LENGTH = 6;
const EXPIRY_SECONDS = 5 * 60;
const DEFAULT_COOLDOWN = 60;
const PENDING_EMAIL_KEY = 'sc_pending_email';

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function homeForRole(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'ngo') return '/my-ngo';
  return '/dashboard';
}

export default function VerifyEmail() {
  const auth = useAuth() as any;
  const verifyEmail = auth.verifyEmail;
  const resendVerification = auth.resendVerification;
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as VerifyState | null) || {};

  const [email, setEmail] = useState(
    () => state.email || (typeof window !== 'undefined' ? sessionStorage.getItem(PENDING_EMAIL_KEY) || '' : '')
  );
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(state.resendAfterSeconds ?? DEFAULT_COOLDOWN);
  const [expiresIn, setExpiresIn] = useState(state.expiresInSeconds ?? EXPIRY_SECONDS);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const verifyingRef = useRef(false);

  const code = useMemo(() => digits.join(''), [digits]);
  const expired = expiresIn <= 0;

  useEffect(() => {
    if (email) sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  }, [email]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
      setExpiresIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const setDigit = (index: number, value: string) => {
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    setError(null);

    if (!cleaned) {
      setDigit(index, '');
      return;
    }

    // Typing or pasting several digits fills the remaining inputs.
    const chars = cleaned.slice(0, CODE_LENGTH - index).split('');
    setDigits((current) => {
      const next = [...current];
      chars.forEach((char, offset) => {
        if (index + offset < CODE_LENGTH) next[index + offset] = char;
      });
      return next;
    });

    const nextIndex = Math.min(CODE_LENGTH - 1, index + chars.length);
    inputs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      setDigit(index - 1, '');
      inputs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setDigits(pasted.split('').concat(Array(CODE_LENGTH - pasted.length).fill('')));
    inputs.current[Math.min(CODE_LENGTH - 1, pasted.length)]?.focus();
    setError(null);
  };

  const submit = useCallback(async () => {
    // A ref, not state: the auto-submit effect and a fast double click can both
    // fire before React re-renders with `verifying = true`.
    if (verifyingRef.current) return;
    if (!email) {
      setError('Enter the email address you registered with.');
      return;
    }
    if (code.length !== CODE_LENGTH) {
      setError('Enter all six digits of the code.');
      return;
    }

    verifyingRef.current = true;
    setVerifying(true);
    setError(null);
    setInfo(null);
    try {
      const user = await verifyEmail?.(email, code);
      if (!user) { setError('Verification not available'); verifyingRef.current = false; setVerifying(false); return; }
      sessionStorage.removeItem(PENDING_EMAIL_KEY);
      toast('success', 'Email verified', `Welcome to Seva Connect, ${user.name.split(' ')[0]}.`);
      navigate(state.from || homeForRole(user.role), { replace: true });
    } catch (err) {
      const message = apiErrorMessage(err, 'We could not verify that code. Please try again.');
      const data = (err as {
        response?: {
          data?: { code?: string; attemptsRemaining?: number; retryAfter?: number; email?: string };
        };
      })?.response?.data;
      const errorCode = data?.code;

      if (errorCode === 'OTP_INVALID' && typeof data?.attemptsRemaining === 'number') {
        setError(
          `${message} ${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? '' : 's'} remaining.`
        );
      } else if (errorCode === 'OTP_EXPIRED') {
        // The server refuses the old code; the countdown must stop claiming it
        // is still valid and the person must request a fresh one.
        setExpiresIn(0);
        setError(message);
      } else if (errorCode === 'OTP_LOCKED') {
        setExpiresIn(0);
        setError(message);
      } else if (errorCode === 'EMAIL_TAKEN' || errorCode === 'ACCOUNT_SUSPENDED') {
        // Terminal states: retyping the code cannot help, so point the person
        // at the right next step instead of leaving them in a retry loop.
        setError(message);
        if (data?.email) setEmail(data.email);
      } else {
        setError(message);
      }

      if (data?.retryAfter) setCooldown(data.retryAfter);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  }, [code, email, navigate, state.from, toast, verifyEmail]);

  // Verify automatically once all six digits are present. The ref inside
  // submit() prevents a duplicate request when the effect re-runs.
  useEffect(() => {
    if (code.length === CODE_LENGTH && !expired) {
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    if (cooldown > 0 || !email) return;
    if (!resendVerification) {
      setError('Email verification is no longer required. Please sign in.');
      return;
    }
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const result = await resendVerification(email);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
      setCooldown(result.retryAfter ?? DEFAULT_COOLDOWN);
      setExpiresIn(result.expiresInSeconds ?? EXPIRY_SECONDS);
      setInfo(result.message || 'A new code has been sent. Previous codes are no longer valid.');
      toast('success', 'New code sent', 'The previous code has been invalidated.');
    } catch (err) {
      const message = apiErrorMessage(err, 'We could not resend the code right now.');
      const retryAfter = (err as { response?: { data?: { retryAfter?: number } } })?.response?.data?.retryAfter;
      if (retryAfter) setCooldown(retryAfter);
      setError(message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="container-x flex justify-center py-14">
      <div className="card w-full max-w-lg p-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
            <MailCheck className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-navy-800 dark:text-white">Verify your email</h1>
          <p className="mt-2 text-sm text-slate-500">
            Enter the six-digit code we sent to{' '}
            <span className="font-semibold text-navy-700 dark:text-slate-200">{email || 'your email address'}</span>.
          </p>
          {!email && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              We could not read the address from this page. Type it below to continue.
            </p>
          )}
        </div>

        {!email && (
          <div className="mt-6">
            <label htmlFor="verify-email" className="label">Email address</label>
            <input
              id="verify-email"
              type="email"
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value.trim())}
            />
          </div>
        )}

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}
        {info && (
          <div role="status" className="mt-5 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-200">
            {info}
          </div>
        )}
        {expired && !error && (
          <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            This code has expired. Request a new one to finish verifying your email.
          </div>
        )}

        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          <fieldset>
            <legend className="sr-only">Six-digit verification code</legend>
            <div className="flex justify-center gap-2 sm:gap-3">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputs.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  pattern="\d*"
                  maxLength={CODE_LENGTH}
                  value={digit}
                  aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
                  className="h-12 w-11 rounded-xl border border-navy-700/20 bg-white text-center text-xl font-bold tracking-widest text-navy-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 sm:h-14 sm:w-12 dark:border-white/15 dark:bg-navy-900 dark:text-white"
                  onChange={(event) => handleChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={handlePaste}
                  aria-invalid={Boolean(error)}
                />
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={verifying || code.length !== CODE_LENGTH || expired}
            className="btn-primary mt-6 w-full"
          >
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {verifying ? 'Verifying…' : expired ? 'Code expired' : 'Verify email'}
          </button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => void resend()}
            disabled={resending || cooldown > 0 || !email}
            className="btn-outline w-full"
          >
            {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {cooldown > 0 ? `Resend code in ${formatTime(cooldown)}` : 'Resend code'}
          </button>
          <p className="text-xs text-slate-500">
            {expired
              ? 'Request a new code to continue — older codes cannot be used.'
              : <>The code expires in <span className="font-semibold">{formatTime(expiresIn)}</span>. Older codes stop working when you resend.</>}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-navy-700/10 pt-4 text-sm dark:border-white/10">
          <Link to="/register" className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Change email
          </Link>
          <Link to="/login" className="font-medium text-slate-500 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
