import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f8fafc",
        card: "#ffffff",
        border: "#e2e8f0",
        ink: "#0f172a",
        muted: "#64748b",
        accent: {
          DEFAULT: "#4f46e5",
          hover: "#4338ca",
          soft: "#eef2ff",
        },
        danger: { DEFAULT: "#dc2626", soft: "#fee2e2" },
        warn: { DEFAULT: "#b45309", soft: "#fef3c7" },
        ok: { DEFAULT: "#15803d", soft: "#dcfce7" },
      },
      borderRadius: {
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
