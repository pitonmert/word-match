import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AuthError,
  AuthField,
  AuthLayout,
  AuthSwitch,
} from "@/features/auth/components/AuthFormPrimitives";

type LoginFormProps = {
  error: string | null;
  isSubmitting: boolean;
  onShowSignup: () => void;
  onSubmit: (identifier: string, password: string) => Promise<void>;
};

export function LoginForm({
  error,
  isSubmitting,
  onShowSignup,
  onSubmit,
}: LoginFormProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(identifier, password);
  };

  return (
    <AuthLayout title="Tekrar hoş geldiniz">
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <AuthField label="E-posta veya kullanıcı adı">
          <Input
            aria-describedby={error ? "login-form-error" : undefined}
            aria-invalid={Boolean(error)}
            autoComplete="username"
            disabled={isSubmitting}
            name="identifier"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
          />
        </AuthField>
        <AuthField label="Parola">
          <Input
            aria-describedby={error ? "login-form-error" : undefined}
            aria-invalid={Boolean(error)}
            autoComplete="current-password"
            disabled={isSubmitting}
            minLength={8}
            name="password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </AuthField>
        <AuthError id="login-form-error" message={error} />
        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Giriş yapılıyor..." : "Giriş yap"}
        </Button>
      </form>
      <AuthSwitch
        action="Hesap oluştur"
        label="Word Match'te yeni misiniz?"
        onClick={onShowSignup}
      />
    </AuthLayout>
  );
}
