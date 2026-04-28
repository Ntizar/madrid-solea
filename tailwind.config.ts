/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sun: {
          50:  '#FBF1DE',
          100: '#F5DDA8',
          300: '#E8A951',
          500: '#C97A2B',
          700: '#8A4B16'
        },
        night: {
          500: '#1B2D44',
          700: '#0E1B2C',
          900: '#060D17'
        },
        paper: '#F5EFE4',
        terracotta: '#B0552F'
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 24px rgba(232,169,81,0.55)'
      }
    }
  },
  plugins: []
};
