import type { QuestionOutcome } from "@/features/question-session/types";

export function AnswerAnnouncement({
  isLastQuestion,
  outcome,
}: {
  isLastQuestion: boolean;
  outcome: QuestionOutcome | null;
}) {
  if (!outcome) return null;

  const result =
    outcome === "Correct"
      ? "Doğru cevap."
      : outcome === "Wrong"
        ? "Yanlış cevap. Doğru cevap gösteriliyor."
        : "Cevap gösterildi.";
  const nextStep =
    outcome === "Correct"
      ? isLastQuestion
        ? "Devam etmek için Sonuçları gör düğmesini kullanın."
        : "Sonraki soru otomatik olarak yüklenecek."
      : isLastQuestion
        ? "Devam etmek için Sonuçları gör düğmesini kullanın."
        : "İlerlemek için Devam et düğmesini kullanın.";

  return (
    <p aria-atomic="true" aria-live="polite" className="sr-only">
      {result} {nextStep}
    </p>
  );
}
