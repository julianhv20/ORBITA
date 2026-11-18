import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#040508',
          900: '#07090F',
          800: '#0D111C',
          700: '#161C2E',
        },
        ivory: {
          50: '#FAF8F5',
          100: '#F4F0EA',
          200: '#E2DDD5',
          400: '#9E9A93',
        },
        astrolabe: {
          300: '#F3CA7A',
          400: '#E5A93C',
          500: '#C98A22',
        },
        spectral: {
          400: '#2DD4BF',
          500: '#10B981',
        },
        roche: {
          400: '#FB7185',
          500: '#F43F5E',
        },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
