/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeControls } from "@/components/mode-toggle";
import { ThemeProvider } from "@/components/theme-provider";

beforeEach(() => {
  vi.stubGlobal("matchMedia", createMatchMedia(false));
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("light", "dark");
  vi.unstubAllGlobals();
});

describe("ThemeControls", () => {
  it("shows the selected theme beside the static icon controls", () => {
    renderThemeControls();

    expect(screen.getByText("Tema")).toBeInTheDocument();
    expect(screen.getByText("Açık")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: "Açık tema" })).toHaveClass(
      "bg-primary",
      "border-primary",
    );
    expect(screen.getByRole("button", { name: "Açık tema" })).toHaveTextContent(
      "",
    );
    expect(screen.getByRole("button", { name: "Koyu tema" })).toHaveTextContent(
      "",
    );
    expect(
      screen.getByRole("button", { name: "Sistem teması" }),
    ).toHaveTextContent("");
  });

  it("updates the selected theme", async () => {
    const user = userEvent.setup();
    renderThemeControls();

    await user.click(screen.getByRole("button", { name: "Koyu tema" }));

    expect(screen.getByRole("button", { name: "Koyu tema" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Koyu")).toHaveAttribute("aria-live", "polite");
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));

    await user.click(screen.getByRole("button", { name: "Sistem teması" }));
    expect(
      screen.getByRole("button", { name: "Sistem teması" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

function renderThemeControls() {
  render(
    <ThemeProvider defaultTheme="light">
      <ThemeControls />
    </ThemeProvider>,
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
