/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession, logout } from "@/features/auth/api/auth";
import { authUnauthorizedEvent } from "@/lib/api/client";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { createTestQueryClient } from "@/test/createTestQueryClient";

vi.mock("@/features/auth/api/auth", () => ({
  fetchAuthSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
}));

const user = {
  userId: "user-1",
  email: "alex@example.com",
  username: "alex",
};

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.resetAllMocks();
});

function renderAuthProvider() {
  const queryClient = createTestQueryClient();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthState />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

describe("AuthProvider", () => {
  it("recovers the cookie session when the application starts", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue(user);

    renderAuthProvider();

    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(await screen.findByText("alex")).toBeInTheDocument();
  });

  it("clears local authentication when an API request reports 401", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue(user);

    renderAuthProvider();

    await screen.findByText("alex");
    window.dispatchEvent(new Event(authUnauthorizedEvent));

    expect(await screen.findByText("Signed out")).toBeInTheDocument();
  });

  it("signs out through the API and clears the recovered user", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue(user);
    vi.mocked(logout).mockResolvedValue(undefined);
    const interaction = userEvent.setup();

    renderAuthProvider();

    await screen.findByText("alex");
    await interaction.click(screen.getByRole("button", { name: "Sign out" }));

    expect(logout).toHaveBeenCalledOnce();
    expect(await screen.findByText("Signed out")).toBeInTheDocument();
  });

  it("keeps the user signed out locally when a failed logout is followed by reconnecting", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue(user);
    vi.mocked(logout).mockRejectedValue(new Error("Network error"));
    const interaction = userEvent.setup();

    renderAuthProvider();

    await screen.findByText("alex");
    await interaction.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByText("Signed out");

    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(vi.mocked(fetchAuthSession)).toHaveBeenCalledOnce();
    expect(screen.getByText("Signed out")).toBeInTheDocument();
  });

  it("clears another user's cached queries on logout so the next session starts clean", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue(user);
    vi.mocked(logout).mockResolvedValue(undefined);
    const interaction = userEvent.setup();

    const { queryClient } = renderAuthProvider();

    await screen.findByText("alex");
    queryClient.setQueryData(["words"], [{ id: 1, english: "cat" }]);
    queryClient.setQueryData(["practice", "categories"], { levels: [] });
    expect(queryClient.getQueryData(["words"])).toBeDefined();

    await interaction.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByText("Signed out");

    expect(queryClient.getQueryData(["words"])).toBeUndefined();
    expect(
      queryClient.getQueryData(["practice", "categories"]),
    ).toBeUndefined();
  });

  it("clears another user's cached queries when a session expires (401)", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue(user);

    const { queryClient } = renderAuthProvider();

    await screen.findByText("alex");
    queryClient.setQueryData(["words"], [{ id: 1, english: "cat" }]);

    window.dispatchEvent(new Event(authUnauthorizedEvent));
    await screen.findByText("Signed out");

    expect(queryClient.getQueryData(["words"])).toBeUndefined();
  });
});

function AuthState() {
  const { isLoading, logout: signOut, user: currentUser } = useAuth();

  if (isLoading) return <span>Loading</span>;
  return (
    <>
      <span>{currentUser?.username ?? "Signed out"}</span>
      {currentUser ? (
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      ) : null}
    </>
  );
}
