import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  answerPracticeQuestion,
  fetchPracticeSession,
  type PracticeAnswer,
  type PracticeQuestion,
  type PracticeSession,
} from "@/features/practice/api/practice";
import {
  createQuestionSessionState,
  questionSessionReducer,
  useQuestionSession,
} from "@/features/practice/hooks/useQuestionSession";

vi.mock("@/features/practice/api/practice", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/features/practice/api/practice")>();

  return {
    ...original,
    answerPracticeQuestion: vi.fn(),
    fetchPracticeSession: vi.fn(),
  };
});

const mockedAnswer = vi.mocked(answerPracticeQuestion);
const mockedFetchSession = vi.mocked(fetchPracticeSession);

afterEach(() => {
  vi.clearAllMocks();
});

const appleQuestion: PracticeQuestion = {
  position: 0,
  wordId: 1,
  direction: "EnglishToTurkish",
  format: "MultipleChoice",
  prompt: "apple",
  options: ["elma", "armut", "kiraz", "muz"],
  correctIndex: 0,
  acceptedAnswers: [],
};

function buildSession(
  overrides: Partial<PracticeSession> = {},
): PracticeSession {
  return {
    sessionId: "session-1",
    status: "Active",
    level: "A1",
    topic: "Food",
    mode: "EnglishToTurkish",
    progress: {
      answeredCount: 0,
      totalCount: 3,
      correctCount: 0,
      reviewCount: 0,
      wrongCount: 0,
    },
    question: appleQuestion,
    upcomingQuestions: [],
    results: { correct: [], review: [], wrong: [] },
    ...overrides,
  };
}

function buildAnswer(session = buildSession()): PracticeAnswer {
  return {
    outcome: "Correct",
    correctIndex: 0,
    selectedIndex: 0,
    writtenAnswer: null,
    correctAnswer: "elma",
    progress: session.progress,
    isComplete: session.status === "Completed",
    session,
  };
}

describe("questionSessionReducer", () => {
  const answerStarted = {
    type: "answerStarted" as const,
    selectedIndex: 0,
    correctIndex: 0,
    isUnknown: false,
    outcome: "Correct" as const,
  };

  it("transitions from answering to submitting to answered", () => {
    const submitting = questionSessionReducer(
      createQuestionSessionState(buildSession()),
      answerStarted,
    );
    const answered = questionSessionReducer(submitting, {
      type: "answerSucceeded",
      answer: buildAnswer(),
    });

    expect(submitting.phase).toBe("submitting");
    expect(answered.phase).toBe("answered");
    expect(answered.pendingSession).not.toBeNull();
  });

  it("transitions from submitting to saveError and retries submission", () => {
    const submitting = questionSessionReducer(
      createQuestionSessionState(buildSession()),
      answerStarted,
    );
    const saveError = questionSessionReducer(submitting, {
      type: "answerFailed",
    });
    const retrying = questionSessionReducer(saveError, answerStarted);

    expect(saveError.phase).toBe("saveError");
    expect(saveError.answerError).toBe("Cevap kaydedilemedi.");
    expect(retrying.phase).toBe("submitting");
    expect(retrying.answerError).toBeNull();
  });

  it("transitions from answered to the next question", () => {
    const answered = questionSessionReducer(
      questionSessionReducer(
        createQuestionSessionState(buildSession()),
        answerStarted,
      ),
      { type: "answerSucceeded", answer: buildAnswer() },
    );
    const nextQuestion = questionSessionReducer(answered, {
      type: "advanced",
      session: buildSession({ question: { ...appleQuestion, position: 1 } }),
    });

    expect(nextQuestion.phase).toBe("answering");
    expect(nextQuestion.session?.question?.position).toBe(1);
  });

  it("transitions from answered to completed with the final session", () => {
    const completedSession = buildSession({
      status: "Completed",
      question: null,
    });
    const answered = questionSessionReducer(
      questionSessionReducer(
        createQuestionSessionState(buildSession()),
        answerStarted,
      ),
      { type: "answerSucceeded", answer: buildAnswer(completedSession) },
    );
    const completed = questionSessionReducer(answered, {
      type: "advanced",
      session: completedSession,
    });

    expect(completed.phase).toBe("completed");
  });
});

describe("useQuestionSession", () => {
  it("reloads the session when submitting an answer returns a 409 conflict", async () => {
    const initialSession = buildSession();
    const reloadedSession = buildSession({
      progress: {
        answeredCount: 1,
        totalCount: 3,
        correctCount: 1,
        reviewCount: 0,
        wrongCount: 0,
      },
    });

    mockedFetchSession
      .mockResolvedValueOnce(initialSession)
      .mockResolvedValueOnce(reloadedSession);
    mockedAnswer.mockRejectedValueOnce(new ApiError("Conflict", 409));

    const { result } = renderHook(() => useQuestionSession("session-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleAnswer(0);
    });

    await waitFor(() => expect(mockedFetchSession).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.correctCount).toBe(
        reloadedSession.progress.correctCount,
      ),
    );

    expect(result.current.answerError).toBeNull();
    expect(result.current.isSubmittingAnswer).toBe(false);
  });

  it("ignores an aborted session load without setting an error", async () => {
    mockedFetchSession.mockRejectedValueOnce(
      new DOMException("Aborted", "AbortError"),
    );

    const { result } = renderHook(() => useQuestionSession("session-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.session).toBeNull();
  });
});
