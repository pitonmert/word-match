/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/features/auth/AuthProvider";

vi.mock("@/components/mode-toggle", () => ({
  ModeToggle: () => <button type="button">Theme</button>,
}));

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("Navbar", () => {
  it("makes the words page navigation explicit and keeps its active state visible", () => {
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      user: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/words"]}>
        <Navbar />
      </MemoryRouter>,
    );

    const wordsLink = screen.getByRole("link", { name: "Kelimeler" });
    expect(wordsLink).toHaveAttribute("href", "/words");
    expect(wordsLink).toHaveAttribute("aria-current", "page");
    expect(wordsLink).toHaveClass("bg-secondary");
    expect(wordsLink.querySelector("svg")).toBeInTheDocument();
  });

  it("shows account details and allows the user to log out", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      user: {
        userId: "user-1",
        email: "alex@example.com",
        username: "alex",
      },
      login: vi.fn(),
      register: vi.fn(),
      logout,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/words"]}>
        <Navbar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Hesap menüsünü aç" }));
    expect(await screen.findByText("alex")).toBeInTheDocument();
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Çıkış yap" }));
    expect(logout).toHaveBeenCalledOnce();
  });
});
