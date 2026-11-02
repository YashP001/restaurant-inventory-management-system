/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f2f5fd',
          100: '#e5ebfb',
          200: '#ccd9f7',
          300: '#a3bef1',
          400: '#759de8',
          500: '#4E73DF', // Primary Theme Color
          600: '#3b5bc7',
          700: '#2f47a3',
          800: '#293b84',
          900: '#26346e',
          950: '#171f45',
        },
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        }
      }
    },
  },
  plugins: [],
}
