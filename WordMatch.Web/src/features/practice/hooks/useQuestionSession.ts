import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError } from "@/lib/api/client";
import {
  answerPracticeQuestion,
  fetchPracticeSession,
  type PracticeAnswer,
  type PracticeOutcome,
  type PracticeSession,
} from "@/features/practice/api/practice";

type PendingAnswer = {
  position: number;
  wordId: number;
  selectedIndex: number | null;
  writtenAnswer: string | null;
};

export type QuestionSessionPhase =
  | "loading"
  | "answering"
  | "submitting"
  | "saveError"
  | "answered"
  | "completed";

export type QuestionSessionState = {
  phase: QuestionSessionPhase;
  session: PracticeSession | null;
  pendingSession: PracticeSession | null;
  selectedIndex: number | null;
  correctIndex: number | null;
  writtenAnswer: string;
  submittedWrittenAnswer: string | null;
  isUnknown: boolean;
  answerOutcome: PracticeOutcome | null;
  error: string | null;
  answerError: string | null;
};

export type QuestionSessionAction =
  | { type: "loadStarted" }
  | { type: "loadSucceeded"; session: PracticeSession }
  | { type: "loadAborted" }
  | { type: "loadFailed" }
  | { type: "writtenAnswerChanged"; writtenAnswer: string }
  | {
      type: "answerStarted";
      correctIndex: number | null;
      outcome: PracticeOutcome;
      selectedIndex: number | null;
      isUnknown: boolean;
      writtenAnswer?: string;
      submittedWrittenAnswer?: string | null;
    }
  | { type: "answerSucceeded"; answer: PracticeAnswer }
  | { type: "answerFailed" }
  | { type: "advanced"; session: PracticeSession };

export function createQuestionSessionState(
  session: PracticeSession | null,
): QuestionSessionState {
  return {
    phase: getSessionPhase(session),
    session,
    pendingSession: null,
    selectedIndex: null,
    correctIndex: null,
    writtenAnswer: "",
    submittedWrittenAnswer: null,
    isUnknown: false,
    answerOutcome: null,
    error: null,
    answerError: null,
  };
}

export function questionSessionReducer(
  state: QuestionSessionState,
  action: QuestionSessionAction,
): QuestionSessionState {
  switch (action.type) {
    case "loadStarted":
      return { ...state, phase: "loading", error: null, answerError: null };
    case "loadSucceeded":
      return createQuestionSessionState(action.session);
    case "loadAborted":
      return { ...state, phase: "answering" };
    case "loadFailed":
      return {
        ...state,
        phase: "answering",
        error: "Çalışma oturumu yüklenemedi.",
      };
    case "writtenAnswerChanged":
      return { ...state, writtenAnswer: action.writtenAnswer };
    case "answerStarted":
      return {
        ...state,
        phase: "submitting",
        selectedIndex: action.selectedIndex,
        correctIndex: action.correctIndex,
        writtenAnswer: action.writtenAnswer ?? state.writtenAnswer,
        submittedWrittenAnswer:
          action.submittedWrittenAnswer ?? state.submittedWrittenAnswer,
        isUnknown: action.isUnknown,
        answerOutcome: action.outcome,
        answerError: null,
      };
    case "answerSucceeded":
      return {
        ...state,
        phase: "answered",
        pendingSession: action.answer.session,
        correctIndex: action.answer.correctIndex,
        writtenAnswer: action.answer.writtenAnswer ?? state.writtenAnswer,
        submittedWrittenAnswer:
          action.answer.writtenAnswer ?? state.submittedWrittenAnswer,
        answerOutcome: action.answer.outcome,
        session: state.session
          ? {
              ...state.session,
              progress: action.answer.session.progress,
              results: action.answer.session.results,
            }
          : null,
      };
    case "answerFailed":
      return {
        ...state,
        phase: "saveError",
        answerError: "Cevap kaydedilemedi.",
      };
    case "advanced":
      return createQuestionSessionState(action.session);
  }
}

export function useQuestionSession(
  sessionId: string,
  initialSession: PracticeSession | null = null,
) {
  const preparedInitialSession =
    initialSession?.sessionId === sessionId ? initialSession : null;
  const initialSessionRef = useRef(preparedInitialSession);
  const [state, dispatch] = useReducer(
    questionSessionReducer,
    preparedInitialSession,
    createQuestionSessionState,
  );
  const requestId = useRef(0);
  const answerRequestId = useRef(0);
  const answeredPosition = useRef<number | null>(null);
  const isSubmittingAnswerRef = useRef(false);
  const pendingAnswer = useRef<PendingAnswer | null>(null);
  const sessionAbortControllerRef = useRef<AbortController | null>(null);

  const loadSession = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    answerRequestId.current += 1;
    isSubmittingAnswerRef.current = false;
    pendingAnswer.current = null;
    dispatch({ type: "loadStarted" });

    sessionAbortControllerRef.current?.abort();
    const controller = new AbortController();
    sessionAbortControllerRef.current = controller;

    try {
      const session = await fetchPracticeSession(sessionId, controller.signal);
      if (currentRequestId !== requestId.current) return;

      answeredPosition.current = null;
      dispatch({ type: "loadSucceeded", session });
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === "AbortError"
      ) {
        if (currentRequestId === requestId.current) {
          dispatch({ type: "loadAborted" });
        }
        return;
      }

      if (currentRequestId === requestId.current) {
        dispatch({ type: "loadFailed" });
      }
    }
  }, [sessionId]);

  useEffect(() => {
    const preparedSession = initialSessionRef.current;

    if (preparedSession?.sessionId === sessionId) {
      answeredPosition.current = null;
      dispatch({ type: "loadSucceeded", session: preparedSession });
    } else {
      void loadSession();
    }

    return () => {
      requestId.current += 1;
      answerRequestId.current += 1;
      sessionAbortControllerRef.current?.abort();
    };
  }, [loadSession, sessionId]);

  const submitAnswer = useCallback(
    async (submission: PendingAnswer) => {
      if (isSubmittingAnswerRef.current) return;

      const currentAnswerRequestId = ++answerRequestId.current;
      isSubmittingAnswerRef.current = true;

      try {
        const answer = await answerPracticeQuestion(
          sessionId,
          submission.position,
          submission.wordId,
          submission.selectedIndex,
          submission.writtenAnswer,
        );
        if (currentAnswerRequestId !== answerRequestId.current) return;

        pendingAnswer.current = null;
        dispatch({ type: "answerSucceeded", answer });
      } catch (requestError) {
        if (currentAnswerRequestId !== answerRequestId.current) return;

        if (requestError instanceof ApiError && requestError.status === 409) {
          await loadSession();
          return;
        }

        dispatch({ type: "answerFailed" });
      } finally {
        if (currentAnswerRequestId === answerRequestId.current) {
          isSubmittingAnswerRef.current = false;
        }
      }
    },
    [loadSession, sessionId],
  );

  const question = state.session?.question ?? null;
  const hasAnswered =
    state.selectedIndex !== null ||
    state.submittedWrittenAnswer !== null ||
    state.isUnknown;

  const answerChoice = useCallback(
    (index: number | null) => {
      if (
        !question ||
        question.format !== "MultipleChoice" ||
        hasAnswered ||
        answeredPosition.current === question.position
      ) {
        return;
      }

      if (index !== null && (index < 0 || index >= question.options.length)) {
        return;
      }

      const outcome: PracticeOutcome =
        index === null
          ? "Review"
          : question.correctIndex !== null && index === question.correctIndex
            ? "Correct"
            : "Wrong";
      const submission = {
        position: question.position,
        wordId: question.wordId,
        selectedIndex: index,
        writtenAnswer: null,
      };

      answeredPosition.current = question.position;
      pendingAnswer.current = submission;
      dispatch({
        type: "answerStarted",
        selectedIndex: index,
        correctIndex: question.correctIndex,
        isUnknown: index === null,
        outcome,
      });
      void submitAnswer(submission);

      return outcome;
    },
    [hasAnswered, question, submitAnswer],
  );

  const answerWritten = useCallback(
    (answer: string) => {
      if (
        !question ||
        question.format !== "Written" ||
        hasAnswered ||
        answeredPosition.current === question.position
      ) {
        return;
      }

      const normalizedAnswer = normalizeAnswer(answer);
      if (normalizedAnswer.length === 0) return;

      const outcome: PracticeOutcome = question.acceptedAnswers.some(
        (acceptedAnswer) =>
          compareWrittenAnswers(
            question.direction,
            acceptedAnswer,
            normalizedAnswer,
          ),
      )
        ? "Correct"
        : "Wrong";
      const submission = {
        position: question.position,
        wordId: question.wordId,
        selectedIndex: null,
        writtenAnswer: answer,
      };

      answeredPosition.current = question.position;
      pendingAnswer.current = submission;
      dispatch({
        type: "answerStarted",
        selectedIndex: null,
        correctIndex: null,
        isUnknown: false,
        outcome,
        writtenAnswer: answer,
        submittedWrittenAnswer: answer,
      });
      void submitAnswer(submission);

      return outcome;
    },
    [hasAnswered, question, submitAnswer],
  );

  const revealAnswer = useCallback(() => {
    if (
      !question ||
      hasAnswered ||
      answeredPosition.current === question.position
    ) {
      return;
    }

    const submission = {
      position: question.position,
      wordId: question.wordId,
      selectedIndex: null,
      writtenAnswer: null,
    };

    answeredPosition.current = question.position;
    pendingAnswer.current = submission;
    dispatch({
      type: "answerStarted",
      selectedIndex: null,
      correctIndex: question.correctIndex,
      isUnknown: true,
      outcome: "Review",
      writtenAnswer:
        question.format === "Written"
          ? (question.acceptedAnswers[0] ?? "")
          : undefined,
    });
    void submitAnswer(submission);
    return "Review" as const;
  }, [hasAnswered, question, submitAnswer]);

  const retryAnswer = useCallback(() => {
    if (pendingAnswer.current && !isSubmittingAnswerRef.current) {
      dispatch({
        type: "answerStarted",
        selectedIndex: state.selectedIndex,
        correctIndex: state.correctIndex,
        isUnknown: state.isUnknown,
        outcome: state.answerOutcome ?? "Review",
        writtenAnswer: state.writtenAnswer,
        submittedWrittenAnswer: state.submittedWrittenAnswer,
      });
      void submitAnswer(pendingAnswer.current);
    }
  }, [state, submitAnswer]);

  const loadNext = useCallback(() => {
    if (state.pendingSession) {
      answeredPosition.current = null;
      dispatch({ type: "advanced", session: state.pendingSession });
      return;
    }

    return loadSession();
  }, [loadSession, state.pendingSession]);

  const isSubmittingAnswer = state.phase === "submitting";

  return {
    session: state.session,
    question,
    selectedIndex: state.selectedIndex,
    correctIndex: state.correctIndex,
    writtenAnswer: state.writtenAnswer,
    submittedWrittenAnswer: state.submittedWrittenAnswer,
    correctCount: state.session?.progress.correctCount ?? 0,
    wrongCount: state.session?.progress.wrongCount ?? 0,
    unknownCount: state.session?.progress.reviewCount ?? 0,
    correctWords: state.session?.results.correct ?? [],
    wrongAnswers: state.session?.results.wrong ?? [],
    unknownWords: state.session?.results.review ?? [],
    totalCount: state.session?.progress.totalCount ?? 0,
    isComplete: state.phase === "completed",
    isLoading: state.phase === "loading",
    isSubmittingAnswer,
    error: state.error,
    answerError: state.answerError,
    answerOutcome: state.answerOutcome,
    hasAnswered,
    canAdvance: state.phase === "answered",
    loadNext,
    setWrittenAnswer: (writtenAnswer: string) =>
      dispatch({ type: "writtenAnswerChanged", writtenAnswer }),
    handleAnswer: (index: number) => answerChoice(index),
    handleWrittenAnswer: answerWritten,
    handleUnknown: revealAnswer,
    retryAnswer,
    retry: loadSession,
  };
}

function getSessionPhase(
  session: PracticeSession | null,
): QuestionSessionPhase {
  if (!session) return "loading";
  return session.status === "Completed" ? "completed" : "answering";
}

function normalizeAnswer(value: string) {
  return value.trim().replace(/\s+/gu, " ").normalize("NFC");
}

function compareWrittenAnswers(
  direction: "EnglishToTurkish" | "TurkishToEnglish",
  acceptedAnswer: string,
  normalizedAnswer: string,
) {
  const locale = direction === "EnglishToTurkish" ? "tr-TR" : "en-US";

  return (
    normalizeAnswer(acceptedAnswer).toLocaleLowerCase(locale) ===
    normalizedAnswer.toLocaleLowerCase(locale)
  );
}
