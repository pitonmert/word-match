import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AuthError,
  AuthField,
  AuthLayout,
  AuthSwitch,
} from "@/features/auth/components/AuthFormPrimitives";

type SignupFormProps = {
  error: string | null;
  isSubmitting: boolean;
  onShowLogin: () => void;
  onSubmit: (
    email: string,
    username: string,
    password: string,
  ) => Promise<void>;
};

export function SignupForm({
  error,
  isSubmitting,
  onShowLogin,
  onSubmit,
}: SignupFormProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(email, username, password);
  };

  return (
    <AuthLayout title="Hesabınızı oluşturun">
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <AuthField label="E-posta">
          <Input
            aria-describedby={error ? "signup-form-error" : undefined}
            aria-invalid={Boolean(error)}
            autoComplete="email"
            disabled={isSubmitting}
            name="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </AuthField>
        <AuthField label="Kullanıcı adı">
          <Input
            aria-describedby={error ? "signup-form-error" : undefined}
            aria-invalid={Boolean(error)}
            autoComplete="username"
            disabled={isSubmitting}
            maxLength={30}
            minLength={3}
            name="username"
            pattern="[A-Za-z0-9._-]+"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </AuthField>
        <AuthField label="Parola">
          <Input
            aria-describedby={
              error
                ? "password-requirements signup-form-error"
                : "password-requirements"
            }
            aria-invalid={Boolean(error)}
            autoComplete="new-password"
            disabled={isSubmitting}
            minLength={8}
            name="password"
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}"
            required
            title="En az 8 karakter, bir büyük harf, bir küçük harf ve bir rakam içermeli."
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </AuthField>
        <p className="type-helper" id="password-requirements">
          En az 8 karakter, bir büyük harf, bir küçük harf ve bir rakam
          kullanın.
        </p>
        <AuthError id="signup-form-error" message={error} />
        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Hesap oluşturuluyor..." : "Hesap oluştur"}
        </Button>
      </form>
      <AuthSwitch
        action="Giriş yap"
        label="Zaten hesabınız var mı?"
        onClick={onShowLogin}
      />
    </AuthLayout>
  );
}
