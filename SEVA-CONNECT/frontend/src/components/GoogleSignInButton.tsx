import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface GoogleSignInButtonProps {
  /** Called with the raw Google ID token and the nonce sent to Google. */
  onCredential: (credential: string, nonce: string) => Promise<void> | void;
  onError?: (message: string) => void;
  /** Rendered button label; GIS supports these texts only. */
  text?: 'continue_with' | 'signup_with' | 'signin_with' | 'signin';
  disabled?: boolean;
  /** Optional override for tests/storybook; defaults to VITE_GOOGLE_CLIENT_ID. */
  clientId?: string;
}

const GIS_SCRIPT_ID = 'seva-google-gsi';
let gisPromise: Promise<void> | null = null;
/** GIS keeps one global instance per page, so initialize it once. */
let initializedClientId = '';
let pageNonce = '';
let credentialSink: ((response: { credential?: string }) => void) | null = null;

function getPageNonce(): string {
  if (!pageNonce) pageNonce = makeNonce();
  return pageNonce;
}

function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google sign-in needs a browser.'));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;

  gisPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('Could not load Google sign-in. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });

  return gisPromise;
}

function makeNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function GoogleGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.5-8 19.5-20 0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

/**
 * Official Google Identity Services button.
 *
 * The GIS script renders the button into a local container. The button text is
 * controlled by Google (it is a Google-branded control), while the surrounding
 * page keeps the Seva Connect styling. The ID token is verified server-side;
 * this component only obtains it.
 */
export default function GoogleSignInButton({
  onCredential,
  onError,
  text = 'continue_with',
  disabled = false,
  clientId,
}: GoogleSignInButtonProps) {
  const resolvedClientId =
    clientId || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [nonce] = useState<string>(getPageNonce);
  const credentialHandlerRef = useRef(onCredential);
  const errorHandlerRef = useRef(onError);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  credentialHandlerRef.current = onCredential;
  errorHandlerRef.current = onError;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !resolvedClientId || disabled) return;

    let cancelled = false;

    const handleCredential = async (response: { credential?: string }) => {
      if (cancelled) return;
      if (!response.credential) {
        const message = 'Google did not return a credential. Please try again.';
        setError(message);
        errorHandlerRef.current?.(message);
        return;
      }

      setBusy(true);
      setError(null);
      try {
        await credentialHandlerRef.current(response.credential, nonce);
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Google sign-in failed. Please try again.';
        setError(message);
        errorHandlerRef.current?.(message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    const sink = (response: { credential?: string }) => {
      void handleCredential(response);
    };
    credentialSink = sink;

    const setup = async () => {
      try {
        await loadGis();
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = '';
        if (initializedClientId !== resolvedClientId) {
          window.google!.accounts.id.initialize({
            client_id: resolvedClientId,
            nonce,
            ux_mode: 'popup',
            callback: (response) => credentialSink?.(response),
          });
          initializedClientId = resolvedClientId;
        }
        window.google!.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 320,
        });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Google sign-in could not be loaded.';
        setError(message);
        errorHandlerRef.current?.(message);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      if (credentialSink === sink) credentialSink = null;
    };
  }, [resolvedClientId, disabled, nonce, text]);

  if (!resolvedClientId) {
    return (
      <div>
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 dark:border-white/15 dark:bg-white/5 dark:text-slate-400"
        >
          <GoogleGlyph />
          Continue with Google
        </button>
        <p className="mt-2 text-center text-xs text-slate-500">
          Google sign-in is not configured for this deployment.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative flex min-h-[44px] w-full justify-center">
        <div
          ref={containerRef}
          className={disabled || busy ? 'pointer-events-none opacity-60' : ''}
          aria-hidden={busy ? 'true' : undefined}
        />
        {busy && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-white/90 text-sm font-medium text-slate-600 dark:bg-navy-900/90 dark:text-slate-300"
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Signing in with Google…
          </div>
        )}
      </div>
      {disabled && !error && (
        <p className="mt-2 text-center text-xs text-slate-500">
          Accept the terms above to continue with Google.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
