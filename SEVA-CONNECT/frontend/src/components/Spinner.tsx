import { Loader2 } from 'lucide-react';

export default function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}