import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand surfaces — dark-first palette
        surface: {
          base:  "#0d0f1a", // main background
          raised: "#13151f", // sidebar, cards
          border: "#1e2130", // subtle borders
          hover:  "#1a1d2e", // hover state on dark bg
        },
        // Teal accent — used only on primary actions and active states
        accent: {
          DEFAULT: "#1B6B5A",
          hover:   "#155748",
          dim:     "#0f3d31", // active bg on dark surfaces
          muted:   "#4a9585",
        },
        // Per-advisor indicator colors — distinct, muted
        advisor: {
          dashboard: "#3b6ea5", // muted blue
          ssot:      "#7c5c9e", // muted purple
          modeling:  "#4a8c6a", // muted green (distinct from teal)
        },
        // Text scale
        ink: {
          DEFAULT: "#e2e4ef", // primary text
          muted:   "#6b7280", // secondary / meta
          faint:   "#374151", // disabled / placeholder
        },
      },
      fontSize: {
        "2xs": ["11px", "16px"],
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
