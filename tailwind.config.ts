import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Add Eskwelabs brand colors and typography here
      colors: {
        brand: {
          primary: "#1a1a2e",   // placeholder — update to Eskwelabs brand color
          secondary: "#16213e", // placeholder
          accent: "#0f3460",    // placeholder
        },
      },
    },
  },
  plugins: [],
};

export default config;
