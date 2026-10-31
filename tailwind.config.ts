import type { Config } from 'tailwindcss'

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        sunk: token('sunk'),
        ink: token('ink'),
        muted: token('muted'),
        line: token('line'),
        accent: token('accent'),
        'on-tint': token('on-tint'),
        danger: token('danger'),
        panel: token('panel'),
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
