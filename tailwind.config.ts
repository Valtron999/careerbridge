import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#315EFB', dark: '#2549D1', tint: '#EEF2FF' },
        ink: { DEFAULT: '#152238', muted: '#667085' },
        surface: { soft: '#F7F9FC', line: '#E7EBF2' },
        ok: { DEFAULT: '#16865C', tint: '#E7F5EE' },
      },
      fontFamily: { sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'] },
      maxWidth: { page: '1200px' },
    },
  },
  plugins: [],
};
export default config;
