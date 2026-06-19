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
        // Brand surfaces — dynamically theme-responsive
        surface: {
          base:   "var(--bg-base)",
          raised: "var(--bg-raised)",
          border: "var(--border)",
          hover:  "var(--bg-hover)",
        },
        // Teal accent — used only on primary actions and active states
        accent: {
          DEFAULT: "#1B6B5A",
          hover:   "#155748",
          dim:     "var(--accent-dim)",
          muted:   "var(--accent-muted)",
        },
        // Per-advisor indicator colors — dynamically theme-responsive
        advisor: {
          dashboard: "var(--advisor-dashboard)",
          ssot:      "var(--advisor-ssot)",
          modeling:  "var(--advisor-modeling)",
        },
        // Text scale — dynamically theme-responsive
        ink: {
          DEFAULT: "var(--ink)",
          muted:   "var(--ink-muted)",
          faint:   "var(--ink-faint)",
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
