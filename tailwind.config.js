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
        // Fundos noturnos da identidade visual (azul-noite profundo)
        dark: {
          950: '#06030f',
          900: '#0b0718',
          850: '#100b22',
          800: '#151029',
          700: '#1e1740',
          600: '#2b2153',
        },
        // Roxo/violeta elétrico da identidade
        accent: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          glow: 'rgba(139, 92, 246, 0.22)',
        },
        // Fúcsia do gradiente do logo
        pink: {
          neon: '#c026d3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'accent-glow': '0 0 24px rgba(139, 92, 246, 0.35)',
        'accent-glow-sm': '0 0 12px rgba(139, 92, 246, 0.30)',
        'card-glow': '0 0 40px rgba(124, 58, 237, 0.08)',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #c026d3 100%)',
        'brand-gradient': 'linear-gradient(90deg, #a78bfa 0%, #e879f9 100%)',
      },
    },
  },
  plugins: [],
}
