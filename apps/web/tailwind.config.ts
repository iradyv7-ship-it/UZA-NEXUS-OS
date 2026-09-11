import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The UZA Build branding project (Claude Design canvas) — the formal token system
        // for the same brand book as before (dark navy + cyber orange). This is not a
        // rebrand: it replaces the old ad-hoc `brand`/`mist`/`fog`/`cloud`/`steel`/`stone`/
        // `charcoal`/`ink` palette with semantic HSL custom properties defined in
        // globals.css, each with real light + dark values (`:root`, the
        // `prefers-color-scheme: dark` media query, and `[data-theme="dark"]`).
        //
        // `hsl(var(--token) / <alpha-value>)` keeps Tailwind's opacity modifiers working
        // (e.g. `bg-primary/10`) since the variable itself only holds the h/s/l triplet.
        bg: 'hsl(var(--bg) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        surface2: 'hsl(var(--surface-2) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        fg: 'hsl(var(--fg) / <alpha-value>)',
        fgMuted: 'hsl(var(--fg-muted) / <alpha-value>)',
        fgSubtle: 'hsl(var(--fg-subtle) / <alpha-value>)',
        // `primary` is the brand navy (inverts to near-white in dark mode — see globals.css).
        // `accent` (cyber orange) stays the sparing highlight color the brand book gives it.
        primary: 'hsl(var(--primary) / <alpha-value>)',
        primarySoft: 'hsl(var(--primary-soft) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',
        accentStrong: 'hsl(var(--accent-strong) / <alpha-value>)',
        ok: 'hsl(var(--ok) / <alpha-value>)',
        warn: 'hsl(var(--warn) / <alpha-value>)',
        danger: 'hsl(var(--danger) / <alpha-value>)',
        info: 'hsl(var(--info) / <alpha-value>)',
      },
      fontFamily: {
        // Set by next/font in app/layout.tsx (self-hosted, no external request). Archivo is
        // the brand kit's one type family for headings and body alike; Helvetica Neue is the
        // kit's own documented office fallback. system-ui/sans-serif close the stack for the
        // rare case neither has loaded yet — this app is used on outdoor/warehouse screens.
        sans: ['var(--font-brand)', 'Helvetica Neue', 'system-ui', 'sans-serif'],
        // Numerals are instrumentation (money, weights, dates, route/ID strings, eyebrow/
        // label text) per the kit, but IBM Plex Mono is not yet self-hosted via next/font —
        // this keeps Tailwind's default mono stack for the existing `font-mono` usages
        // rather than reference an undefined `--font-*` variable (which would invalidate
        // the whole font-family value, not just fall through to the next font).
      },
    },
  },
  plugins: [],
};

export default config;
