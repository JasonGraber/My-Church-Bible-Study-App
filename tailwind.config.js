/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './index.tsx', './App.tsx', './components/**/*.tsx', './views/**/*.tsx'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'Times New Roman', 'serif'],
      },
      keyframes: {
        'slide-up': { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: { 'slide-up': 'slide-up 0.25s ease-out', 'fade-in': 'fade-in 0.2s ease-out' },
    },
  },
  plugins: [],
};
