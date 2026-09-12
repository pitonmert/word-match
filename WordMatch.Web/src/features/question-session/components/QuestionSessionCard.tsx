import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type QuestionSessionCardProps = {
  announcement?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  footer?: ReactNode;
  footerClassName?: string;
  header?: ReactNode;
  headerClassName?: string;
  layout?: "default" | "question";
  transitionDirection?: "back" | "forward" | "none";
};

export function QuestionSessionCard({
  announcement,
  children,
  contentClassName,
  footer,
  footerClassName,
  header,
  headerClassName,
  layout = "default",
  transitionDirection = "forward",
}: QuestionSessionCardProps) {
  const transitionClassName = cn(
    transitionDirection !== "none" &&
      "motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in",
    transitionDirection === "forward" && "motion-safe:slide-in-from-right-2",
    transitionDirection === "back" && "motion-safe:slide-in-from-left-2",
  );

  const card = (
    <Card
      className={cn(
        "grid max-h-full min-h-80 w-full gap-0 border border-border py-0 shadow-surface",
        layout === "question"
          ? "h-104 grid-rows-[3.5rem_minmax(0,1fr)_5rem]"
          : header === undefined
            ? "h-112 grid-rows-[minmax(0,1fr)_4rem]"
            : "h-112 grid-rows-[4rem_minmax(0,1fr)_4rem]",
      )}
    >
      {header === undefined ? null : (
        <CardHeader
          className={cn(
            "min-h-0 bg-card",
            layout === "question" ? "px-6 pt-2 pb-0" : "border-b px-3 py-0",
            transitionClassName,
            headerClassName,
          )}
        >
          {header}
        </CardHeader>
      )}

      <CardContent
        className={cn(
          "relative min-h-0",
          transitionClassName,
          contentClassName,
        )}
      >
        {children}
        {announcement}
      </CardContent>

      <CardFooter
        className={cn("min-h-0 bg-card", transitionClassName, footerClassName)}
      >
        {footer}
      </CardFooter>
    </Card>
  );

  return (
    <main className="h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain">
      <section className="mx-auto flex size-full min-h-0 w-full max-w-2xl items-center justify-center p-4 sm:px-6 sm:py-8">
        {card}
      </section>
    </main>
  );
}

export function QuestionSessionHeaderRow({
  children,
  className,
  leftContent,
  rightContent,
}: {
  children: ReactNode;
  className?: string;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid w-full min-w-0 grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center",
        className,
      )}
    >
      {leftContent === undefined ? (
        <span aria-hidden="true" />
      ) : (
        <div className="flex justify-start">{leftContent}</div>
      )}
      {children}
      <div className="flex justify-end">{rightContent}</div>
    </div>
  );
}

export function QuestionSessionCardTitle({
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
