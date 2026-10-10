/** Calm app design — Tailwind preset. Maps utilities to the tokens in tokens.css, so
 *  `bg-surface text-text-2 border-border rounded-lg` works in both themes.
 *  tailwind.config:  presets: [require("./tailwind.preset.js")]   (Tailwind v3)
 *  Tailwind v4: @import "tailwindcss"; then @config "./tailwind.preset.js"; (or copy into @theme). */
const plain = (name) => `var(--${name})`;
// Colours accept opacity modifiers (`ring-accent-text/25`, `bg-sunken/50`) through color-mix —
// Tailwind 3 can't fade a var() colour by itself and would silently emit nothing.
const v = (name) => ({ opacityValue } = {}) =>
  opacityValue === undefined || String(opacityValue).startsWith("var(")
    ? plain(name)
    : `color-mix(in srgb, var(--${name}) ${Math.round(Number(opacityValue) * 100)}%, transparent)`;

module.exports = {
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        sunken: v("sunken"),
        surface: { DEFAULT: v("surface"), 2: v("surface-2"), sunken: v("sunken") },
        border: { DEFAULT: v("border"), subtle: v("border-subtle"), strong: v("border-strong") },
        text: { DEFAULT: v("text"), 2: v("text-2"), 3: v("text-3"), disabled: v("text-disabled") },
        accent: { DEFAULT: v("accent"), hover: v("accent-hover"), text: v("accent-text"), soft: v("accent-soft"), on: v("on-accent") },
        success: { DEFAULT: v("success"), soft: v("success-soft") },
        warning: { DEFAULT: v("warning"), soft: v("warning-soft") },
        danger: { DEFAULT: v("danger"), soft: v("danger-soft") },
        info: { DEFAULT: v("info"), soft: v("info-soft") },
        sev: { critical: v("sev-critical"), high: v("sev-high"), medium: v("sev-medium"), low: v("sev-low"), info: v("sev-info") },
        chart: { 1: v("chart-1"), 2: v("chart-2"), 3: v("chart-3"), 4: v("chart-4"), grid: v("chart-grid") },
        focus: v("focus"),
        overlay: v("overlay"),
      },
      fontFamily: { sans: [plain("font-sans")], mono: [plain("font-mono")] },
      fontSize: {
        xs: [plain("text-xs"), { lineHeight: "1.4" }],
        sm: [plain("text-sm"), { lineHeight: "1.45" }],
        base: [plain("text-md"), { lineHeight: "1.5" }],
        lg: [plain("text-lg"), { lineHeight: "1.4" }],
        xl: [plain("text-xl"), { lineHeight: "1.3" }],
      },
      boxShadow: { calm: plain("shadow"), sm: plain("shadow-sm") },
      transitionTimingFunction: { calm: plain("ease") },
      transitionDuration: { fast: "120ms", normal: "180ms" },
    },
  },
};
