/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import AuthPage from "@/features/auth/AuthPage";
import { useAuth } from "@/features/auth/AuthProvider";

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const login = vi.fn();
const register = vi.fn();

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("AuthPage", () => {
  it("switches to signup and creates an account with all required fields", async () => {
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      user: null,
      login,
      register,
      logout: vi.fn(),
    });
    register.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<AuthPage />);

    expect(
      screen.getByRole("heading", { name: "Tekrar hoş geldiniz" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "E-posta veya kullanıcı adı" }),
    ).toHaveClass("text-base", "scroll-my-4");
    await user.click(screen.getByRole("button", { name: "Hesap oluştur" }));
    expect(
      screen.getByRole("heading", { name: "Hesabınızı oluşturun" }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: "E-posta" }),
      "a@b.com",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Kullanıcı adı" }),
      "alex",
    );
    await user.type(screen.getByLabelText("Parola"), "Parola12");
    await user.click(screen.getByRole("button", { name: "Hesap oluştur" }));

    expect(register).toHaveBeenCalledWith({
      email: "a@b.com",
      username: "alex",
      password: "Parola12",
    });
  });

  it("submits email or username login and shows an authentication error", async () => {
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      user: null,
      login,
      register,
      logout: vi.fn(),
    });
    login.mockRejectedValue(new ApiError("Unauthorized", 401));
    const user = userEvent.setup();

    render(<AuthPage />);

    await user.type(
      screen.getByRole("textbox", { name: "E-posta veya kullanıcı adı" }),
      "alex",
    );
    await user.type(screen.getByLabelText("Parola"), "WrongPass1");
    await user.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(login).toHaveBeenCalledWith("alex", "WrongPass1");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-posta, kullanıcı adı veya parola hatalı.",
    );
  });
});
