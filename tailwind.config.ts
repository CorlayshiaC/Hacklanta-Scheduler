import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f8fafc",
        muted: "#9ca3af",
        field: "#050507",
        panel: "#0d0d14",
        elevated: "#151423",
        line: "rgba(255,255,255,0.12)",
        signal: "#39ff88",
        electric: "#4f46e5",
        pulse: "#ec4899",
        warning: "#facc15",
        danger: "#fb7185",
      },
    },
  },
  plugins: [],
};

export default config;
