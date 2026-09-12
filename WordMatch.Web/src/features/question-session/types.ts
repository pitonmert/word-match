export type QuestionOutcome = "Correct" | "Review" | "Wrong";

export type QuestionResultCategory = "review" | "wrong";

export type QuestionResultRecord = {
  key: string;
  correctAnswer: string;
  formatLabel: string;
  prompt: string;
  selectedAnswer: string | null;
};
