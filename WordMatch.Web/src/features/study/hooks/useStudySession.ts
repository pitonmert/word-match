import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError } from "@/lib/api/client";
import {
  answerStudyQuestion,
  deferStudySkill,
  fetchStudySession,
  type MasteryDimension,
  type StudyAnswer,
  type StudySession,
} from "@/features/study/api/study";

type Submission = {
  position: number;
  wordId: number;
  selectedIndex: number | null;
  writtenAnswer: string | null;
};

type State = {
  phase:
    | "loading"
    | "answering"
    | "submitting"
    | "answered"
    | "confirmingDeferral"
    | "deferring"
    | "completed";
  session: StudySession | null;
  pendingSession: StudySession | null;
  answer: StudyAnswer | null;
  writtenAnswer: string;
  error: string | null;
  answerError: string | null;
  deferral: { dimension: MasteryDimension; error: string | null } | null;
};

type Action =
  | { type: "loading" }
  | { type: "loaded"; session: StudySession }
  | { type: "loadFailed" }
  | { type: "writtenChanged"; value: string }
  | { type: "submitting" }
  | { type: "answered"; answer: StudyAnswer }
  | { type: "answerFailed" }
  | { type: "deferralRequested"; dimension: MasteryDimension }
  | { type: "deferralCancelled" }
  | { type: "deferring" }
  | { type: "deferralFailed" }
  | { type: "advanced" };

function createState(session: StudySession | null): State {
  return {
    phase:
      session?.status === "Completed"
        ? "completed"
        : session
          ? "answering"
          : "loading",
    session,
    pendingSession: null,
    answer: null,
    writtenAnswer: "",
    error: null,
    answerError: null,
    deferral: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loading":
      return { ...state, phase: "loading", error: null };
    case "loaded":
      return createState(action.session);
    case "loadFailed":
      return {
        ...state,
        phase: "answering",
        error: "Study oturumu yüklenemedi.",
      };
    case "writtenChanged":
      return { ...state, writtenAnswer: action.value };
    case "submitting":
      return { ...state, phase: "submitting", answerError: null };
    case "answered":
      return {
        ...state,
        phase: "answered",
        answer: action.answer,
        pendingSession: action.answer.session,
      };
    case "answerFailed":
      return {
        ...state,
        phase: "answering",
        answerError: "Cevap kaydedilemedi. Lütfen tekrar dene.",
      };
    case "deferralRequested":
      return {
        ...state,
        phase: "confirmingDeferral",
        deferral: { dimension: action.dimension, error: null },
      };
    case "deferralCancelled":
      return { ...state, phase: "answering", deferral: null };
    case "deferring":
      return {
        ...state,
        phase: "deferring",
        deferral: state.deferral && { ...state.deferral, error: null },
      };
    case "deferralFailed":
      return {
        ...state,
        phase: "confirmingDeferral",
        deferral: state.deferral && {
          ...state.deferral,
          error: "Yazma soruları ertelenemedi. Lütfen tekrar dene.",
        },
      };
    case "advanced": {
      const next = state.pendingSession;
      return createState(next);
    }
  }
}

export function useStudySession(
  sessionId: string,
  initialSession: StudySession | null,
) {
  const [state, dispatch] = useReducer(reducer, initialSession, createState);
  const submissionRef = useRef<Submission | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentId = ++requestId.current;
    dispatch({ type: "loading" });
    try {
      const session = await fetchStudySession(sessionId);
      if (currentId === requestId.current)
        dispatch({ type: "loaded", session });
    } catch {
      if (currentId === requestId.current) dispatch({ type: "loadFailed" });
    }
  }, [sessionId]);

  useEffect(() => {
    if (!initialSession || initialSession.sessionId !== sessionId) void load();
    return () => {
      requestId.current += 1;
    };
  }, [initialSession, load, sessionId]);

  const send = useCallback(
    async (submission: Submission) => {
      dispatch({ type: "submitting" });
      try {
        const answer = await answerStudyQuestion(
          sessionId,
          submission.position,
          submission.wordId,
          submission.selectedIndex,
          submission.writtenAnswer,
        );
        submissionRef.current = null;
        dispatch({ type: "answered", answer });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          submissionRef.current = null;
          await load();
          return;
        }
        dispatch({ type: "answerFailed" });
      }
    },
    [load, sessionId],
  );

  const confirmDeferral = useCallback(async (): Promise<boolean> => {
    const dimension = state.deferral?.dimension;
    if (!dimension || state.phase === "deferring") return false;

    const currentId = ++requestId.current;
    dispatch({ type: "deferring" });
    try {
      const session = await deferStudySkill(sessionId, dimension);
      if (currentId === requestId.current) {
        dispatch({ type: "loaded", session });
        return true;
      }
    } catch {
      if (currentId === requestId.current) dispatch({ type: "deferralFailed" });
    }
    return false;
  }, [sessionId, state.deferral?.dimension, state.phase]);

  const answer = useCallback(
    (selectedIndex: number | null, writtenAnswer: string | null) => {
      const question = state.session?.question;
      if (!question || state.phase !== "answering") return;
      const submission = {
        position: question.position,
        wordId: question.wordId,
        selectedIndex,
        writtenAnswer,
      };
      submissionRef.current = submission;
      void send(submission);
    },
    [send, state.phase, state.session?.question],
  );

  return {
    ...state,
    setWrittenAnswer: (value: string) =>
      dispatch({ type: "writtenChanged", value }),
    answerChoice: (index: number | null) => answer(index, null),
    answerWritten: () => {
      if (state.writtenAnswer.trim()) answer(null, state.writtenAnswer);
    },
    showAnswer: () => answer(null, null),
    retryAnswer: () => {
      if (submissionRef.current) void send(submissionRef.current);
    },
    requestDeferral: (dimension: MasteryDimension) =>
      dispatch({ type: "deferralRequested", dimension }),
    cancelDeferral: () => dispatch({ type: "deferralCancelled" }),
    confirmDeferral,
    advance: () => dispatch({ type: "advanced" }),
    retryLoad: load,
  };
}
