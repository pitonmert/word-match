import { z } from "zod";
import { apiRequest } from "@/lib/api/client";

export const masteryDimensionSchema = z.enum([
  "WrittenRecognition",
  "WrittenRecall",
  "AuralRecognition",
  "SpokenRecall",
]);
export type MasteryDimension = z.infer<typeof masteryDimensionSchema>;

export const studySessionModeSchema = z.enum(["Topic", "Review"]);
export type StudySessionMode = z.infer<typeof studySessionModeSchema>;

export const studyOutcomeSchema = z.enum(["Correct", "Review", "Wrong"]);
export type StudyOutcome = z.infer<typeof studyOutcomeSchema>;

const studyTopicSchema = z.object({
  id: z.number().int().positive(),
  level: z.string(),
  topic: z.string(),
  introducedWordCount: z.number().int().nonnegative(),
  recognitionWordCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  isCompleted: z.boolean(),
});
export type StudyTopic = z.infer<typeof studyTopicSchema>;

const studyNextActionSchema = z.object({
  kind: z.enum(["Resume", "StartTopic", "Unavailable"]),
  sessionId: z.string().nullable(),
  topic: studyTopicSchema.nullable(),
});
export type StudyNextAction = z.infer<typeof studyNextActionSchema>;

const studyLevelSchema = z.object({
  level: z.string(),
  topics: z.array(studyTopicSchema),
});
export type StudyLevel = z.infer<typeof studyLevelSchema>;

export const studyOverviewSchema = z.object({
  curriculumTopic: studyTopicSchema.nullable(),
  curriculumCompleted: z.boolean(),
  reviewQuestionCount: z.number().int().nonnegative(),
  nextAction: studyNextActionSchema.nullable(),
  levels: z.array(studyLevelSchema),
});
export type StudyOverview = z.infer<typeof studyOverviewSchema>;

const studyQuestionSchema = z.object({
  position: z.number().int().nonnegative(),
  wordId: z.number().int().positive(),
  dimension: masteryDimensionSchema,
  kind: z.enum(["MultipleChoice", "Written"]),
  prompt: z.string(),
  options: z.array(z.string()),
  isIntroduction: z.boolean(),
});
export type StudyQuestion = z.infer<typeof studyQuestionSchema>;

const studyProgressSchema = z.object({
  answeredCount: z.number().int().nonnegative(),
  totalCount: z.number().int().positive(),
  correctCount: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
});

const studyResultSchema = z.object({
  wordId: z.number().int().positive(),
  dimension: masteryDimensionSchema,
  prompt: z.string(),
  correctAnswer: z.string(),
  selectedAnswer: z.string().nullable(),
  outcome: studyOutcomeSchema,
  isIntroduction: z.boolean(),
});

const studySummarySchema = z.object({
  introducedWordCount: z.number().int().nonnegative(),
  strengthenedWordCount: z.number().int().nonnegative(),
  nextReviewAtUtc: z.string().nullable(),
  topicCompleted: z.boolean(),
  reviewQuestionCount: z.number().int().nonnegative(),
  canContinue: z.boolean(),
  results: z.array(studyResultSchema),
});
export type StudySummary = z.infer<typeof studySummarySchema>;

export const studySessionSchema = z.object({
  sessionId: z.string(),
  status: z.enum(["Active", "Completed", "Abandoned"]),
  mode: studySessionModeSchema,
  topic: studyTopicSchema.nullable(),
  progress: studyProgressSchema,
  question: studyQuestionSchema.nullable(),
  summary: studySummarySchema,
});
export type StudySession = z.infer<typeof studySessionSchema>;

export const studyAnswerSchema = z.object({
  outcome: studyOutcomeSchema,
  correctIndex: z.number().int().nonnegative().nullable(),
  selectedIndex: z.number().int().nonnegative().nullable(),
  writtenAnswer: z.string().nullable(),
  correctAnswer: z.string(),
  isComplete: z.boolean(),
  session: studySessionSchema,
});
export type StudyAnswer = z.infer<typeof studyAnswerSchema>;

export const studyOverviewQueryKey = ["study", "overview"] as const;

export function fetchStudyOverview(signal?: AbortSignal) {
  return apiRequest("/api/study", studyOverviewSchema, { signal });
}

/**
 * Explicitly starts a selected topic or a review. The primary Study action
 * uses continueStudySession so the server can resume active work first.
 */
export function startStudySession({
  mode,
  curriculumTopicId = null,
  replaceActiveSession = false,
}: {
  mode: StudySessionMode;
  curriculumTopicId?: number | null;
  replaceActiveSession?: boolean;
}) {
  return apiRequest("/api/study-sessions", studySessionSchema, {
    method: "POST",
    body: { mode, curriculumTopicId, replaceActiveSession },
  });
}

export function continueStudySession() {
  return apiRequest("/api/study-sessions/continue", studySessionSchema, {
    method: "POST",
  });
}

/** Transfers the currently open Study work to this browser. */
export function takeOverStudySession() {
  return apiRequest("/api/study-sessions/takeover", studySessionSchema, {
    method: "POST",
  });
}

export function continueAfterStudySession(sessionId: string) {
  return apiRequest(
    `/api/study-sessions/${sessionId}/continue`,
    studySessionSchema,
    { method: "POST" },
  );
}

export function fetchStudySession(sessionId: string, signal?: AbortSignal) {
  return apiRequest(`/api/study-sessions/${sessionId}`, studySessionSchema, {
    signal,
  });
}

export function answerStudyQuestion(
  sessionId: string,
  position: number,
  wordId: number,
  selectedIndex: number | null,
  writtenAnswer: string | null,
) {
  return apiRequest(
    `/api/study-sessions/${sessionId}/answers`,
    studyAnswerSchema,
    {
      method: "POST",
      body: { position, wordId, selectedIndex, writtenAnswer },
    },
  );
}

/** Temporarily excludes one skill while the server replans unanswered questions. */
export function deferStudySkill(
  sessionId: string,
  dimension: MasteryDimension,
) {
  return apiRequest(
    `/api/study-sessions/${sessionId}/deferrals`,
    studySessionSchema,
    {
      method: "POST",
      body: { dimension },
    },
  );
}

/** Ends an in-progress session when the learner returns to the dashboard. */
export function abandonStudySession(sessionId: string) {
  return apiRequest(`/api/study-sessions/${sessionId}`, z.void(), {
    method: "DELETE",
  });
}
