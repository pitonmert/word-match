import { CircleCheck, CircleHelp, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionSessionProgress } from "@/features/question-session/components/QuestionSessionProgress";
import type { QuestionResultCategory } from "@/features/question-session/types";
import { cn } from "@/lib/utils";

type QuestionSessionStatsProps = {
  correctCount: number;
  correctScoreLabel?: string;
  isResultSelectionDisabled: boolean;
  reviewCount: number;
  reviewScoreLabel?: string;
  selectedResultCategory: QuestionResultCategory | null;
  totalCount: number;
  wrongCount: number;
  wrongScoreLabel?: string;
  onResultSelect: (category: QuestionResultCategory) => void;
};

export function QuestionSessionStats({
  correctCount,
  correctScoreLabel = "Doğru cevaplar",
  isResultSelectionDisabled,
  reviewCount,
  reviewScoreLabel = "Tekrar edilecek kelimeler",
  selectedResultCategory,
  totalCount,
  wrongCount,
  wrongScoreLabel = "Yanlış cevaplar",
  onResultSelect,
}: QuestionSessionStatsProps) {
  const answeredCount = correctCount + reviewCount + wrongCount;

  return (
    <div className="grid size-full grid-rows-[1rem_0.25rem_1rem] gap-2 px-6 py-3.5">
      <span
        aria-label={`${totalCount} sorudan ${answeredCount} tanesi cevaplandı`}
        className="type-label text-center text-muted-foreground tabular-nums"
      >
        {answeredCount} / {totalCount || "—"}
      </span>
      <QuestionSessionProgress
        answeredCount={answeredCount}
        className="h-1"
        totalCount={totalCount}
      />
      <div className="flex items-center justify-center gap-2.5">
        <Score
          label={correctScoreLabel}
          value={correctCount}
          variant="correct"
        />
        <Score
          disabled={isResultSelectionDisabled}
          isSelected={selectedResultCategory === "review"}
          label={reviewScoreLabel}
          value={reviewCount}
          variant="review"
          onSelect={() => onResultSelect("review")}
        />
        <Score
          disabled={isResultSelectionDisabled}
          isSelected={selectedResultCategory === "wrong"}
          label={wrongScoreLabel}
          value={wrongCount}
          variant="wrong"
          onSelect={() => onResultSelect("wrong")}
        />
      </div>
    </div>
  );
}

function Score({
  disabled,
  isSelected,
  label,
  value,
  variant,
  onSelect,
}: {
  disabled?: boolean;
  isSelected?: boolean;
  label: string;
  value: number;
  variant: "correct" | "review" | "wrong";
  onSelect?: () => void;
}) {
  const Icon =
    variant === "correct"
      ? CircleCheck
      : variant === "review"
        ? CircleHelp
        : CircleX;
  const contents = (
    <>
      <Icon
        aria-hidden="true"
        className={cn(
          variant === "correct"
            ? "text-success"
            : variant === "review"
              ? "text-warning"
              : "text-error",
        )}
      />
      <span
        className={cn(
          "text-sm leading-none font-semibold tabular-nums",
          variant === "correct"
            ? "text-success"
            : variant === "review"
              ? "text-warning"
              : "text-error",
        )}
      >
        {value}
      </span>
    </>
  );

  if (!onSelect) {
    return (
      <span
        aria-label={`${label}: ${value}`}
        className="flex h-auto items-center gap-1"
      >
        {contents}
      </span>
    );
  }

  return (
    <Button
      aria-label={
        isSelected
          ? `${label}: ${value}. Sonuç listesini kapat`
          : `${label}: ${value}`
      }
      aria-pressed={isSelected}
      className={cn(
        "h-auto gap-1 bg-transparent p-0 shadow-none hover:bg-transparent hover:shadow-none active:bg-transparent disabled:bg-transparent disabled:shadow-none",
        isSelected &&
          "rounded-none bg-transparent px-0 underline decoration-muted-foreground/60 underline-offset-4",
      )}
      disabled={disabled || value === 0}
      size="xs"
      type="button"
      variant="ghost"
      onClick={onSelect}
    >
      {contents}
    </Button>
  );
}
