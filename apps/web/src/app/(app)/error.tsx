'use client';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-base font-semibold text-slate-900">Something went wrong</p>
      <p className="mt-1 text-sm text-slate-600">We could not load this screen from the server.</p>
      <button
        onClick={() => reset()}
        className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}
