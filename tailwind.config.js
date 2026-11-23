/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0f1e2e',
          800: '#16283c',
          700: '#1e3a56',
        },
        teal: {
          600: '#2c7a6e',
          700: '#256659',
          100: '#e2f0ed',
        },
        paper: '#f7f5f1',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        heading: ['Lora', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
