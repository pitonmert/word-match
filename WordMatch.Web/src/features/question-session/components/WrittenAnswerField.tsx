import { Button } from "@/components/ui/button";
import { QuestionAutoAdvanceNotice } from "@/features/question-session/components/QuestionAutoAdvanceNotice";
import { Input } from "@/components/ui/input";
import {
  questionFlowButtonClassName,
  questionRevealButtonClassName,
} from "@/features/question-session/styles";
import type { QuestionOutcome } from "@/features/question-session/types";
import { cn } from "@/lib/utils";

type WrittenAnswerFieldProps = {
  answerError: string | null;
  answerLanguage: string;
  answerOutcome: QuestionOutcome | null;
  canAdvance: boolean;
  correctAnswers: string[];
  hasAnswered: boolean;
  isLastQuestion: boolean;
  isLoading: boolean;
  isSubmittingAnswer: boolean;
  value: string;
  onChange: (value: string) => void;
  onCheck: () => void;
  onContinue: () => void;
  onRetryAnswer: () => void;
  onShowAnswer: () => void;
  verticallyCentered?: boolean;
};

export function WrittenAnswerField({
  answerError,
  answerLanguage,
  answerOutcome,
  canAdvance,
  correctAnswers,
  hasAnswered,
  isLastQuestion,
  isLoading,
  isSubmittingAnswer,
  value,
  onChange,
  onCheck,
  onContinue,
  onRetryAnswer,
  onShowAnswer,
  verticallyCentered = false,
}: WrittenAnswerFieldProps) {
  const correctAnswer = correctAnswers.join(", ");
  const displayedValue =
    answerOutcome === "Review" && correctAnswer
      ? correctAnswer
      : answerOutcome === "Wrong"
        ? `${value} → ${correctAnswer}`
        : value;

  return (
    <div className="flex h-full justify-center">
      <div
        aria-label="Yazılı cevap alanı"
        className={cn(
          "w-full max-w-sm",
          verticallyCentered && "relative h-full",
        )}
        role="group"
      >
        <div
          className={cn(
            "relative grid w-full gap-1.5",
            verticallyCentered
              ? "absolute top-[calc(50%-2.5rem)] -translate-y-1/2"
              : "content-start pt-4",
          )}
        >
          <div className="h-12">
            <div
              className={cn(
                "flex h-12 items-center rounded-lg border border-input bg-card px-4 text-left transition-[background-color,border-color,box-shadow]",
                !hasAnswered && "focus-within:border-muted-foreground",
                answerOutcome === "Correct" &&
                  "border-success bg-success-subtle text-success",
                answerOutcome === "Wrong" &&
                  "border-error bg-error-subtle text-error",
                answerOutcome === "Review" &&
                  "border-warning bg-warning-subtle text-warning",
              )}
            >
              <Input
                autoComplete="off"
                aria-label={`${answerLanguage} cevap`}
                aria-invalid={answerOutcome === "Wrong"}
                className={cn(
                  "h-full border-0 bg-transparent p-0 text-left font-semibold select-text placeholder:text-xs placeholder:font-normal placeholder:text-muted-foreground/60 focus-visible:border-transparent focus-visible:ring-0 aria-invalid:border-0 aria-invalid:ring-0",
                  answerOutcome !== null && "text-inherit",
                  hasAnswered && "cursor-default caret-transparent",
                )}
                enterKeyHint={hasAnswered ? "next" : "done"}
                placeholder={
                  hasAnswered
                    ? undefined
                    : `${answerLanguage} karşılığını yazın`
                }
                readOnly={hasAnswered}
                value={displayedValue}
                onChange={(event) => onChange(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.nativeEvent.isComposing)
                    return;
                  event.preventDefault();
                  if (hasAnswered) {
                    if (answerOutcome !== "Correct" && canAdvance) onContinue();
                  } else if (value.trim().length > 0) {
                    onCheck();
                  }
                }}
              />
            </div>
          </div>

          <div className="h-12">
            {answerOutcome === "Correct" && !isLastQuestion ? (
              <QuestionAutoAdvanceNotice />
            ) : answerError ? (
              <Button
                className={cn(questionFlowButtonClassName, "w-full")}
                disabled={isSubmittingAnswer}
                type="button"
                variant="outline"
                onClick={onRetryAnswer}
              >
                {isSubmittingAnswer
                  ? "Kaydediliyor..."
                  : "Kaydetmeyi tekrar dene"}
              </Button>
            ) : hasAnswered ? (
              <Button
                className={cn(questionFlowButtonClassName, "w-full")}
                disabled={!canAdvance}
                type="button"
                variant="outline"
                onClick={onContinue}
              >
                {isSubmittingAnswer
                  ? "Kaydediliyor..."
                  : isLastQuestion
                    ? "Sonuçları gör"
                    : "Devam et"}
              </Button>
            ) : (
              <div className="flex size-full gap-2">
                <Button
                  className={cn(
                    questionRevealButtonClassName,
                    "min-w-0 flex-1",
                  )}
                  disabled={isLoading}
                  type="button"
                  variant="outline"
                  onClick={onShowAnswer}
                >
                  Cevabı göster
                </Button>
                <Button
                  className="h-full min-w-0 flex-1"
                  disabled={isLoading || value.trim().length === 0}
                  type="button"
                  onClick={onCheck}
                >
                  Cevabı kontrol et
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
