/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/components/theme-provider";

const localStorageMock = createLocalStorage();

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove("light", "dark");
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  it("uses the system theme and stores explicit choices", async () => {
    vi.stubGlobal("matchMedia", createMatchMedia(true));
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>,
    );

    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(screen.getByText("system")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use light theme" }));

    expect(document.documentElement).toHaveClass("light");
    expect(window.localStorage.getItem("word-match-theme")).toBe("light");
  });

  it("restores a stored theme", async () => {
    window.localStorage.setItem("word-match-theme", "dark");
    vi.stubGlobal("matchMedia", createMatchMedia(false));

    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>,
    );

    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(screen.getByText("dark")).toBeInTheDocument();
  });
});

function ThemeControls() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <span>{theme}</span>
      <button type="button" onClick={() => setTheme("light")}>
        Use light theme
      </button>
    </>
  );
}

function createMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation(
    (query: string): MediaQueryList =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

function createLocalStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}
