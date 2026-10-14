import type { Config } from "tailwindcss";

/** rgb(var(--x) / <alpha-value>) so every token works with Tailwind opacity. */
const t = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

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

        // ── Refinement tokens (defined in app/globals.css) ─────────────────
        // Same visual language the dashboard already had; these just give it
        // one value per decision instead of several.
        field: t("field"),
        card: { DEFAULT: t("card"), muted: t("card-muted") },
        edge: { DEFAULT: t("edge"), soft: t("edge-soft") },
        text: { DEFAULT: t("text"), 2: t("text-2"), 3: t("text-3") },
        brand: {
          DEFAULT: t("brand"),
          hover: t("brand-hover"),
          tint: t("brand-tint"),
          edge: t("brand-edge"),
        },
        ok: { DEFAULT: t("ok"), tint: t("ok-tint") },
        warn: { DEFAULT: t("warn"), tint: t("warn-tint") },
        bad: { DEFAULT: t("bad"), tint: t("bad-tint") },
        violet: { DEFAULT: t("violet"), tint: t("violet-tint") },
        pink: { DEFAULT: t("pink"), tint: t("pink-tint") },
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
      },
      boxShadow: {
        lift: "var(--lift)",
        "lift-lg": "var(--lift-lg)",
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
        "card-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.9s ease-out both",
        "card-in": "card-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
