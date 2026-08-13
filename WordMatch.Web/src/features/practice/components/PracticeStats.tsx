import { ArrowLeft, CircleCheck, CircleHelp, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PracticeProgress } from "@/features/practice/components/PracticeProgress";
import type { PracticeResultCategory } from "@/features/practice/components/results/types";
import { cn } from "@/lib/utils";

type ScoreProps = {
  disabled: boolean;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
  value: number;
  variant: "correct" | "unknown" | "wrong";
};

function Score({
  disabled,
  isSelected,
  label,
  onSelect,
  value,
  variant,
}: ScoreProps) {
  const Icon =
    variant === "correct"
      ? CircleCheck
      : variant === "unknown"
        ? CircleHelp
        : CircleX;
  return (
    <Button
      aria-label={
        isSelected
          ? `${label}: ${value}. Sonuç listesini kapat`
          : `${label}: ${value}`
      }
      aria-pressed={isSelected}
      className={cn(
        "h-auto gap-1 p-0",
        isSelected && "rounded-md bg-muted px-1",
      )}
      disabled={disabled || value === 0}
      size="xs"
      type="button"
      variant="ghost"
      onClick={onSelect}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-4",
          variant === "correct"
            ? "text-success"
            : variant === "unknown"
              ? "text-warning"
              : "text-error",
        )}
      />
      <span
        className={cn(
          "text-sm leading-none font-semibold tabular-nums",
          variant === "correct"
            ? "text-success"
            : variant === "unknown"
              ? "text-warning"
              : "text-error",
        )}
      >
        {value}
      </span>
    </Button>
  );
}

type PracticeStatsProps = {
  correctCount: number;
  isResultSelectionDisabled: boolean;
  onChangeMode: () => void;
  onResultSelect: (category: PracticeResultCategory) => void;
  reviewCount: number;
  selectedResultCategory: PracticeResultCategory | null;
  totalCount: number;
  wrongCount: number;
};

export function PracticeStats({
  correctCount,
  isResultSelectionDisabled,
  onChangeMode,
  onResultSelect,
  reviewCount,
  selectedResultCategory,
  totalCount,
  wrongCount,
}: PracticeStatsProps) {
  const answeredCount = correctCount + reviewCount + wrongCount;

  return (
    <div className="grid size-full grid-rows-[1fr_auto] gap-2 px-4 py-2.5">
      <div className="grid min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Button
          className="justify-self-start"
          aria-label="Modlara dön"
          size="xs"
          title="Çalışma modlarına dön"
          type="button"
          variant="ghost"
          onClick={onChangeMode}
        >
          <ArrowLeft aria-hidden="true" />
          Modlar
        </Button>

        <span
          aria-label={`${totalCount} sorudan ${answeredCount} tanesi cevaplandı`}
          className="type-label justify-self-center text-muted-foreground tabular-nums"
        >
          {answeredCount} / {totalCount || "—"}
        </span>

        <div className="flex items-center gap-2.5 justify-self-end">
          <Score
            disabled={isResultSelectionDisabled}
            isSelected={selectedResultCategory === "correct"}
            label="Doğru cevaplar"
            onSelect={() => onResultSelect("correct")}
            value={correctCount}
            variant="correct"
          />
          <Score
            disabled={isResultSelectionDisabled}
            isSelected={selectedResultCategory === "review"}
            label="Tekrar edilecek kelimeler"
            onSelect={() => onResultSelect("review")}
            value={reviewCount}
            variant="unknown"
          />
          <Score
            disabled={isResultSelectionDisabled}
            isSelected={selectedResultCategory === "wrong"}
            label="Yanlış cevaplar"
            onSelect={() => onResultSelect("wrong")}
            value={wrongCount}
            variant="wrong"
          />
        </div>
      </div>

      <PracticeProgress answeredCount={answeredCount} totalCount={totalCount} />
    </div>
  );
}
