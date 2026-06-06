import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50: "#F4F6EF",
          100: "#E7EBDD",
          500: "#97A184",
          700: "#4B5645",
        },
        rose: "#D89A94",
        sand: "#D8C1A2",
        terracotta: "#D89A94",
        midnight: "#4B5645",
        olive: "#4B5645",
        ink: "#343B31",
        cream: "#FAF7F2",
      },
      borderRadius: {
        card: "24px",
        button: "16px",
        input: "14px",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0, 0, 0, 0.08)",
        lift: "0 20px 40px rgba(0, 0, 0, 0.12)",
      },
      fontFamily: {
        body: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Cormorant Garamond", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
