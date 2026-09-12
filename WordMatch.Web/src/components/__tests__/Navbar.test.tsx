/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/features/auth/AuthProvider";
import { abandonStudySession } from "@/features/study/api/study";
import { reloadAt } from "@/lib/pageNavigation";

vi.mock("@/components/mode-toggle", () => ({
  ThemeControls: () => <div>Tema</div>,
}));

vi.mock("@/features/question-session/components/FeedbackSoundControl", () => ({
  FeedbackSoundControl: () => <div>Ses</div>,
}));

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/study/api/study", () => ({
  abandonStudySession: vi.fn(),
}));

vi.mock("@/lib/pageNavigation", () => ({
  reloadAt: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("Navbar", () => {
  it("keeps the brand as the only page navigation", () => {
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

    expect(screen.getByRole("link", { name: "Word Match" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("link", { name: "Deney alanı" }),
    ).not.toBeInTheDocument();
  });

  it("abandons an active Study session before returning home", async () => {
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      user: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(abandonStudySession).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/session/session-123"]}>
        <Navbar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("link", { name: "Word Match" }));

    await waitFor(() =>
      expect(abandonStudySession).toHaveBeenCalledWith("session-123"),
    );
    await waitFor(() => expect(reloadAt).toHaveBeenCalledWith("/"));
  });

  it("still returns home when ending the session fails", async () => {
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      user: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(abandonStudySession).mockRejectedValue(new Error("network"));
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/session/session-123"]}>
        <Navbar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("link", { name: "Word Match" }));

    await waitFor(() => expect(reloadAt).toHaveBeenCalledWith("/"));
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
    expect(screen.getByText("Görünüm")).toBeInTheDocument();
    expect(screen.getByText("Geri bildirim")).toBeInTheDocument();
    expect(screen.getByText("Ses")).toBeInTheDocument();
    expect(screen.getByText("Oturum")).toBeInTheDocument();

    const logoutItem = screen.getByRole("menuitem", { name: "Çıkış yap" });
    expect(logoutItem).toHaveAttribute("data-variant", "destructive");
    expect(logoutItem).toHaveClass("justify-center", "bg-error-subtle");

    await user.click(logoutItem);
    expect(logout).toHaveBeenCalledOnce();
  });
});
