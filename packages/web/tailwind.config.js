/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#026cdf",
          600: "#0150a5",
          700: "#003b7a",
          900: "#001a38",
        },
      },
    },
  },
  plugins: [],
};
