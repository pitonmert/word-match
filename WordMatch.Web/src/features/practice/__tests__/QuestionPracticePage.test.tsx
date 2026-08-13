/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCategories,
  resetCategoryProgress,
  type CategoryResponse,
  type CategoryOption,
} from "@/features/practice/api/categories";
import {
  answerPracticeQuestion,
  fetchPracticeResults,
  fetchPracticeSession,
  startPractice,
  type PracticeAnswer,
  type PracticeMode,
  type PracticeOutcome,
  type PracticeQuestion,
  type PracticeResultView,
  type PracticeSession,
  type PracticeWordRecord,
} from "@/features/practice/api/practice";
import QuestionPracticePage from "@/features/practice/QuestionPracticePage";
import { feedbackSoundPreferenceStorageKey } from "@/features/practice/hooks/useFeedbackSoundPreference";
import { playShowAnswerSound } from "@/features/practice/questionSounds";
import { createTestQueryClient } from "@/test/createTestQueryClient";

vi.mock("@/features/practice/api/practice", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/features/practice/api/practice")>();

  return {
    ...original,
    answerPracticeQuestion: vi.fn(),
    fetchPracticeResults: vi.fn(),
    fetchPracticeSession: vi.fn(),
    startPractice: vi.fn(),
  };
});

vi.mock("@/features/practice/api/categories", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/features/practice/api/categories")>();

  return {
    ...original,
    fetchCategories: vi.fn(),
    resetCategoryProgress: vi.fn(),
  };
});

vi.mock("@/features/practice/questionSounds", () => ({
  playCorrectSound: vi.fn(),
  playShowAnswerSound: vi.fn(),
  playWrongSound: vi.fn(),
}));

const mockedAnswer = vi.mocked(answerPracticeQuestion);
const mockedFetchResults = vi.mocked(fetchPracticeResults);
const mockedFetchSession = vi.mocked(fetchPracticeSession);
const mockedStart = vi.mocked(startPractice);
const mockedFetchCategories = vi.mocked(fetchCategories);
const mockedResetCategoryProgress = vi.mocked(resetCategoryProgress);
const mockedPlayShowAnswerSound = vi.mocked(playShowAnswerSound);
const localStorageMock = createLocalStorage();
const modeSelectionCategory: CategoryOption = {
  value: "FoodAndDrink",
  label: "Food and Drink",
  wordCount: 3,
  completedQuestionCount: 0,
  totalQuestionCount: 12,
  status: "Available",
  modes: [
    {
      mode: "EnglishToTurkish",
      completedQuestionCount: 0,
      totalQuestionCount: 6,
    },
    {
      mode: "TurkishToEnglish",
      completedQuestionCount: 0,
      totalQuestionCount: 6,
    },
    { mode: "Mixed", completedQuestionCount: 0, totalQuestionCount: 12 },
  ],
};

function categoryResponse(
  category = modeSelectionCategory,
  level = "A1",
): CategoryResponse {
  return {
    levels: [
      {
        value: level,
        label: level,
        wordCount: category.wordCount,
        topics: [category],
      },
    ],
  };
}

type QuestionKey = "apple" | "book" | "water";

const questions: Record<QuestionKey, PracticeQuestion> = {
  apple: {
    position: 0,
    wordId: 1,
    direction: "EnglishToTurkish",
    format: "MultipleChoice",
    prompt: "apple",
    options: ["elma", "armut", "kiraz", "muz"],
    correctIndex: 0,
    acceptedAnswers: [],
  },
  book: {
    position: 1,
    wordId: 2,
    direction: "EnglishToTurkish",
    format: "MultipleChoice",
    prompt: "book",
    options: ["kalem", "kitap", "masa", "çanta"],
    correctIndex: 1,
    acceptedAnswers: [],
  },
  water: {
    position: 2,
    wordId: 3,
    direction: "EnglishToTurkish",
    format: "MultipleChoice",
    prompt: "water",
    options: ["süt", "çay", "su", "kahve"],
    correctIndex: 2,
    acceptedAnswers: [],
  },
};

const writtenAppleQuestion: PracticeQuestion = {
  ...questions.apple,
  format: "Written",
  options: [],
  correctIndex: null,
  acceptedAnswers: ["elma", "alma"],
};

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
  localStorageMock.clear();
  mockedFetchCategories.mockResolvedValue(categoryResponse());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("QuestionPracticePage", () => {
  it("uses category values returned by the API instead of a static topic list", async () => {
    const category: CategoryOption = {
      ...modeSelectionCategory,
      value: "NewTopic",
    };
    const session = {
      ...activeSession("apple"),
      level: "C1",
      topic: category.value,
    };
    mockedFetchCategories.mockResolvedValue(categoryResponse(category, "C1"));
    mockedStart.mockResolvedValue(session);
    const user = userEvent.setup();

    renderModeSelectionFromApi("C1", category.value);

    await user.click(
      await screen.findByRole("button", { name: "İngilizce → Türkçe" }),
    );

    expect(mockedStart).toHaveBeenCalledWith({
      level: "C1",
      topic: "NewTopic",
      mode: "EnglishToTurkish",
    });
  });

  it("loads results for a category returned by the API instead of a static topic list", async () => {
    const category: CategoryOption = {
      ...modeSelectionCategory,
      value: "NewTopic",
    };
    mockedFetchCategories.mockResolvedValue(categoryResponse(category, "C1"));
    mockedFetchResults.mockResolvedValue(completedResultView());

    renderPracticeResultsFromApi("C1", category.value, "EnglishToTurkish");

    await waitFor(() =>
      expect(mockedFetchResults).toHaveBeenCalledWith(
        {
          level: "C1",
          topic: "NewTopic",
          mode: "EnglishToTurkish",
        },
        expect.any(AbortSignal),
      ),
    );
  });

  it.each([
    ["Türkçe → İngilizce", "TurkishToEnglish"],
    ["İngilizce → Türkçe", "EnglishToTurkish"],
    ["Her iki yönde", "Mixed"],
  ] as const)(
    "starts %s mode and uses the returned first question without another request",
    async (buttonName, mode) => {
      const session = {
        ...activeSession("apple"),
        mode,
        question: {
          ...questions.apple,
          direction:
            mode === "TurkishToEnglish"
              ? ("TurkishToEnglish" as const)
              : ("EnglishToTurkish" as const),
          prompt: mode === "TurkishToEnglish" ? "elma" : "apple",
        },
      };
      mockedStart.mockResolvedValue(session);
      const user = userEvent.setup();

      renderModeSelection();

      const modeButton = screen.getByRole("button", { name: buttonName });
      expect(modeButton).not.toHaveTextContent("3 kelime");
      expect(screen.getByLabelText("3 kelime")).toBeInTheDocument();
      expect(modeButton).toHaveTextContent(
        mode === "Mixed" ? "Başla · 12 soru" : "Başla · 6 soru",
      );
      await user.click(modeButton);

      expect(mockedStart).toHaveBeenCalledWith({
        level: "A1",
        topic: "FoodAndDrink",
        mode,
      });
      expect(
        await screen.findByRole("heading", { name: session.question.prompt }),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(
          `Çalışma modu: ${
            mode === "TurkishToEnglish"
              ? "Türkçe → İngilizce"
              : mode === "EnglishToTurkish"
                ? "İngilizce → Türkçe"
                : "Her iki yönde"
          }`,
        ),
      ).toBeInTheDocument();
      expect(mockedFetchSession).not.toHaveBeenCalled();
      expect(screen.getByTestId("practice-location")).toHaveTextContent(
        "/practice/session-1",
      );
      await waitFor(() =>
        expect(screen.getByTestId("practice-location-state")).toHaveTextContent(
          "empty",
        ),
      );
    },
  );

  it("opens the result view for a completed mode without starting a new attempt", async () => {
    const completedCategory: CategoryOption = {
      ...modeSelectionCategory,
      modes: modeSelectionCategory.modes.map((status) =>
        status.mode === "EnglishToTurkish"
          ? {
              ...status,
              completedQuestionCount: status.totalQuestionCount,
            }
          : status,
      ),
    };
    mockedFetchResults.mockResolvedValue(completedResultView());
    mockedStart.mockResolvedValue(activeSession("apple"));
    const user = userEvent.setup();

    renderModeSelection(completedCategory);
    const resultButton = screen.getByRole("button", {
      name: "İngilizce → Türkçe",
    });

    expect(resultButton).toHaveTextContent("Sonuçları gör");
    await user.click(resultButton);

    expect(
      await screen.findByRole("heading", { name: "Sonuçlar" }),
    ).toBeInTheDocument();
    expect(mockedFetchResults).toHaveBeenCalledWith(
      {
        level: "A1",
        topic: "FoodAndDrink",
        mode: "EnglishToTurkish",
      },
      expect.any(AbortSignal),
    );
    expect(mockedStart).not.toHaveBeenCalled();
    expect(screen.getByTestId("practice-location")).toHaveTextContent(
      "/practice/results",
    );
    expect(screen.getByRole("link", { name: "Modlara dön" })).toHaveAttribute(
      "href",
      "/practice?level=A1&topic=FoodAndDrink",
    );

    await user.click(screen.getByRole("button", { name: "Tekrar çalış" }));

    expect(mockedStart).toHaveBeenCalledWith(
      {
        level: "A1",
        topic: "FoodAndDrink",
        mode: "EnglishToTurkish",
      },
      true,
    );
    expect(
      await screen.findByRole("heading", { name: "apple" }),
    ).toBeInTheDocument();
  });

  it("resumes an active replay before opening completed mode results", async () => {
    const replaySession = {
      ...activeSession("book", { answeredCount: 1 }),
      sessionId: "replay-session",
    };
    const completedCategory: CategoryOption = {
      ...modeSelectionCategory,
      status: "Completed",
      modes: modeSelectionCategory.modes.map((status) =>
        status.mode === "EnglishToTurkish"
          ? {
              ...status,
              completedQuestionCount: status.totalQuestionCount,
              activeSessionId: replaySession.sessionId,
              activeAnsweredCount: 1,
              activeTotalCount: 3,
              isReplay: true,
            }
          : status,
      ),
    };
    mockedFetchSession.mockResolvedValue(replaySession);
    const user = userEvent.setup();

    renderModeSelection(completedCategory);
    const resumeButton = screen.getByRole("button", {
      name: "İngilizce → Türkçe",
    });

    expect(resumeButton).toHaveTextContent("Tekrar · 1/3 soru");
    await user.click(resumeButton);

    expect(
      await screen.findByRole("heading", { name: "book" }),
    ).toBeInTheDocument();
    expect(mockedFetchSession).toHaveBeenCalledWith(
      "replay-session",
      expect.any(AbortSignal),
    );
    expect(mockedFetchResults).not.toHaveBeenCalled();
    expect(mockedStart).not.toHaveBeenCalled();
    expect(screen.getByTestId("practice-location")).toHaveTextContent(
      "/practice/replay-session",
    );
  });

  it.each([
    [false, 0, "Başla · 6 soru"],
    [false, 2, "Devam et · 2/6 soru"],
    [true, 0, "Tekrar · 0/6 soru"],
  ] as const)(
    "shows the correct active-session action for replay=%s and answered=%s",
    (isReplay, activeAnsweredCount, expectedStatus) => {
      const category: CategoryOption = {
        ...modeSelectionCategory,
        modes: modeSelectionCategory.modes.map((status) =>
          status.mode === "EnglishToTurkish"
            ? {
                ...status,
                completedQuestionCount: isReplay ? 6 : activeAnsweredCount,
                activeSessionId: "active-session",
                activeAnsweredCount,
                activeTotalCount: 6,
                isReplay,
              }
            : status,
        ),
      };

      renderModeSelection(category);

      expect(
        screen.getByRole("button", { name: "İngilizce → Türkçe" }),
      ).toHaveTextContent(expectedStatus);
    },
  );

  it("shows shared progress for a previously answered mode without an active session", () => {
    const category: CategoryOption = {
      ...modeSelectionCategory,
      status: "InProgress",
      modes: modeSelectionCategory.modes.map((status) =>
        status.mode === "EnglishToTurkish"
          ? { ...status, completedQuestionCount: 2 }
          : status,
      ),
    };

    renderModeSelection(category);

    expect(
      screen.getByRole("button", { name: "İngilizce → Türkçe" }),
    ).toHaveTextContent("Devam et · 2/6 soru");
    expect(
      screen.getByRole("button", { name: "Türkçe → İngilizce" }),
    ).toHaveTextContent("Başla · 6 soru");
  });

  it("resets category progress from the mode-selection footer", async () => {
    const category: CategoryOption = {
      ...modeSelectionCategory,
      completedQuestionCount: 2,
      status: "InProgress",
    };
    mockedResetCategoryProgress.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderModeSelection(category);
    await user.click(screen.getByRole("button", { name: "Sıfırla" }));

    expect(
      screen.getByRole("heading", {
        name: "Yiyecek ve İçecek ilerlemesi sıfırlansın mı?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/bütün modlarına ait devam eden ve tamamlanan/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sıfırla" }));

    await waitFor(() =>
      expect(mockedResetCategoryProgress).toHaveBeenCalledWith(
        "A1",
        "FoodAndDrink",
      ),
    );
  });

  it("keeps the mode selection visible when the session cannot be opened", async () => {
    mockedStart.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();

    renderModeSelection();
    await user.click(
      screen.getByRole("button", { name: "İngilizce → Türkçe" }),
    );

    expect(
      await screen.findByText("Çalışma oturumu açılamadı."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Çalışma modunu seçin" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("practice-location")).toHaveTextContent(
      "/practice",
    );
  });

  it("loads the persisted session and saves correct and wrong answers", async () => {
    mockedFetchSession
      .mockResolvedValueOnce(activeSession("apple"))
      .mockResolvedValueOnce(
        activeSession("book", {
          answeredCount: 1,
          correctCount: 1,
          correct: [record("apple", "elma", "elma")],
        }),
      );
    mockedAnswer
      .mockResolvedValueOnce(answerResult("Correct", 0, "elma", 1, 1, 0, 0))
      .mockResolvedValueOnce(answerResult("Wrong", 1, "kitap", 2, 1, 0, 1));
    const user = userEvent.setup();

    renderPracticePage();

    await screen.findByRole("heading", { name: "apple" });
    expect(mockedFetchSession).toHaveBeenCalledWith(
      "session-1",
      expect.any(AbortSignal),
    );
    expect(
      screen.getByText("A1 · Yiyecek ve İçecek · EN → TR"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Modlara dön" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Çalışma ilerlemesi" }),
    ).toHaveAttribute("aria-valuenow", "0");

    await user.click(screen.getByRole("button", { name: "elma" }));
    expect(
      await screen.findByLabelText("Doğru cevaplar: 1"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "elma" })).toHaveClass(
      "bg-success-subtle",
      "text-success",
    );
    expect(screen.getByRole("button", { name: "armut" })).toHaveClass(
      "bg-background-200",
      "text-text-700",
    );
    expect(screen.getByRole("button", { name: "armut" })).not.toHaveClass(
      "opacity-50",
    );
    expect(mockedAnswer).toHaveBeenCalledWith("session-1", 0, 1, 0, null);

    expect(screen.queryByRole("button", { name: "Devam et" })).toBeNull();
    await screen.findByRole("heading", { name: "book" }, { timeout: 1500 });
    expect(mockedFetchSession).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "kalem" }));
    expect(
      await screen.findByLabelText("Yanlış cevaplar: 1"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "kalem" })).toHaveClass(
      "bg-error-subtle",
      "text-error",
    );
    expect(screen.getByRole("button", { name: "kitap" })).toHaveClass(
      "bg-success-subtle",
      "text-success",
    );
    expect(screen.getByRole("button", { name: "masa" })).toHaveClass(
      "bg-background-200",
      "text-text-700",
    );
    expect(mockedAnswer).toHaveBeenLastCalledWith("session-1", 1, 2, 0, null);
    expect(screen.getByRole("button", { name: "Devam et" })).toHaveClass(
      "h-full",
      "min-w-40",
      "border-primary/35",
      "bg-card",
      "text-primary",
    );

    await user.click(
      screen.getByRole("button", { name: "Yanlış cevaplar: 1" }),
    );
    expect(
      screen.getByRole("region", { name: "Çalışma sonuçları" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Yanlış 1/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /Yanlış 1/ })).toHaveClass(
      "after:bg-error",
    );
    expect(screen.getByRole("heading", { name: "book" })).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Yanlış cevaplar: 1. Sonuç listesini kapat",
      }),
    );
    expect(
      screen.queryByRole("region", { name: "Çalışma sonuçları" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "book" })).toBeInTheDocument();
  });

  it("persists the feedback sound preference and suppresses feedback sounds when disabled", async () => {
    window.localStorage.setItem(feedbackSoundPreferenceStorageKey, "false");
    mockedFetchSession.mockResolvedValue(activeSession("apple"));
    mockedAnswer.mockResolvedValue(
      answerResult("Review", 0, "elma", 1, 0, 1, 0),
    );
    const user = userEvent.setup();

    renderPracticePage();

    await screen.findByRole("heading", { name: "apple" });
    const soundToggle = screen.getByRole("button", { name: "Sesi aç" });
    expect(soundToggle).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Cevabı göster" }));
    expect(mockedPlayShowAnswerSound).not.toHaveBeenCalled();

    await user.click(soundToggle);
    expect(screen.getByRole("button", { name: "Sesi kapat" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.localStorage.getItem(feedbackSoundPreferenceStorageKey)).toBe(
      "true",
    );
  });

  it("returns to mode selection without discarding persisted progress", async () => {
    mockedFetchSession.mockResolvedValue(
      activeSession("book", {
        answeredCount: 1,
        correctCount: 1,
        correct: [record("apple", "elma", "elma")],
      }),
    );
    const user = userEvent.setup();

    renderPracticePage();

    await screen.findByRole("heading", { name: "book" });
    await user.click(screen.getByRole("button", { name: "Modlara dön" }));

    expect(await screen.findByTestId("practice-location")).toHaveTextContent(
      "/practice",
    );
  });

  it("restores review and wrong lists from a completed server session", async () => {
    mockedFetchSession
      .mockResolvedValueOnce(activeSession("apple"))
      .mockResolvedValueOnce(
        activeSession("book", {
          answeredCount: 1,
          correctCount: 1,
          correct: [record("apple", "elma", "elma")],
        }),
      )
      .mockResolvedValueOnce(
        activeSession("water", {
          answeredCount: 2,
          correctCount: 1,
          wrongCount: 1,
          correct: [record("apple", "elma", "elma")],
          wrong: [record("book", "kitap", "kalem")],
        }),
      )
      .mockResolvedValueOnce(completedSession());
    mockedAnswer
      .mockResolvedValueOnce(answerResult("Correct", 0, "elma", 1, 1, 0, 0))
      .mockResolvedValueOnce(answerResult("Wrong", 1, "kitap", 2, 1, 0, 1))
      .mockResolvedValueOnce(answerResult("Review", 2, "su", 3, 1, 1, 1));
    const user = userEvent.setup();

    renderPracticePage();

    await screen.findByRole("heading", { name: "apple" });
    await user.click(screen.getByRole("button", { name: "elma" }));
    await screen.findByRole("heading", { name: "book" }, { timeout: 1500 });
    await user.click(screen.getByRole("button", { name: "kalem" }));
    await user.click(screen.getByRole("button", { name: "Devam et" }));
    await screen.findByRole("heading", { name: "water" });
    const unknownButton = screen.getByRole("button", {
      name: "Cevabı göster",
    });
    expect(unknownButton).toHaveClass(
      "h-full",
      "min-w-40",
      "border-primary/35",
      "bg-card",
      "text-primary",
    );
    expect(unknownButton).not.toHaveClass("w-full");
    expect(unknownButton).not.toHaveClass("hover:-translate-y-0.5");
    expect(unknownButton.querySelector("svg")).not.toBeInTheDocument();
    await user.click(unknownButton);
    expect(mockedPlayShowAnswerSound).toHaveBeenCalledOnce();
    expect(mockedAnswer).toHaveBeenLastCalledWith(
      "session-1",
      2,
      3,
      null,
      null,
    );

    await user.click(screen.getByRole("button", { name: "Sonuçları gör" }));

    expect(
      await screen.findByRole("heading", { name: "Sonuçlar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { name: "Çalışma ilerlemesi" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Tekrar 1/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Yanlış 1/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("book")).toBeInTheDocument();
    expect(screen.getByText("kalem")).toBeInTheDocument();
    expect(screen.getByText("kitap")).toBeInTheDocument();
    expect(screen.getByText("book").closest("li")).toHaveClass(
      "grid",
      "grid-rows-[auto_auto]",
    );

    await user.click(screen.getByRole("tab", { name: /Tekrar 1/ }));
    expect(screen.getByText("water")).toBeInTheDocument();
    expect(screen.queryByText("book")).not.toBeInTheDocument();
  });

  it("answers with the matching number shortcut", async () => {
    mockedFetchSession.mockResolvedValue(activeSession("apple"));
    mockedAnswer.mockResolvedValue(
      answerResult("Correct", 0, "elma", 1, 1, 0, 0),
    );
    const user = userEvent.setup();

    renderPracticePage();

    await screen.findByRole("heading", { name: "apple" });
    await user.keyboard("1");

    expect(
      await screen.findByLabelText("Doğru cevaplar: 1"),
    ).toBeInTheDocument();
    expect(mockedAnswer).toHaveBeenCalledWith("session-1", 0, 1, 0, null);
  });

  it("shows answer numbers only from the small breakpoint upward", async () => {
    mockedFetchSession.mockResolvedValue(activeSession("apple"));

    renderPracticePage();

    await screen.findByRole("heading", { name: "apple" });
    const firstOption = screen.getByRole("button", { name: "elma" });
    const shortcutNumber = firstOption.querySelector("span");

    expect(shortcutNumber).toHaveClass("hidden", "sm:flex");
    expect(firstOption).toHaveAttribute("aria-keyshortcuts", "1");
    expect(firstOption).not.toHaveClass("hover:-translate-y-0.5");
  });

  it("continues a wrong multiple-choice answer with Enter", async () => {
    mockedFetchSession.mockResolvedValue(activeSession("apple"));
    mockedAnswer.mockResolvedValue(
      answerResult("Wrong", 0, "elma", 1, 0, 0, 1),
    );
    const user = userEvent.setup();

    renderPracticePage();

    await screen.findByRole("heading", { name: "apple" });
    await user.click(screen.getByRole("button", { name: "armut" }));
    expect(
      await screen.findByRole("button", { name: "Devam et" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "apple" })).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", { name: "book" }),
    ).toBeInTheDocument();
  });

  it("checks a wrong written answer and continues with Enter", async () => {
    mockedFetchSession.mockResolvedValue(activeWrittenSession());
    mockedAnswer.mockResolvedValue(
      writtenAnswerResult("Wrong", "armut", {
        wrongCount: 1,
      }),
    );
    const user = userEvent.setup();

    renderPracticePage();

    const input = await screen.findByRole("textbox", {
      name: "Türkçe cevap",
    });
    const writtenAnswerArea = screen.getByRole("group", {
      name: "Yazılı cevap alanı",
    });
    const showAnswerButton = screen.getByRole("button", {
      name: "Cevabı göster",
    });
    const checkAnswerButton = screen.getByRole("button", {
      name: "Cevabı kontrol et",
    });

    expect(input).not.toHaveAttribute("placeholder");
    expect(input).toHaveClass("text-base", "scroll-my-4", "text-left");
    expect(screen.getByText("Türkçe:")).toBeVisible();
    expect(writtenAnswerArea).toHaveClass("content-start", "pt-4");
    expect(writtenAnswerArea).toContainElement(input);
    expect(writtenAnswerArea).toContainElement(showAnswerButton);
    expect(writtenAnswerArea).toContainElement(checkAnswerButton);
    expect(
      input.compareDocumentPosition(showAnswerButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      input.compareDocumentPosition(checkAnswerButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "elma" })).toBeNull();

    await user.type(input, "armut");
    await user.keyboard("{Enter}");

    expect(mockedAnswer).toHaveBeenCalledWith("session-1", 0, 1, null, "armut");
    expect(
      await screen.findByRole("button", { name: "Devam et" }),
    ).toBeEnabled();
    expect(input.parentElement).toHaveClass("border-error", "bg-error-subtle");

    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", { name: "book" }),
    ).toBeInTheDocument();
  });

  it("states when a written question expects an English answer", async () => {
    mockedFetchSession.mockResolvedValue({
      ...activeWrittenSession(),
      question: {
        ...writtenAppleQuestion,
        direction: "TurkishToEnglish",
        prompt: "elma",
        acceptedAnswers: ["apple"],
      },
    });

    renderPracticePage();

    const input = await screen.findByRole("textbox", {
      name: "İngilizce cevap",
    });
    expect(input).not.toHaveAttribute("placeholder");
    expect(screen.getByText("İngilizce:")).toBeVisible();
  });

  it("keeps a wrong written answer visible until the user continues", async () => {
    mockedFetchSession.mockResolvedValue(activeWrittenSession());
    mockedAnswer.mockResolvedValue(
      writtenAnswerResult("Wrong", "armut", {
        wrongCount: 1,
      }),
    );
    const user = userEvent.setup();

    renderPracticePage();

    const input = await screen.findByRole("textbox", {
      name: "Türkçe cevap",
    });
    await user.type(input, "armut");
    await user.click(screen.getByRole("button", { name: "Cevabı kontrol et" }));

    expect(await screen.findByText("Doğru cevap: elma, alma")).toBeVisible();
    expect(input).toHaveValue("armut");
    expect(input.parentElement).toHaveClass("border-error", "bg-error-subtle");
    expect(screen.getByRole("heading", { name: "apple" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Devam et" }));
    expect(
      await screen.findByRole("heading", { name: "book" }),
    ).toBeInTheDocument();
  });

  it("shows the first accepted written answer and requires manual continuation", async () => {
    mockedFetchSession.mockResolvedValue(activeWrittenSession());
    mockedAnswer.mockResolvedValue(
      writtenAnswerResult("Review", null, {
        reviewCount: 1,
      }),
    );
    const user = userEvent.setup();

    renderPracticePage();

    await screen.findByRole("textbox", { name: "Türkçe cevap" });
    await user.click(screen.getByRole("button", { name: "Cevabı göster" }));

    const input = screen.getByRole("textbox", {
      name: "Türkçe cevap",
    });
    expect(input).toHaveValue("elma");
    expect(input.parentElement).toHaveClass(
      "border-warning",
      "bg-warning-subtle",
    );
    expect(screen.getByText("Kabul edilen cevaplar: elma, alma")).toBeVisible();
    expect(mockedAnswer).toHaveBeenCalledWith("session-1", 0, 1, null, null);
    expect(
      screen.getByRole("button", { name: "Devam et" }),
    ).toBeInTheDocument();
  });

  it("automatically advances 800 ms after a correct written answer", async () => {
    mockedFetchSession.mockResolvedValue(activeWrittenSession());
    mockedAnswer.mockResolvedValue(
      writtenAnswerResult("Correct", "elma", {
        correctCount: 1,
      }),
    );

    renderPracticePage();
    const input = await screen.findByRole("textbox", {
      name: "Türkçe cevap",
    });
    fireEvent.change(input, { target: { value: "elma" } });
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Cevabı kontrol et" }),
      );
    });
    expect(
      screen.getByRole("button", { name: "Doğru cevaplar: 1" }),
    ).toBeDisabled();
    await act(async () => {
      vi.advanceTimersByTime(799);
    });
    expect(screen.getByRole("heading", { name: "apple" })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("heading", { name: "book" })).toBeInTheDocument();
  });

  it("loads the next question after 800 ms and the answer is saved", async () => {
    mockedFetchSession.mockResolvedValue(activeSession("apple"));
    let resolveAnswer!: (answer: PracticeAnswer) => void;
    mockedAnswer.mockReturnValue(
      new Promise((resolve) => {
        resolveAnswer = resolve;
      }),
    );

    renderPracticePage();
    await screen.findByRole("heading", { name: "apple" });
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "elma" }));
    });
    expect(screen.getByRole("button", { name: "elma" })).toHaveClass(
      "bg-success-subtle",
    );
    expect(screen.queryByRole("button", { name: "Devam et" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cevabı göster" })).toBeNull();
    expect(screen.queryByText("Loading next question...")).toBeNull();
    expect(screen.queryByText("Kaydediliyor...")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(mockedFetchSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "apple" })).toBeInTheDocument();
    expect(screen.queryByText("Kaydediliyor...")).toBeNull();

    await act(async () => {
      resolveAnswer(answerResult("Correct", 0, "elma", 1, 1, 0, 0));
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "book" })).toBeInTheDocument();
    expect(mockedFetchSession).toHaveBeenCalledTimes(1);
  });

  it("does not automatically advance after a wrong answer", async () => {
    mockedFetchSession
      .mockResolvedValueOnce(activeSession("apple"))
      .mockResolvedValueOnce(
        activeSession("book", {
          answeredCount: 1,
          wrongCount: 1,
          wrong: [record("apple", "elma", "armut")],
        }),
      );
    mockedAnswer.mockResolvedValue(
      answerResult("Wrong", 0, "elma", 1, 0, 0, 1),
    );

    renderPracticePage();
    await screen.findByRole("heading", { name: "apple" });
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "armut" }));
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockedFetchSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "apple" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Devam et" }));
    expect(screen.getByRole("heading", { name: "book" })).toBeInTheDocument();
  });

  it("opens final results manually after Cevabı göster", async () => {
    mockedFetchSession
      .mockResolvedValueOnce(
        activeSession("water", {
          answeredCount: 2,
          correctCount: 1,
          wrongCount: 1,
        }),
      )
      .mockResolvedValueOnce(completedSession());
    mockedAnswer.mockResolvedValue(answerResult("Review", 2, "su", 3, 1, 1, 1));

    renderPracticePage();
    await screen.findByRole("heading", { name: "water" });
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cevabı göster" }));
    });
    expect(screen.queryByText("Opening results...")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole("heading", { name: "Sonuçlar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sonuçları gör" }));
    expect(
      screen.getByRole("heading", { name: "Sonuçlar" }),
    ).toBeInTheDocument();
  });

  it("opens final results automatically 800 ms after a correct answer", async () => {
    mockedFetchSession.mockResolvedValue(
      activeSession("water", {
        answeredCount: 2,
        correctCount: 2,
      }),
    );
    mockedAnswer.mockResolvedValue(
      answerResult("Correct", 2, "su", 3, 3, 0, 0),
    );

    renderPracticePage();
    await screen.findByRole("heading", { name: "water" });
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "su" }));
    });
    await act(async () => {
      vi.advanceTimersByTime(799);
    });
    expect(screen.queryByRole("heading", { name: "Sonuçlar" })).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(
      screen.getByRole("heading", { name: "Sonuçlar" }),
    ).toBeInTheDocument();
  });

  it("keeps the fixed practice and result content geometry", async () => {
    mockedFetchSession.mockResolvedValueOnce(activeSession("apple"));

    const { unmount } = renderPracticePage();

    await screen.findByRole("heading", { name: "apple" });
    const showAnswerButton = screen.getByRole("button", {
      name: "Cevabı göster",
    });
    const practiceContent = showAnswerButton.closest(
      '[data-slot="card-content"]',
    );
    const practiceLayout = showAnswerButton.parentElement?.parentElement;
    const practiceCard = practiceContent?.closest('[data-slot="card"]');

    expect(practiceCard).toHaveClass(
      "h-112",
      "grid",
      "grid-rows-[4rem_minmax(0,1fr)_4rem]",
    );
    expect(practiceContent).toHaveClass("relative", "min-h-0");
    expect(practiceLayout).toHaveClass(
      "h-full",
      "grid-rows-[minmax(0,1fr)_2.5rem]",
      "gap-2",
    );

    unmount();
    mockedFetchSession.mockResolvedValueOnce(completedSession());
    renderPracticePage();

    const resultLists = await screen.findByRole("region", {
      name: "Çalışma sonuçları",
    });
    const resultContent = resultLists.closest('[data-slot="card-content"]');

    expect(resultContent).toHaveClass("relative", "min-h-0", "p-0");
    expect(resultLists).toHaveClass(
      "h-full",
      "grid-rows-[2.5rem_minmax(0,1fr)]",
    );
    expect(
      screen.getByRole("tablist", { name: "Sonuç kategorisi" }),
    ).not.toHaveClass("border-b");
    expect(resultContent?.previousElementSibling).not.toHaveClass("border-b");
  });

  it("restarts a completed session from its result screen", async () => {
    mockedFetchSession.mockResolvedValue(completedSession());
    mockedStart.mockResolvedValue({
      ...activeSession("apple"),
      sessionId: "session-2",
    });
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const resultsKey = [
      "practice",
      "results",
      "A1",
      "FoodAndDrink",
      "EnglishToTurkish",
    ];
    queryClient.setQueryData(resultsKey, completedResultView());

    renderPracticePage(queryClient);

    await screen.findByRole("heading", { name: "Sonuçlar" });
    await user.click(screen.getByRole("tab", { name: /Tekrar/ }));
    expect(screen.getByText("water").closest("li")).toHaveTextContent("Yazılı");
    expect(
      screen.queryByRole("link", { name: "Kategorilere dön" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Modlara dön" })).toHaveAttribute(
      "href",
      "/practice?level=A1&topic=FoodAndDrink",
    );
    const correctTab = screen.getByRole("tab", { name: /Doğru 1/ });
    await user.click(correctTab);
    expect(correctTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("apple")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tekrar çalış" }));

    expect(mockedStart).toHaveBeenCalledWith(
      {
        level: "A1",
        topic: "FoodAndDrink",
        mode: "EnglishToTurkish",
      },
      true,
    );
    expect(
      await screen.findByRole("heading", { name: "apple" }),
    ).toBeInTheDocument();
    expect(queryClient.getQueryData(resultsKey)).toBeUndefined();
  });

  it("shows an error and retries the initial session request", async () => {
    mockedFetchSession
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(activeSession("apple"));
    const user = userEvent.setup();

    renderPracticePage();

    expect(
      await screen.findByText("Çalışma oturumu yüklenemedi."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));

    expect(
      await screen.findByRole("heading", { name: "apple" }),
    ).toBeInTheDocument();
    expect(mockedFetchSession).toHaveBeenCalledTimes(2);
  });

  it("keeps the answered question visible while a failed save is retried", async () => {
    mockedFetchSession.mockResolvedValue(activeSession("apple"));
    mockedAnswer
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(answerResult("Correct", 0, "elma", 1, 1, 0, 0));
    const user = userEvent.setup();

    renderPracticePage();

    await screen.findByRole("heading", { name: "apple" });
    await user.click(screen.getByRole("button", { name: "elma" }));

    expect(
      await screen.findByRole("button", { name: "Kaydetmeyi tekrar dene" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "apple" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "elma" })).toHaveClass(
      "bg-success-subtle",
    );

    await user.click(
      screen.getByRole("button", { name: "Kaydetmeyi tekrar dene" }),
    );

    expect(
      await screen.findByRole("heading", { name: "book" }, { timeout: 1500 }),
    ).toBeInTheDocument();
    expect(mockedAnswer).toHaveBeenCalledTimes(2);
    expect(mockedFetchSession).toHaveBeenCalledTimes(1);
  });
});

function renderPracticePage(
  queryClient: QueryClient = createTestQueryClient(),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/practice/session-1"]}>
        <Routes>
          <Route
            element={
              <>
                <QuestionPracticePage />
                <LocationProbe />
              </>
            }
            path="/practice"
          />
          <Route
            element={
              <>
                <QuestionPracticePage />
                <LocationProbe />
              </>
            }
            path="/practice/results"
          />
          <Route
            element={
              <>
                <QuestionPracticePage />
                <LocationProbe />
              </>
            }
            path="/practice/:sessionId"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderModeSelection(category = modeSelectionCategory) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/practice",
            search: "?level=A1&topic=FoodAndDrink",
            state: { category, level: "A1" },
          },
        ]}
      >
        <Routes>
          <Route
            element={
              <>
                <QuestionPracticePage />
                <LocationProbe />
              </>
            }
            path="/practice"
          />
          <Route
            element={
              <>
                <QuestionPracticePage />
                <LocationProbe />
              </>
            }
            path="/practice/results"
          />
          <Route
            element={
              <>
                <QuestionPracticePage />
                <LocationProbe />
              </>
            }
            path="/practice/:sessionId"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderModeSelectionFromApi(level: string, topic: string) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter
        initialEntries={[`/practice?level=${level}&topic=${topic}`]}
      >
        <Routes>
          <Route element={<QuestionPracticePage />} path="/practice" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderPracticeResultsFromApi(
  level: string,
  topic: string,
  mode: PracticeMode,
) {
  const query = new URLSearchParams({ level, topic, mode });

  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[`/practice/results?${query.toString()}`]}>
        <Routes>
          <Route element={<QuestionPracticePage />} path="/practice/results" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="practice-location">{location.pathname}</span>
      <span data-testid="practice-location-state">
        {location.state === null ? "empty" : "set"}
      </span>
    </>
  );
}

function activeSession(
  question: QuestionKey,
  state: {
    answeredCount?: number;
    correctCount?: number;
    reviewCount?: number;
    wrongCount?: number;
    correct?: PracticeWordRecord[];
    review?: PracticeWordRecord[];
    wrong?: PracticeWordRecord[];
  } = {},
): PracticeSession {
  return {
    sessionId: "session-1",
    status: "Active",
    level: "A1",
    topic: "FoodAndDrink",
    mode: "EnglishToTurkish",
    progress: {
      answeredCount: state.answeredCount ?? 0,
      totalCount: 3,
      correctCount: state.correctCount ?? 0,
      reviewCount: state.reviewCount ?? 0,
      wrongCount: state.wrongCount ?? 0,
    },
    question: questions[question],
    upcomingQuestions: getUpcomingQuestions(question),
    results: {
      correct: state.correct ?? [],
      review: state.review ?? [],
      wrong: state.wrong ?? [],
    },
  };
}

function activeWrittenSession(): PracticeSession {
  return {
    ...activeSession("apple"),
    mode: "Mixed",
    question: writtenAppleQuestion,
    upcomingQuestions: [questions.book, questions.water],
  };
}

function writtenAnswerResult(
  outcome: PracticeOutcome,
  writtenAnswer: string | null,
  counts: {
    correctCount?: number;
    reviewCount?: number;
    wrongCount?: number;
  },
): PracticeAnswer {
  const resultCategory =
    outcome === "Correct"
      ? "correct"
      : outcome === "Review"
        ? "review"
        : "wrong";
  const recordValue: PracticeWordRecord = {
    wordId: writtenAppleQuestion.wordId,
    direction: writtenAppleQuestion.direction,
    format: "Written",
    prompt: writtenAppleQuestion.prompt,
    correctAnswer: "elma, alma",
    selectedAnswer: writtenAnswer,
  };
  const nextSession: PracticeSession = {
    ...activeSession("book", {
      answeredCount: 1,
      correctCount: counts.correctCount ?? 0,
      reviewCount: counts.reviewCount ?? 0,
      wrongCount: counts.wrongCount ?? 0,
    }),
    mode: "Mixed",
    results: {
      correct: resultCategory === "correct" ? [recordValue] : [],
      review: resultCategory === "review" ? [recordValue] : [],
      wrong: resultCategory === "wrong" ? [recordValue] : [],
    },
  };

  return {
    outcome,
    correctIndex: null,
    selectedIndex: null,
    writtenAnswer,
    correctAnswer: "elma, alma",
    progress: nextSession.progress,
    isComplete: false,
    session: nextSession,
  };
}

function completedSession(): PracticeSession {
  return {
    ...activeSession("water"),
    status: "Completed",
    question: null,
    upcomingQuestions: [],
    progress: {
      answeredCount: 3,
      totalCount: 3,
      correctCount: 1,
      reviewCount: 1,
      wrongCount: 1,
    },
    results: {
      correct: [record("apple", "elma", "elma")],
      review: [record("water", "su", null, "Written")],
      wrong: [record("book", "kitap", "kalem")],
    },
  };
}

function completedResultView(): PracticeResultView {
  const session = completedSession();
  return {
    level: session.level,
    topic: session.topic,
    mode: session.mode,
    progress: session.progress,
    results: session.results,
  };
}

function answerResult(
  outcome: PracticeOutcome,
  correctIndex: number,
  correctAnswer: string,
  answeredCount: number,
  correctCount: number,
  reviewCount: number,
  wrongCount: number,
): PracticeAnswer {
  const currentQuestion = getQuestionForAnsweredCount(answeredCount);
  const selectedAnswer =
    outcome === "Review"
      ? null
      : outcome === "Correct"
        ? correctAnswer
        : (questions[currentQuestion].options.find(
            (option) => option !== correctAnswer,
          ) ?? null);
  const results = getPreviousSonuçlar(answeredCount);
  results[
    outcome === "Correct"
      ? "correct"
      : outcome === "Review"
        ? "review"
        : "wrong"
  ].push(record(currentQuestion, correctAnswer, selectedAnswer));
  const session =
    answeredCount === 3
      ? {
          ...completedSession(),
          progress: {
            answeredCount,
            totalCount: 3,
            correctCount,
            reviewCount,
            wrongCount,
          },
          results,
        }
      : activeSession(answeredCount === 1 ? "book" : "water", {
          answeredCount,
          correctCount,
          reviewCount,
          wrongCount,
          ...results,
        });

  return {
    outcome,
    correctIndex,
    selectedIndex: outcome === "Review" ? null : 0,
    writtenAnswer: null,
    correctAnswer,
    progress: {
      answeredCount,
      totalCount: 3,
      correctCount,
      reviewCount,
      wrongCount,
    },
    isComplete: answeredCount === 3,
    session,
  };
}

function getUpcomingQuestions(question: QuestionKey) {
  const order: QuestionKey[] = ["apple", "book", "water"];
  return order.slice(order.indexOf(question) + 1).map((key) => questions[key]);
}

function getQuestionForAnsweredCount(answeredCount: number): QuestionKey {
  return (["apple", "book", "water"] as const)[answeredCount - 1];
}

function getPreviousSonuçlar(answeredCount: number): {
  correct: PracticeWordRecord[];
  review: PracticeWordRecord[];
  wrong: PracticeWordRecord[];
} {
  return {
    correct: answeredCount > 1 ? [record("apple", "elma", "elma")] : [],
    review: [],
    wrong: answeredCount > 2 ? [record("book", "kitap", "kalem")] : [],
  };
}

function record(
  questionKey: QuestionKey,
  correctAnswer: string,
  selectedAnswer: string | null,
  format: PracticeWordRecord["format"] = "MultipleChoice",
): PracticeWordRecord {
  return {
    wordId: questions[questionKey].wordId,
    direction: "EnglishToTurkish",
    format,
    prompt: questionKey,
    correctAnswer,
    selectedAnswer,
  };
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
