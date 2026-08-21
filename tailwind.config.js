/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', './emails/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dune design system — from existing Namwel site
        sand: '#F5EFE3',
        ink: '#1F1B17',
        terracotta: '#B85A3E',
        'sand-deep': '#E8DFCE',
        'ink-soft': '#4A4138',
        'terracotta-dark': '#9A4A33',
        success: '#4A6B3A',
        warning: '#C68F2C',
        danger: '#A33A2A',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
