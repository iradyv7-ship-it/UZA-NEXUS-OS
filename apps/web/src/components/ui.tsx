import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums text-slate-900">{children}</dd>
    </div>
  );
}

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue';
const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-sky-100 text-sky-800',
};

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

/** Masked confidential value indicator — makes clear the API hid this, it is not empty. */
export function Masked() {
  return (
    <span className="inline-flex items-center rounded bg-slate-100 px-1.5 font-mono text-slate-400" title="Hidden for your role">
      ***
    </span>
  );
}

/** A provenance chip: a fact (carrier-confirmed) must never look like a guess. */
export function Provenance({ confirmed, label }: { confirmed: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
        confirmed ? 'bg-emerald-50 text-emerald-700' : 'border border-dashed border-amber-300 text-amber-700'
      }`}
    >
      <span aria-hidden>{confirmed ? '●' : '◌'}</span>
      {label}
    </span>
  );
}
