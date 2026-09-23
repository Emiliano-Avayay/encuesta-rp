import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rp: {
          orange: "#FF771C",
          graphite: "#4D4D4D",
          smoke: "#F6F6F4",
          line: "#DEDCD8"
        }
      },
      boxShadow: {
        focus: "0 0 0 4px rgba(255, 90, 0, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
