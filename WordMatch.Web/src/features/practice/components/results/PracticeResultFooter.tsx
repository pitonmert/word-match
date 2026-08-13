import { ArrowLeft, LoaderCircle, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PracticeResultFooterProps = {
  isRestartDisabled?: boolean;
  isRestarting: boolean;
  modeSelectionPath: string;
  restartError: string | null;
  onRestart: () => void;
};

export function PracticeResultFooter({
  isRestartDisabled = false,
  isRestarting,
  modeSelectionPath,
  restartError,
  onRestart,
}: PracticeResultFooterProps) {
  const actionClassName = "min-w-0 px-1";

  if (restartError) {
    return (
      <div className="flex size-full w-full items-center justify-between gap-2 px-4">
        <p
          className="type-helper min-w-0 flex-1 truncate text-error"
          role="alert"
        >
          {restartError}
        </p>
        <Button
          className="shrink-0"
          size="xs"
          type="button"
          variant="outline"
          onClick={onRestart}
        >
          Tekrar dene
        </Button>
      </div>
    );
  }

  return (
    <div className="grid size-full w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center px-4">
      <Link
        aria-label="Modlara dön"
        className={cn(
          buttonVariants({ size: "xs", variant: "ghost" }),
          actionClassName,
          "justify-self-start",
        )}
        to={modeSelectionPath}
      >
        <ArrowLeft aria-hidden="true" />
        Modlar
      </Link>

      <Button
        aria-label="Tekrar çalış"
        className={cn(actionClassName, "justify-self-center")}
        disabled={isRestartDisabled || isRestarting}
        size="xs"
        type="button"
        variant="ghost"
        onClick={onRestart}
      >
        {isRestarting ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <RotateCcw aria-hidden="true" />
        )}
        {isRestarting ? "Başlıyor" : "Tekrar"}
      </Button>
    </div>
  );
}
