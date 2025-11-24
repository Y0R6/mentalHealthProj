/** @type {import('tailwindcss').Config} */
export default {
  // *** สำคัญ: ต้องมี Path ที่สแกนไฟล์ .tsx และ .jsx ***
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}