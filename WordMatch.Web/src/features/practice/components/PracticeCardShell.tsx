import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PracticeCardShellProps = {
  announcement?: ReactNode;
  content: ReactNode;
  contentClassName?: string;
  footer: ReactNode;
  footerClassName?: string;
  header: ReactNode;
  headerClassName?: string;
  transitionDirection?: "back" | "forward" | "none";
};

export function PracticeCardShell({
  announcement,
  content,
  contentClassName,
  footer,
  footerClassName,
  header,
  headerClassName,
  transitionDirection = "forward",
}: PracticeCardShellProps) {
  const transitionClassName = cn(
    transitionDirection !== "none" &&
      "motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in",
    transitionDirection === "forward" && "motion-safe:slide-in-from-right-2",
    transitionDirection === "back" && "motion-safe:slide-in-from-left-2",
  );

  return (
    <main className="h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain">
      <section className="mx-auto flex size-full min-h-0 w-full max-w-2xl items-center justify-center p-4 sm:px-6 sm:py-8">
        <Card className="grid h-112 max-h-full min-h-80 w-full grid-rows-[4rem_minmax(0,1fr)_4rem] gap-0 border border-border py-0 shadow-surface">
          <CardHeader
            className={cn(
              "min-h-0 border-b bg-card px-3 py-0",
              transitionClassName,
              headerClassName,
            )}
          >
            {header}
          </CardHeader>

          <CardContent
            className={cn(
              "relative min-h-0",
              transitionClassName,
              contentClassName,
            )}
          >
            {content}
            {announcement}
          </CardContent>

          <CardFooter
            className={cn(
              "min-h-0 bg-card",
              transitionClassName,
              footerClassName,
            )}
          >
            {footer}
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}
