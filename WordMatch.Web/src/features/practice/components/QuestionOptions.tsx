import { CircleCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PracticeQuestion } from "@/features/practice/api/practice";
import { cn } from "@/lib/utils";

type QuestionOptionsProps = {
  hasAnswered: boolean;
  isLoading: boolean;
  question: PracticeQuestion;
  correctIndex: number | null;
  selectedIndex: number | null;
  onAnswer: (index: number) => void;
};

export function QuestionOptions({
  hasAnswered,
  isLoading,
  question,
  correctIndex,
  selectedIndex,
  onAnswer,
}: QuestionOptionsProps) {
  return (
    <div className="grid h-full grid-rows-4 gap-2">
      {question.options.map((option, index) => {
        const isCorrectOption = correctIndex === index;
        const isSelectedWrongOption =
          selectedIndex === index && !isCorrectOption;
        const StatusIcon = isCorrectOption
          ? CircleCheck
          : isSelectedWrongOption
            ? CircleX
            : null;

        return (
          <Button
            key={option}
            className={cn(
              "relative size-full min-h-0 justify-center px-4 text-center text-base whitespace-normal sm:px-12",
              !hasAnswered &&
                "hover:border-info hover:bg-info-subtle hover:text-info hover:shadow-surface focus-visible:border-info focus-visible:ring-info/30",
              hasAnswered &&
                isCorrectOption &&
                "border-success bg-success-subtle text-success shadow-surface hover:bg-success-subtle disabled:border-success disabled:bg-success-subtle disabled:text-success disabled:opacity-100",
              hasAnswered &&
                isSelectedWrongOption &&
                "border-error bg-error-subtle text-error shadow-surface hover:bg-error-subtle disabled:border-error disabled:bg-error-subtle disabled:text-error disabled:opacity-100",
              hasAnswered &&
                !isCorrectOption &&
                !isSelectedWrongOption &&
                "border-background-300 bg-background-200 text-text-700 shadow-none disabled:border-background-300 disabled:bg-background-200 disabled:text-text-700 disabled:opacity-100",
            )}
            disabled={isLoading || hasAnswered}
            aria-keyshortcuts={String(index + 1)}
            type="button"
            variant="outline"
            onClick={() => onAnswer(index)}
          >
            <span
              aria-hidden="true"
              className={cn(
                "type-label absolute left-3 hidden size-6 items-center justify-center rounded-md border tabular-nums sm:flex",
                !hasAnswered && "border-border bg-card text-muted-foreground",
                hasAnswered &&
                  isCorrectOption &&
                  "border-success bg-success text-success-foreground",
                hasAnswered &&
                  isSelectedWrongOption &&
                  "border-error bg-error text-error-foreground",
                hasAnswered &&
                  !isCorrectOption &&
                  !isSelectedWrongOption &&
                  "border-background-300 bg-background-100 text-text-700",
              )}
            >
              {index + 1}
            </span>
            {option}
            {hasAnswered && StatusIcon ? (
              <StatusIcon
                aria-hidden="true"
                className={cn(
                  "absolute right-3 size-5",
                  isCorrectOption ? "text-success" : "text-error",
                )}
              />
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}
