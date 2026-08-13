import type { ReactNode } from "react";
import { CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PracticeCardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <CardTitle
      className={cn(
        "flex min-w-0 items-center justify-center text-center text-xl/7 font-semibold sm:text-2xl sm:leading-8",
        className,
      )}
    >
      {children}
    </CardTitle>
  );
}
