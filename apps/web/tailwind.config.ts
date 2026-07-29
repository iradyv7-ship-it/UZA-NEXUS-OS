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
    },
  },
  plugins: [],
};

export default config;
