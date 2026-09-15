import type { ReactNode } from 'react';

/**
 * The one responsive width the whole app shares. Mobile-first: full-width on a phone,
 * then a comfortable column that grows step-by-step to use a tablet/desktop's space
 * instead of leaving a thin centred strip. Applied to the app shell (header + main) and
 * referenced by the login screen so every surface lines up at every breakpoint.
 */
export const SHELL_WIDTH = 'max-w-md sm:max-w-2xl lg:max-w-5xl xl:max-w-6xl';

/** Horizontal padding that grows with the shell, so gutters feel right at every size. */
export const SHELL_PADDING_X = 'px-4 sm:px-6 lg:px-8';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/**
 * A work-queue / list grid: one tap-friendly card per row on a phone, two on `md`, three
 * on `lg`. Renders a `<ul>` so `<li>` cards keep their list semantics. Used by the
 * dashboard queue, the partner shipments list and the finance verify queue so they all
 * flow the same way as the viewport grows.
 */
export function CardGrid({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul className={`grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {children}
    </ul>
  );
}

/**
 * A detail / reading page wrapper. The app shell can be wide, but a single record read
 * top-to-bottom wants a capped line length — this centres the content and stops it
 * sprawling edge-to-edge on a large monitor while still using more room than a phone.
 */
export function DetailShell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-3xl space-y-4 ${className}`}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-fgMuted">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums text-fg">{children}</dd>
    </div>
  );
}

// `slate` (the neutral tone) keeps its old name for every existing call site — `Tone` maps
// 1:1 onto the design system's status colors otherwise: green→ok, amber→warn, red→danger,
// blue→info. Status is never color alone (brand kit rule) — every one of these is paired
// with a label or an icon by the caller, never rendered as a bare dot.
type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue';
const TONES: Record<Tone, string> = {
  slate: 'bg-surface2 text-fgMuted',
  green: 'bg-ok/10 text-ok',
  amber: 'bg-warn/10 text-warn',
  red: 'bg-danger/10 text-danger',
  blue: 'bg-info/10 text-info',
};

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Masked confidential value indicator — makes clear the API hid this, it is not empty. */
export function Masked() {
  return (
    <span
      className="inline-flex items-center rounded bg-surface2 px-1.5 font-mono text-fgSubtle"
      title="Hidden for your role"
    >
      ***
    </span>
  );
}

/** A provenance chip: a fact (carrier-confirmed) must never look like a guess. */
export function Provenance({ confirmed, label }: { confirmed: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
        confirmed ? 'bg-ok/10 text-ok' : 'border border-dashed border-warn/50 text-warn'
      }`}
    >
      <span aria-hidden>{confirmed ? '●' : '◌'}</span>
      {label}
    </span>
  );
}
