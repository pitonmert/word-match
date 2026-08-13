import { z } from "zod";
import { apiRequest } from "@/lib/api/client";

export const practiceOutcomeSchema = z.enum(["Correct", "Review", "Wrong"]);
export type PracticeOutcome = z.infer<typeof practiceOutcomeSchema>;

export const practiceSessionStatusSchema = z.enum([
  "Active",
  "Completed",
  "Abandoned",
]);
export type PracticeSessionStatus = z.infer<typeof practiceSessionStatusSchema>;

export const practiceModeSchema = z.enum([
  "EnglishToTurkish",
  "TurkishToEnglish",
  "Mixed",
]);
export type PracticeMode = z.infer<typeof practiceModeSchema>;

export const questionDirectionSchema = z.enum([
  "EnglishToTurkish",
  "TurkishToEnglish",
]);
export type QuestionDirection = z.infer<typeof questionDirectionSchema>;

export const questionFormatSchema = z.enum(["MultipleChoice", "Written"]);
export type QuestionFormat = z.infer<typeof questionFormatSchema>;

export type PracticeCriteria = {
  level: string;
  topic: string;
  mode: PracticeMode;
};

export const practiceQuestionSchema = z.object({
  position: z.number().int().nonnegative(),
  wordId: z.number().int().nonnegative(),
  direction: questionDirectionSchema,
  format: questionFormatSchema,
  prompt: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number().int().nonnegative().nullable(),
  acceptedAnswers: z.array(z.string()),
});
export type PracticeQuestion = z.infer<typeof practiceQuestionSchema>;

export const practiceProgressSchema = z.object({
  answeredCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
});
export type PracticeProgress = z.infer<typeof practiceProgressSchema>;

export const practiceWordRecordSchema = z.object({
  wordId: z.number().int().nonnegative(),
  direction: questionDirectionSchema,
  format: questionFormatSchema,
  prompt: z.string(),
  correctAnswer: z.string(),
  selectedAnswer: z.string().nullable(),
});
export type PracticeWordRecord = z.infer<typeof practiceWordRecordSchema>;

export const practiceResultsSchema = z.object({
  correct: z.array(practiceWordRecordSchema),
  review: z.array(practiceWordRecordSchema),
  wrong: z.array(practiceWordRecordSchema),
});
export type PracticeResults = z.infer<typeof practiceResultsSchema>;

export const practiceResultViewSchema = z.object({
  level: z.string(),
  topic: z.string(),
  mode: practiceModeSchema,
  progress: practiceProgressSchema,
  results: practiceResultsSchema,
});
export type PracticeResultView = z.infer<typeof practiceResultViewSchema>;

export const practiceSessionSchema = z.object({
  sessionId: z.string(),
  status: practiceSessionStatusSchema,
  level: z.string(),
  topic: z.string(),
  mode: practiceModeSchema,
  progress: practiceProgressSchema,
  question: practiceQuestionSchema.nullable(),
  upcomingQuestions: z.array(practiceQuestionSchema),
  results: practiceResultsSchema,
});
export type PracticeSession = z.infer<typeof practiceSessionSchema>;

export const practiceAnswerSchema = z.object({
  outcome: practiceOutcomeSchema,
  correctIndex: z.number().int().nonnegative().nullable(),
  selectedIndex: z.number().int().nonnegative().nullable(),
  writtenAnswer: z.string().nullable(),
  correctAnswer: z.string(),
  progress: practiceProgressSchema,
  isComplete: z.boolean(),
  session: practiceSessionSchema,
});
export type PracticeAnswer = z.infer<typeof practiceAnswerSchema>;

export function startPractice(criteria: PracticeCriteria, replay = false) {
  return apiRequest("/api/practice-sessions", practiceSessionSchema, {
    method: "POST",
    body: {
      level: criteria.level,
      topic: criteria.topic,
      mode: criteria.mode,
      replay,
    },
  });
}

export function fetchPracticeSession(sessionId: string, signal?: AbortSignal) {
  return apiRequest(
    `/api/practice-sessions/${sessionId}`,
    practiceSessionSchema,
    { signal },
  );
}

export function fetchPracticeResults(
  criteria: PracticeCriteria,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams({
    level: criteria.level,
    topic: criteria.topic,
    mode: criteria.mode,
  });

  return apiRequest(
    `/api/practice-sessions/results?${searchParams.toString()}`,
    practiceResultViewSchema,
    { signal },
  );
}

export function answerPracticeQuestion(
  sessionId: string,
  position: number,
  wordId: number,
  selectedIndex: number | null,
  writtenAnswer: string | null = null,
) {
  return apiRequest(
    `/api/practice-sessions/${sessionId}/answers`,
    practiceAnswerSchema,
    {
      method: "POST",
      body: { position, wordId, selectedIndex, writtenAnswer },
    },
  );
}
