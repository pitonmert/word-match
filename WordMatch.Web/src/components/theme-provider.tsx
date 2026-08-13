import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "word-match-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const storedTheme = readStoredTheme(storageKey);
    return isTheme(storedTheme) ? storedTheme : defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      root.classList.remove("light", "dark");
      root.classList.add(
        theme === "system" ? (mediaQuery.matches ? "dark" : "light") : theme,
      );
    };

    applyTheme();

    if (theme !== "system") return;

    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme: Theme) => {
        storeTheme(storageKey, nextTheme);
        setThemeState(nextTheme);
      },
    }),
    [storageKey, theme],
  );

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(storageKey: string) {
  try {
    return window.localStorage?.getItem(storageKey) ?? null;
  } catch {
    return null;
  }
}

function storeTheme(storageKey: string, theme: Theme) {
  try {
    window.localStorage?.setItem(storageKey, theme);
  } catch {
    // Theme switching should still work when browser storage is unavailable.
  }
}
