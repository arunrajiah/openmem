/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        claude: "#d97706",     // amber-600
        chatgpt: "#16a34a",    // green-600
        gemini: "#2563eb",     // blue-600
        perplexity: "#7c3aed", // violet-600
        other: "#6b7280",      // gray-500
      },
    },
  },
  plugins: [],
};
