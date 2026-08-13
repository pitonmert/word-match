import { Button } from "@/components/ui/button";

export function AuthLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <main className="flex min-h-svh min-w-0 items-center justify-center overflow-x-hidden overflow-y-auto bg-background px-4 py-8">
      <section className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div>
            <p className="type-section-title">Word Match</p>
            <h1 className="type-page-title mt-1">{title}</h1>
          </div>
        </div>
        <div className="rounded-lg bg-card p-6 shadow-surface">{children}</div>
      </section>
    </main>
  );
}

export function AuthField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="type-body grid gap-2 font-medium">
      {label}
      {children}
    </label>
  );
}

export function AuthError({
  id,
  message,
}: {
  id?: string;
  message: string | null;
}) {
  return message ? (
    <p className="type-body text-error" id={id} role="alert">
      {message}
    </p>
  ) : null;
}

export function AuthSwitch({
  action,
  label,
  onClick,
}: {
  action: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <p className="type-body mt-5 text-center text-muted-foreground">
      {label}{" "}
      <Button
        className="h-auto p-0 font-medium"
        type="button"
        variant="link"
        onClick={onClick}
      >
        {action}
      </Button>
    </p>
  );
}
