/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudySessionPage from "@/features/study/StudySessionPage";
import {
  abandonStudySession,
  answerStudyQuestion,
  continueAfterStudySession,
  deferStudySkill,
  fetchStudySession,
  type StudyAnswer,
  type StudySession,
} from "@/features/study/api/study";
import { reloadAt } from "@/lib/pageNavigation";
import {
  playCorrectSound,
  playShowAnswerSound,
  playWrongSound,
} from "@/features/question-session/feedbackSounds";
import { createTestQueryClient } from "@/test/createTestQueryClient";

vi.mock("@/features/study/api/study", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/features/study/api/study")>();
  return {
    ...original,
    abandonStudySession: vi.fn(),
    answerStudyQuestion: vi.fn(),
    continueAfterStudySession: vi.fn(),
    deferStudySkill: vi.fn(),
    fetchStudySession: vi.fn(),
  };
});

vi.mock("@/lib/pageNavigation", () => ({
  reloadAt: vi.fn(),
}));

vi.mock("@/features/question-session/feedbackSounds", () => ({
  playCorrectSound: vi.fn(),
  playShowAnswerSound: vi.fn(),
  playWrongSound: vi.fn(),
}));

const sessionId = "00000000-0000-0000-0000-000000000001";
const localStorageMock = createLocalStorage();

const topic = {
  id: 7,
  level: "A1",
  topic: "Animals",
  introducedWordCount: 0,
  recognitionWordCount: 0,
  wordCount: 20,
  isCompleted: false,
};

const activeSession: StudySession = {
  sessionId,
  status: "Active",
  mode: "Topic",
  topic,
  progress: {
    answeredCount: 0,
    totalCount: 1,
    correctCount: 0,
    reviewCount: 0,
    wrongCount: 0,
  },
  question: {
    position: 0,
    wordId: 1,
    dimension: "WrittenRecognition",
    kind: "MultipleChoice",
    prompt: "cat",
    options: ["köpek", "kedi", "kitap", "radyo"],
    isIntroduction: true,
  },
  summary: {
    introducedWordCount: 0,
    strengthenedWordCount: 0,
    nextReviewAtUtc: null,
    topicCompleted: false,
    reviewQuestionCount: 0,
    canContinue: true,
    results: [],
  },
};

const completedSession: StudySession = {
  ...activeSession,
  status: "Completed",
  progress: {
    answeredCount: 1,
    totalCount: 1,
    correctCount: 0,
    reviewCount: 0,
    wrongCount: 1,
  },
  question: null,
  summary: {
    introducedWordCount: 1,
    strengthenedWordCount: 0,
    nextReviewAtUtc: "2026-08-14T12:10:00+00:00",
    topicCompleted: false,
    reviewQuestionCount: 0,
    canContinue: true,
    results: [
      {
        wordId: 1,
        dimension: "WrittenRecognition",
        prompt: "cat",
        correctAnswer: "kedi",
        selectedAnswer: "köpek",
        outcome: "Wrong",
        isIntroduction: true,
      },
    ],
  },
};

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
  localStorageMock.clear();
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("StudySessionPage", () => {
  it("uses server-authoritative feedback and renders the completion summary", async () => {
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer("Wrong", completedSession, {
        correctIndex: 1,
        selectedIndex: 0,
      }),
    );
    const user = userEvent.setup();
    renderSession(activeSession);

    await user.click(screen.getByRole("button", { name: "köpek" }));

    expect(answerStudyQuestion).toHaveBeenCalledWith(sessionId, 0, 1, 0, null);
    expect(
      await screen.findByText(/Yanlış cevap\. Doğru cevap gösteriliyor\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "kedi" })).toHaveClass(
      "border-success",
    );
    expect(playWrongSound).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Sonuçları gör" }));

    expect(
      screen.getByRole("heading", { name: "Oturum tamamlandı" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("1 soru")).not.toBeInTheDocument();
    expect(
      screen.getByText("0 doğru · 1 yanlış · 0 cevap gösterildi"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Çalışma sonuçları" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "1 cevabı gözden geçir" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Gözden geçir" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tabpanel", { name: "Yanlış sonuçları" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kapat" }));
    expect(
      screen.getByRole("dialog", { name: "Gözden geçir" }),
    ).toHaveAttribute("data-closed");
  });

  it("keeps topic questions focused on the question and marks reinforcement with an explanation", async () => {
    const user = userEvent.setup();
    renderSession(activeSession);

    expect(screen.getByRole("heading", { name: "cat" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ana sayfa" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/A1 · Hayvanlar/)).not.toBeInTheDocument();

    cleanup();
    renderSession({
      ...activeSession,
      mode: "Review",
      topic: null,
      question: { ...activeSession.question!, isIntroduction: false },
    });

    const reinforcementTrigger = screen.getByRole("button", {
      name: "Pekiştirme sorusu",
    });
    expect(reinforcementTrigger).toBeInTheDocument();
    await user.click(reinforcementTrigger);
    expect(reinforcementTrigger).toHaveAttribute("aria-expanded", "true");
    expect(
      await screen.findByText(
        "Daha önce çalıştığın bir kelimeyi pekiştiriyorsun.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("heading", { name: "cat" }));
    expect(
      screen.queryByText("Daha önce çalıştığın bir kelimeyi pekiştiriyorsun."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Yeni kelime")).not.toBeInTheDocument();
  });

  it("defers a skill from the question content without answering", async () => {
    const writtenSession = makeWrittenSession();
    vi.mocked(deferStudySkill).mockResolvedValue({
      ...activeSession,
    });
    const user = userEvent.setup();
    renderSession(writtenSession);

    await user.type(
      screen.getByRole("textbox", { name: "İngilizce cevap" }),
      "dog",
    );
    await user.click(screen.getByRole("button", { name: "Şimdi yazamam" }));

    expect(
      screen.getByText("Yazma soruları 10 dakika ertelensin mi?"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "İngilizce cevap" }),
    ).not.toBeInTheDocument();
    expect(deferStudySkill).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(
      screen.getByRole("button", { name: "Şimdi yazamam" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "İngilizce cevap" }),
    ).toHaveValue("dog");
    expect(deferStudySkill).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Şimdi yazamam" }));
    await user.click(screen.getByRole("button", { name: "Ertele" }));

    expect(deferStudySkill).toHaveBeenCalledWith(sessionId, "WrittenRecall");
    expect(answerStudyQuestion).not.toHaveBeenCalled();
    // The replanned question replaces the written one and the control is gone.
    expect(
      await screen.findByRole("button", { name: "köpek" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Şimdi yazamam" }),
    ).not.toBeInTheDocument();
  });

  it("retries a failed deferral without retrying an answer", async () => {
    vi.mocked(deferStudySkill)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(activeSession);
    const user = userEvent.setup();
    renderSession(makeWrittenSession());

    await user.click(screen.getByRole("button", { name: "Şimdi yazamam" }));
    await user.click(screen.getByRole("button", { name: "Ertele" }));

    expect(
      await screen.findByText(
        "Yazma soruları ertelenemedi. Lütfen tekrar dene.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tekrar dene" }),
    ).toBeInTheDocument();
    expect(answerStudyQuestion).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));

    expect(deferStudySkill).toHaveBeenCalledTimes(2);
    expect(answerStudyQuestion).not.toHaveBeenCalled();
  });

  it("offers no deferral for multiple-choice questions", () => {
    renderSession(activeSession);

    expect(
      screen.queryByRole("button", { name: /Şimdi/ }),
    ).not.toBeInTheDocument();
  });

  it("shows a completion summary and continues with reinforcement when questions are due", async () => {
    vi.mocked(continueAfterStudySession).mockResolvedValue({
      ...activeSession,
      sessionId: "00000000-0000-0000-0000-000000000002",
      mode: "Review",
      topic: null,
    });
    const user = userEvent.setup();
    renderSession({
      ...completedSession,
      summary: {
        ...completedSession.summary,
        topicCompleted: true,
        reviewQuestionCount: 3,
        canContinue: true,
      },
    });

    expect(
      screen.getByRole("heading", { name: "Oturum tamamlandı" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("1 soru")).not.toBeInTheDocument();
    expect(
      screen.getByText("0 doğru · 1 yanlış · 0 cevap gösterildi"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ana sayfa" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Devam et" }));
    expect(continueAfterStudySession).toHaveBeenCalledWith(sessionId);
  });

  it("releases the completed session before returning home", async () => {
    vi.mocked(abandonStudySession).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSession(completedSession);

    await user.click(screen.getByRole("button", { name: "Ana sayfa" }));

    expect(abandonStudySession).toHaveBeenCalledWith(sessionId);
    expect(reloadAt).toHaveBeenCalledWith("/");
  });

  it("does not offer continuation when the curriculum has no remaining work", () => {
    renderSession({
      ...completedSession,
      summary: {
        ...completedSession.summary,
        topicCompleted: false,
        reviewQuestionCount: 0,
        canContinue: false,
      },
    });

    expect(
      screen.queryByRole("button", { name: "Devam et" }),
    ).not.toBeInTheDocument();
  });

  it("advances a correct answer automatically after about 800 ms", async () => {
    const nextSession = makeNextQuestionSession("Correct");
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer("Correct", nextSession, { correctIndex: 1, selectedIndex: 1 }),
    );
    const user = userEvent.setup();
    renderSession({
      ...activeSession,
      progress: { ...activeSession.progress, totalCount: 2 },
    });

    await user.click(screen.getByRole("button", { name: "kedi" }));

    expect(
      await screen.findByText(/Sonraki soru otomatik olarak yüklenecek\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Sonraki soru…")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Devam et" }),
    ).not.toBeInTheDocument();
    expect(playCorrectSound).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("heading", { name: "dog" }, { timeout: 1_500 }),
    ).toBeInTheDocument();
  });

  it("supports number shortcuts and manual continuation after a wrong answer", async () => {
    const nextSession = makeNextQuestionSession("Wrong");
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer("Wrong", nextSession, { correctIndex: 1, selectedIndex: 0 }),
    );
    const user = userEvent.setup();
    renderSession({
      ...activeSession,
      progress: { ...activeSession.progress, totalCount: 2 },
    });

    await user.keyboard("1");

    expect(answerStudyQuestion).toHaveBeenCalledWith(sessionId, 0, 1, 0, null);
    expect(
      await screen.findByRole("button", { name: "Devam et" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "cat" })).toBeInTheDocument();

    screen.getByRole("heading", { name: "cat" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "dog" })).toBeInTheDocument();
  });

  it("shows an answer as Review and plays the shared reveal sound", async () => {
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer("Review", completedSession, {
        correctIndex: 1,
        selectedIndex: null,
      }),
    );
    const user = userEvent.setup();
    renderSession(activeSession);

    await user.click(screen.getByRole("button", { name: "Cevabı göster" }));

    expect(answerStudyQuestion).toHaveBeenCalledWith(
      sessionId,
      0,
      1,
      null,
      null,
    );
    expect(playShowAnswerSound).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Cevap gösterildi\./)).toBeInTheDocument();
    const revealedOption = screen.getByRole("button", { name: "kedi" });
    expect(revealedOption).toHaveClass("bg-warning-subtle");
    expect(revealedOption).not.toHaveClass("bg-success-subtle");
  });

  it("submits written answers while keeping correctness server-authoritative", async () => {
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer(
        "Correct",
        {
          ...completedSession,
          progress: {
            ...completedSession.progress,
            correctCount: 1,
            wrongCount: 0,
          },
        },
        { correctIndex: null, selectedIndex: null },
      ),
    );
    const user = userEvent.setup();
    renderSession(makeWrittenSession());

    const answerField = screen.getByRole("textbox", {
      name: "İngilizce cevap",
    });
    expect(answerField).toHaveAttribute(
      "placeholder",
      "İngilizce karşılığını yazın",
    );
    await user.type(answerField, "cat");
    await user.keyboard("{Enter}");

    expect(answerStudyQuestion).toHaveBeenCalledWith(
      sessionId,
      0,
      1,
      null,
      "cat",
    );
    expect(await screen.findByText(/Doğru cevap\./)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sonuçları gör" }),
    ).toBeInTheDocument();
  });

  it("shows the correct written answer after the learner reveals it", async () => {
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer("Review", completedSession, {
        correctIndex: null,
        selectedIndex: null,
      }),
    );
    const user = userEvent.setup();
    renderSession(makeWrittenSession());

    await user.click(screen.getByRole("button", { name: "Cevabı göster" }));

    expect(
      await screen.findByRole("textbox", { name: "İngilizce cevap" }),
    ).toHaveValue("kedi");
  });

  it("shows the wrong and correct written answers in one read-only field", async () => {
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer("Wrong", completedSession, {
        correctIndex: null,
        selectedIndex: null,
      }),
    );
    const user = userEvent.setup();
    renderSession(makeWrittenSession());

    const answerField = screen.getByRole("textbox", {
      name: "İngilizce cevap",
    });
    await user.type(answerField, "dog");
    await user.click(screen.getByRole("button", { name: "Cevabı kontrol et" }));

    await screen.findByRole("button", { name: "Sonuçları gör" });
    expect(answerField).toHaveValue("dog → kedi");
    expect(answerField).toHaveAttribute("readonly");
  });

  it("retries the same answer when persistence fails", async () => {
    vi.mocked(answerStudyQuestion)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(
        makeAnswer("Wrong", completedSession, {
          correctIndex: 1,
          selectedIndex: 0,
        }),
      );
    const user = userEvent.setup();
    renderSession(activeSession);

    await user.click(screen.getByRole("button", { name: "köpek" }));
    await user.click(
      await screen.findByRole("button", { name: "Kaydetmeyi tekrar dene" }),
    );

    await screen.findByRole("button", { name: "Sonuçları gör" });
    expect(answerStudyQuestion).toHaveBeenCalledTimes(2);
    expect(answerStudyQuestion).toHaveBeenLastCalledWith(
      sessionId,
      0,
      1,
      0,
      null,
    );
  });

  it("opens and closes interim results from footer counters", async () => {
    const user = userEvent.setup();
    renderSession(makeNextQuestionSession("Wrong"));

    await user.click(
      screen.getByRole("button", { name: "Yanlış cevaplar: 1" }),
    );

    expect(
      screen.getByRole("region", { name: "Çalışma sonuçları" }),
    ).toBeInTheDocument();
    expect(screen.getByText("cat")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Yanlış cevaplar: 1. Sonuç listesini kapat",
      }),
    );
    expect(screen.getByRole("button", { name: "köpek" })).toBeInTheDocument();
  });

  it("loads a directly opened session and supports retry after an error", async () => {
    vi.mocked(fetchStudySession)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(activeSession);
    const user = userEvent.setup();
    renderSession(null);

    expect(screen.getByLabelText("Soru yükleniyor")).toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", { name: "Tekrar dene" }),
    );
    expect(
      await screen.findByRole("heading", { name: "cat" }),
    ).toBeInTheDocument();
    expect(fetchStudySession).toHaveBeenCalledTimes(2);
  });
});

function makeWrittenSession(): StudySession {
  return {
    ...activeSession,
    question: {
      ...activeSession.question!,
      dimension: "WrittenRecall",
      kind: "Written",
      prompt: "kedi",
      options: [],
    },
  };
}

function makeNextQuestionSession(outcome: "Correct" | "Wrong"): StudySession {
  return {
    ...activeSession,
    progress: {
      answeredCount: 1,
      totalCount: 2,
      correctCount: outcome === "Correct" ? 1 : 0,
      reviewCount: 0,
      wrongCount: outcome === "Wrong" ? 1 : 0,
    },
    question: {
      position: 1,
      wordId: 2,
      dimension: "WrittenRecognition",
      kind: "MultipleChoice",
      prompt: "dog",
      options: ["kedi", "köpek", "kitap", "radyo"],
      isIntroduction: true,
    },
    summary: {
      introducedWordCount: 1,
      strengthenedWordCount: 0,
      nextReviewAtUtc: "2026-08-14T12:10:00+00:00",
      topicCompleted: false,
      reviewQuestionCount: 0,
      canContinue: true,
      results: [
        {
          wordId: 1,
          dimension: "WrittenRecognition",
          prompt: "cat",
          correctAnswer: "kedi",
          selectedAnswer: outcome === "Correct" ? "kedi" : "köpek",
          outcome,
          isIntroduction: true,
        },
      ],
    },
  };
}

function makeAnswer(
  outcome: StudyAnswer["outcome"],
  session: StudySession,
  indices: Pick<StudyAnswer, "correctIndex" | "selectedIndex">,
): StudyAnswer {
  return {
    outcome,
    ...indices,
    writtenAnswer: null,
    correctAnswer: "kedi",
    isComplete: session.status === "Completed",
    session,
  };
}

function renderSession(initialSession: StudySession | null) {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: `/session/${sessionId}`,
            state: initialSession ? { session: initialSession } : null,
          },
        ]}
      >
        <Routes>
          <Route path="/session/:sessionId" element={<StudySessionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function createLocalStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}
