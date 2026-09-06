import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        border: "var(--border)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        secondary: "var(--secondary)",
        "secondary-soft": "var(--secondary-soft)",
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
        "sidebar-bg": "var(--sidebar-bg)",
        "sidebar-muted": "var(--sidebar-muted)",
      },
      fontFamily: {
        display: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        control: "11px",
      },
      boxShadow: {
        sm2: "0 1px 2px oklch(20% 0 0 / 0.06)",
        md2: "0 8px 24px oklch(20% 0 0 / 0.10), 0 2px 6px oklch(20% 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
