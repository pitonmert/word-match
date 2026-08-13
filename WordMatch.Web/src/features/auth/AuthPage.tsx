import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { SignupForm } from "@/features/auth/components/SignupForm";
import { useAuth } from "@/features/auth/AuthProvider";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await action();
    } catch (requestError) {
      setError(getAuthError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeMode = (nextMode: AuthMode) => {
    setError(null);
    setMode(nextMode);
  };

  return mode === "login" ? (
    <LoginForm
      error={error}
      isSubmitting={isSubmitting}
      onShowSignup={() => changeMode("signup")}
      onSubmit={(identifier, password) =>
        run(() => login(identifier, password))
      }
    />
  ) : (
    <SignupForm
      error={error}
      isSubmitting={isSubmitting}
      onShowLogin={() => changeMode("login")}
      onSubmit={(email, username, password) =>
        run(() => register({ email, username, password }))
      }
    />
  );
}

function getAuthError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "Bir sorun oluştu. Lütfen tekrar deneyin.";
  }

  const validationMessage = Object.values(error.errors).flat()[0];
  if (validationMessage) return validationMessage;

  if (error.status === 401) {
    return "E-posta, kullanıcı adı veya parola hatalı.";
  }

  if (error.status === 429) {
    return "Çok fazla deneme yapıldı. Lütfen bekleyip tekrar deneyin.";
  }

  return error.message;
}
