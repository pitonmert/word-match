import type { PracticeOutcome } from "@/features/practice/api/practice";

type AnswerAnnouncementProps = {
  isLastQuestion: boolean;
  outcome: PracticeOutcome | null;
};

export function AnswerAnnouncement({
  isLastQuestion,
  outcome,
}: AnswerAnnouncementProps) {
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
        ? "Sonuçlar otomatik olarak açılacak."
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
