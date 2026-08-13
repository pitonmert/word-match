/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/features/auth/components/LoginForm";

afterEach(() => {
  cleanup();
});

describe("LoginForm", () => {
  it("submits the entered identifier and password", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <LoginForm
        error={null}
        isSubmitting={false}
        onShowSignup={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText("E-posta veya kullanıcı adı"),
      "alex",
    );
    await user.type(screen.getByLabelText("Parola"), "password123");
    await user.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(onSubmit).toHaveBeenCalledWith("alex", "password123");
  });

  it("disables the inputs and submit button while submitting", () => {
    render(
      <LoginForm
        error={null}
        isSubmitting
        onShowSignup={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("E-posta veya kullanıcı adı")).toBeDisabled();
    expect(screen.getByLabelText("Parola")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Giriş yapılıyor..." }),
    ).toBeDisabled();
  });

  it("shows the error message and marks the inputs invalid", () => {
    render(
      <LoginForm
        error="E-posta, kullanıcı adı veya parola hatalı."
        isSubmitting={false}
        onShowSignup={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "E-posta, kullanıcı adı veya parola hatalı.",
    );

    const identifierInput = screen.getByLabelText("E-posta veya kullanıcı adı");
    const passwordInput = screen.getByLabelText("Parola");
    expect(identifierInput).toHaveAttribute("aria-invalid", "true");
    expect(identifierInput).toHaveAttribute(
      "aria-describedby",
      "login-form-error",
    );
    expect(passwordInput).toHaveAttribute("aria-invalid", "true");
    expect(passwordInput).toHaveAttribute(
      "aria-describedby",
      "login-form-error",
    );
  });

  it("does not render an alert or mark inputs invalid without an error", () => {
    render(
      <LoginForm
        error={null}
        isSubmitting={false}
        onShowSignup={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("E-posta veya kullanıcı adı")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("calls onShowSignup when the switch link is clicked", async () => {
    const onShowSignup = vi.fn();
    const user = userEvent.setup();

    render(
      <LoginForm
        error={null}
        isSubmitting={false}
        onShowSignup={onShowSignup}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Hesap oluştur" }));

    expect(onShowSignup).toHaveBeenCalledOnce();
  });
});
