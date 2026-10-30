/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#09090b',
          900: '#121216',
          850: '#18181c',
          800: '#1f1f23',
          700: '#27272a',
          600: '#3f3f46',
        },
        accent: {
          500: '#8b5cf6', // Violeta / Roxo principal
          600: '#7c3aed',
          700: '#6d28d9',
          glow: 'rgba(139, 92, 246, 0.15)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
