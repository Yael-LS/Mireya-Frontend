import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-newsreader)", "Georgia", "serif"],
        sans: ["var(--font-geist)", "Arial", "sans-serif"],
      },
      colors: {
        parchment: "#f7f1e8",
        lavender: "#c9bddb",
        ochre: "#c78e35",
        ink: "#262328",
      },
      boxShadow: {
        paper: "0 20px 60px rgba(73, 58, 74, 0.12)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
