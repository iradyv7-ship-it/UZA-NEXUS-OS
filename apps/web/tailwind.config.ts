import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The real UZA palette (brand book, "UZA Bulk & Mall", 2026) — replaces an earlier
        // placeholder green (#0f5132) that didn't appear anywhere in the actual guidelines.
        // `brand` is dark blue: the anchor color for a work console (navy reads as serious/
        // operational), with `accent` (cyber orange) reserved for the sparing highlight role
        // the book itself gives it — primary actions, the one thing on a screen that should
        // pull the eye — not backgrounds or large fills.
        brand: {
          DEFAULT: '#233448', // Dark blue
          soft: '#3d4f66',    // one step lighter, for hover/active states — not in the book,
                               // derived to keep the same hue since the book has no tint scale
        },
        accent: {
          DEFAULT: '#FBAF43', // Cyber (Pantone 142C)
        },
        // The book's named grayscale, in place of default Tailwind slate/gray so text,
        // borders and surfaces are actually on-brand rather than an unrelated gray ramp.
        mist: '#F7F7F8',
        fog: '#EEEEEF',
        cloud: '#CCCCCC',
        steel: '#999999',
        stone: '#474749',
        charcoal: '#333333',
        ink: '#000000',
      },
      fontFamily: {
        // Set by next/font in app/layout.tsx (self-hosted, no external request). The
        // fallback stack matters here: this app is used on outdoor/warehouse screens where
        // the font may not have loaded yet.
        //
        // NOT yet the brand book's Mont — Mont is a licensed commercial font, not on Google
        // Fonts, and can't be embedded without the actual license/font files. Inter is a
        // placeholder until real Mont files are available (see chat) — same idea (Helvetica
        // Neue, the book's own documented fallback, isn't freely embeddable either).
        sans: ['var(--font-brand)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
