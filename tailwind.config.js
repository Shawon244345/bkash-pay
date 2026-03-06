/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bkash: '#E2136E',
        'bkash-dark': '#333333',
        'bkash-light': '#F5F5F5',
      }
    },
  },
  plugins: [],
}
