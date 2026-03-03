/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bkash: {
          pink: '#e2136e',
          light: '#f5f5f5',
          dark: '#333333',
        }
      }
    },
  },
  plugins: [],
}
