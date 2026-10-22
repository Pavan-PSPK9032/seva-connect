import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Award, BadgeCheck, Loader2, Printer, ShieldCheck, XCircle } from 'lucide-react';
import { apiGetOne, apiErrorMessage } from '../services/api';
import type { Certificate } from '../types';

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CertificateView() {
  const { code = '' } = useParams();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiGetOne<Certificate>(`/certificates/${encodeURIComponent(code)}`);
        if (active) setCertificate(res.data ?? null);
      } catch (err) {
        if (active) setError(apiErrorMessage(err, 'No certificate matches that code.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  if (loading) {
    return (
      <div className="container-x flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="container-x py-24">
        <div className="card mx-auto max-w-lg p-10 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-400" />
          <h1 className="mt-4 font-display text-xl font-semibold text-navy-800 dark:text-white">Certificate not found</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Link to="/" className="btn btn-primary mt-6">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x py-12 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Verified record</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-navy-800 dark:text-white">Certificate of volunteering</h1>
          </div>
          <button type="button" onClick={() => window.print()} className="btn btn-primary">
            <Printer className="h-4 w-4" /> Print / save PDF
          </button>
        </div>

        <article className="relative overflow-hidden rounded-3xl border-4 border-double border-primary-600 bg-white p-8 text-navy-900 shadow-card sm:p-12 print:border-primary-600 print:shadow-none">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary-50" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent-50" />

          <div className="relative text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
              <Award className="h-8 w-8" />
            </span>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Seva Connect</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold text-navy-900 sm:text-4xl">
              Certificate of Volunteering
            </h2>
            <p className="mt-6 text-sm text-slate-500">This certificate is proudly presented to</p>
            <p className="mt-2 font-display text-3xl font-bold text-primary-700">{certificate.volunteerName}</p>

            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-slate-600">
              in recognition of <strong className="text-navy-900">{certificate.hours} verified volunteer hour{certificate.hours === 1 ? '' : 's'}</strong>{' '}
              contributed to <strong className="text-navy-900">{certificate.eventTitle}</strong> organised by{' '}
              <strong className="text-navy-900">{certificate.ngoName}</strong>
              {certificate.eventDate ? ` on ${formatDate(certificate.eventDate)}` : ''}.
            </p>

            <div className="mt-10 flex flex-wrap items-end justify-between gap-6 text-left">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-slate-400">Issued</p>
                <p className="text-sm font-medium text-navy-800">{formatDate(certificate.issuedAt)}</p>
              </div>
              <div className="text-center">
                <BadgeCheck className="mx-auto h-8 w-8 text-primary-600" />
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Verified by</p>
                <p className="text-sm font-semibold text-navy-800">Seva Connect</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-widest text-slate-400">Certificate ID</p>
                <p className="font-mono text-sm font-semibold text-navy-800">{certificate.certificateId}</p>
              </div>
            </div>

            <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Verify at /certificates/{certificate.certificateId}
            </p>
          </div>
        </article>

        <p className="mt-5 text-center text-xs text-slate-500 print:hidden">
          Anyone can confirm this record by opening this page with the certificate ID above.
        </p>
      </div>
    </div>
  );
}
