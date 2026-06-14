import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class", // next-themes sets class="dark" on <html>
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep teal accent — primary brand color
        accent: {
          DEFAULT: "#1B6B5A",
          hover: "#155748",
          light: "#e8f4f1",
          muted: "#4a9585",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
