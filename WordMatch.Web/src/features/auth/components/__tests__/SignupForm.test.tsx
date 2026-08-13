/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignupForm } from "@/features/auth/components/SignupForm";

afterEach(() => {
  cleanup();
});

describe("SignupForm", () => {
  it("submits the entered email, username, and password", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <SignupForm
        error={null}
        isSubmitting={false}
        onShowLogin={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("E-posta"), "alex@example.com");
    await user.type(screen.getByLabelText("Kullanıcı adı"), "alex");
    await user.type(screen.getByLabelText("Parola"), "Password123");
    await user.click(screen.getByRole("button", { name: "Hesap oluştur" }));

    expect(onSubmit).toHaveBeenCalledWith(
      "alex@example.com",
      "alex",
      "Password123",
    );
  });

  it("renders the password requirements hint", () => {
    render(
      <SignupForm
        error={null}
        isSubmitting={false}
        onShowLogin={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "En az 8 karakter, bir büyük harf, bir küçük harf ve bir rakam kullanın.",
      ),
    ).toBeInTheDocument();
  });

  it("disables the inputs and submit button while submitting", () => {
    render(
      <SignupForm
        error={null}
        isSubmitting
        onShowLogin={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("E-posta")).toBeDisabled();
    expect(screen.getByLabelText("Kullanıcı adı")).toBeDisabled();
    expect(screen.getByLabelText("Parola")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Hesap oluşturuluyor..." }),
    ).toBeDisabled();
  });

  it("shows the error message and marks every input invalid", () => {
    render(
      <SignupForm
        error="Bu kullanıcı adı zaten kullanılıyor."
        isSubmitting={false}
        onShowLogin={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Bu kullanıcı adı zaten kullanılıyor.");

    expect(screen.getByLabelText("E-posta")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("E-posta")).toHaveAttribute(
      "aria-describedby",
      "signup-form-error",
    );
    expect(screen.getByLabelText("Kullanıcı adı")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    const passwordInput = screen.getByLabelText("Parola");
    expect(passwordInput).toHaveAttribute("aria-invalid", "true");
    expect(passwordInput).toHaveAttribute(
      "aria-describedby",
      "password-requirements signup-form-error",
    );
  });

  it("keeps only the password-requirements description when there is no error", () => {
    render(
      <SignupForm
        error={null}
        isSubmitting={false}
        onShowLogin={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Parola")).toHaveAttribute(
      "aria-describedby",
      "password-requirements",
    );
  });

  it("calls onShowLogin when the switch link is clicked", async () => {
    const onShowLogin = vi.fn();
    const user = userEvent.setup();

    render(
      <SignupForm
        error={null}
        isSubmitting={false}
        onShowLogin={onShowLogin}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(onShowLogin).toHaveBeenCalledOnce();
  });
});
