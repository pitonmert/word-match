import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  PracticeOutcome,
  PracticeQuestion,
} from "@/features/practice/api/practice";
import { practiceFlowButtonClassName } from "@/features/practice/components/practiceStyles";
import { cn } from "@/lib/utils";

type WrittenAnswerFieldProps = {
  answerError: string | null;
  answerOutcome: PracticeOutcome | null;
  canAdvance: boolean;
  hasAnswered: boolean;
  isLastQuestion: boolean;
  isLoading: boolean;
  isSubmittingAnswer: boolean;
  question: PracticeQuestion;
  value: string;
  onChange: (value: string) => void;
  onCheck: () => void;
  onContinue: () => void;
  onRetryAnswer: () => void;
  onShowAnswer: () => void;
};

export function WrittenAnswerField({
  answerError,
  answerOutcome,
  canAdvance,
  hasAnswered,
  isLastQuestion,
  isLoading,
  isSubmittingAnswer,
  question,
  value,
  onChange,
  onCheck,
  onContinue,
  onRetryAnswer,
  onShowAnswer,
}: WrittenAnswerFieldProps) {
  const correctAnswer = question.acceptedAnswers.join(", ");
  const answerLanguage =
    question.direction === "EnglishToTurkish" ? "Türkçe" : "İngilizce";
  const feedback =
    answerOutcome === "Wrong"
      ? `Doğru cevap: ${correctAnswer}`
      : answerOutcome === "Review" && question.acceptedAnswers.length > 1
        ? `Kabul edilen cevaplar: ${correctAnswer}`
        : null;

  return (
    <div className="flex h-full justify-center">
      <div
        aria-label="Yazılı cevap alanı"
        className="grid w-full max-w-sm content-start gap-2 pt-4"
        role="group"
      >
        <div
          className={cn(
            "flex h-12 items-center gap-2 rounded-lg border border-input bg-card px-4 text-left transition-[background-color,border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
            answerOutcome === "Correct" &&
              "border-success bg-success-subtle text-success focus-within:border-success focus-within:ring-success/30",
            answerOutcome === "Wrong" &&
              "border-error bg-error-subtle text-error focus-within:border-error focus-within:ring-error/30",
            answerOutcome === "Review" &&
              "border-warning bg-warning-subtle text-warning focus-within:border-warning focus-within:ring-warning/30",
          )}
        >
          <span
            aria-hidden="true"
            className="shrink-0 font-semibold text-muted-foreground"
          >
            {answerLanguage}:
          </span>
          <Input
            autoComplete="off"
            aria-label={`${answerLanguage} cevap`}
            aria-invalid={answerOutcome === "Wrong"}
            className={cn(
              "h-full border-0 bg-transparent p-0 text-left font-semibold select-text focus-visible:border-transparent focus-visible:ring-0 aria-invalid:border-0 aria-invalid:ring-0",
              answerOutcome !== null && "text-inherit",
            )}
            enterKeyHint={hasAnswered ? "next" : "done"}
            readOnly={hasAnswered}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) {
                return;
              }

              event.preventDefault();
              if (hasAnswered) {
                if (answerOutcome !== "Correct" && canAdvance) onContinue();
              } else if (value.trim().length > 0) {
                onCheck();
              }
            }}
          />
        </div>

        <div className="h-10">
          {answerOutcome === "Correct" ? null : answerError ? (
            <Button
              className={cn(practiceFlowButtonClassName, "h-10 w-full")}
              disabled={isSubmittingAnswer}
              type="button"
              variant="outline"
              onClick={onRetryAnswer}
            >
              {isSubmittingAnswer
                ? "Kaydediliyor..."
                : "Kaydetmeyi tekrar dene"}
            </Button>
          ) : (
            <WrittenAnswerControls
              canAdvance={canAdvance}
              hasAnswered={hasAnswered}
              isLastQuestion={isLastQuestion}
              isLoading={isLoading}
              isSubmittingAnswer={isSubmittingAnswer}
              value={value}
              onCheck={onCheck}
              onContinue={onContinue}
              onShowAnswer={onShowAnswer}
            />
          )}
        </div>

        <p
          aria-live="polite"
          className={cn(
            "type-helper min-h-5 text-center",
            answerOutcome === "Wrong" ? "text-error" : "text-muted-foreground",
          )}
        >
          {feedback}
        </p>
      </div>
    </div>
  );
}

type WrittenAnswerControlsProps = {
  canAdvance: boolean;
  hasAnswered: boolean;
  isLastQuestion: boolean;
  isLoading: boolean;
  isSubmittingAnswer: boolean;
  value: string;
  onCheck: () => void;
  onContinue: () => void;
  onShowAnswer: () => void;
};

function WrittenAnswerControls({
  canAdvance,
  hasAnswered,
  isLastQuestion,
  isLoading,
  isSubmittingAnswer,
  value,
  onCheck,
  onContinue,
  onShowAnswer,
}: WrittenAnswerControlsProps) {
  if (hasAnswered) {
    return (
      <Button
        className={cn(practiceFlowButtonClassName, "w-full")}
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
    );
  }

  return (
    <div className="flex size-full gap-2">
      <Button
        className="h-full min-w-0 flex-1"
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
  );
}
