import type { Config } from "tailwindcss";

/** rgb(var(--x) / <alpha-value>) so every token works with Tailwind opacity. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // lib/ builds class strings too (the post-type and status capsule palettes in
    // lib/utils.ts). Without this Tailwind never emits those classes and the
    // capsules silently fall back to unstyled.
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        linkedin: {
          blue: "#0A66C2",
          darkblue: "#004182",
          lightblue: "#EAF4FF",
        },

        // ── Design tokens (defined in app/globals.css) ────────────────────
        // Prefer these over raw slate-### in app UI: one palette change then
        // lands everywhere instead of being chased through 46 components.
        app: token("app"),
        surface: {
          DEFAULT: token("surface"),
          raised: token("surface-raised"),
          sunken: token("surface-sunken"),
        },
        line: {
          DEFAULT: token("line"),
          strong: token("line-strong"),
        },
        ink: {
          DEFAULT: token("ink"),
          muted: token("ink-muted"),
          subtle: token("ink-subtle"),
        },
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          ink: token("accent-ink"),
          soft: token("accent-soft"),
          line: token("accent-line"),
        },
        success: {
          DEFAULT: token("success"),
          soft: token("success-soft"),
        },
        warning: {
          DEFAULT: token("warning"),
          soft: token("warning-soft"),
        },
        danger: {
          DEFAULT: token("danger"),
          soft: token("danger-soft"),
        },
      },
      borderRadius: {
        panel: "var(--r-panel)",
        card: "var(--r-card)",
        control: "var(--r-control)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Panels entering a dashboard grid, staggered by inline delay.
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.9s ease-out both",
        "rise-in": "rise-in 0.42s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
