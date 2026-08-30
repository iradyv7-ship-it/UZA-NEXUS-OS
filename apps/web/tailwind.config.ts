import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // UZA corridor palette — calm, high-contrast for outdoor/warehouse screens.
        brand: {
          DEFAULT: '#0f5132',
          soft: '#d1e7dd',
        },
      },
      fontFamily: {
        // Set by next/font in app/layout.tsx (self-hosted, no external request). The
        // fallback stack matters here: this app is used on outdoor/warehouse screens where
        // the font may not have loaded yet.
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
