/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: '#00d4ff',
        secondary: '#7c3aed',
        accent: '#f59e0b',
        bg: '#0f1724',
      },
    },
  },
  plugins: [],
};
