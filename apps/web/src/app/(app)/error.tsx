'use client';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center">
      <p className="text-base font-semibold text-fg">Something went wrong</p>
      <p className="mt-1 text-sm text-fgMuted">We could not load this screen from the server.</p>
      <button
        onClick={() => reset()}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-surface"
      >
        Try again
      </button>
    </div>
  );
}
