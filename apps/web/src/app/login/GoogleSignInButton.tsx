/**
 * "Sign in with Google" — Google-branded, mobile-first (full-width), accessible.
 *
 * It is a plain top-level LINK to our own `/auth/google/start` route (Google blocks its
 * consent screen inside iframes, so we must navigate the whole window). Being a real anchor
 * means it works even before hydration / on patchy signal — no client JS required.
 *
 * When the API has no Google credentials (`configured === false`) we render a disabled,
 * non-clickable button with a subtle hint instead of a link that would dead-end at a 503.
 */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function GoogleSignInButton({
  configured,
  label,
  unavailable,
}: {
  configured: boolean;
  label: string;
  unavailable: string;
}) {
  const base =
    'flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-base font-medium transition';

  if (!configured) {
    return (
      <div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={`${base} cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400`}
        >
          <GoogleMark />
          {label}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">{unavailable}</p>
      </div>
    );
  }

  return (
    <a
      href="/auth/google/start"
      className={`${base} border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand/30`}
    >
      <GoogleMark />
      {label}
    </a>
  );
}
