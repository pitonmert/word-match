const createColorScale = (name) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [
      shade,
      `var(--${name}-${shade})`,
    ]),
  );

export default {
  darkMode: ["class"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      text: createColorScale("text"),
      background: {
        DEFAULT: "var(--background)",
        ...createColorScale("background"),
      },
      primary: {
        DEFAULT: "var(--primary)",
        foreground: "var(--primary-foreground)",
        ...createColorScale("primary"),
      },
      secondary: {
        DEFAULT: "var(--secondary)",
        foreground: "var(--secondary-foreground)",
        ...createColorScale("secondary"),
      },
      accent: {
        DEFAULT: "var(--accent)",
        foreground: "var(--accent-foreground)",
        ...createColorScale("accent"),
      },
      foreground: "var(--foreground)",
      card: {
        DEFAULT: "var(--card)",
        foreground: "var(--card-foreground)",
      },
      popover: {
        DEFAULT: "var(--popover)",
        foreground: "var(--popover-foreground)",
      },
      muted: {
        DEFAULT: "var(--muted)",
        foreground: "var(--muted-foreground)",
      },
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
      overlay: "var(--overlay)",
      selected: {
        DEFAULT: "var(--selected)",
        foreground: "var(--selected-foreground)",
      },
      disabled: {
        DEFAULT: "var(--disabled)",
        foreground: "var(--disabled-foreground)",
      },
      success: {
        DEFAULT: "var(--success)",
        foreground: "var(--success-foreground)",
        subtle: "var(--success-subtle)",
      },
      warning: {
        DEFAULT: "var(--warning)",
        foreground: "var(--warning-foreground)",
        subtle: "var(--warning-subtle)",
      },
      error: {
        DEFAULT: "var(--error)",
        foreground: "var(--error-foreground)",
        subtle: "var(--error-subtle)",
      },
      destructive: {
        DEFAULT: "var(--error)",
        foreground: "var(--error-foreground)",
      },
      info: {
        DEFAULT: "var(--info)",
        foreground: "var(--info-foreground)",
        subtle: "var(--info-subtle)",
      },
    },
    fontFamily: {
      sans: ['"Geist Variable"', "sans-serif"],
    },
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      sm: ["0.875rem", { lineHeight: "1.25rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      lg: ["1.125rem", { lineHeight: "1.75rem" }],
      xl: ["1.25rem", { lineHeight: "1.75rem" }],
      "2xl": ["1.5rem", { lineHeight: "2rem" }],
      "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
    },
    boxShadow: {
      none: "none",
      surface: "0 1px 2px var(--shadow-surface)",
      overlay:
        "0 12px 28px -8px var(--shadow-overlay), 0 4px 10px -6px var(--shadow-surface)",
    },
  },
};
