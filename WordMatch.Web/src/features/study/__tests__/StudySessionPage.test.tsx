/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/features/auth/AuthProvider";
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
    expect(screen.getByRole("tab", { name: "Doğru 0" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Bilmiyorum 0" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Yanlış 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Yanlış 1" })).toBeEnabled();
    expect(
      screen.getByRole("tabpanel", { name: "Yanlış sonuçları" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(
      screen.queryByRole("button", { name: /Sonuç listesini/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Bilmiyorum 0" }));
    expect(
      within(
        screen.getByRole("tabpanel", { name: "Bilmiyorum sonuçları" }),
      ).getByText("Gözden geçirilecek cevap yok."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Bilmiyorum 0" }));
    expect(
      screen.getByRole("tabpanel", { name: "Bilmiyorum sonuçları" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows completion results immediately and keeps empty tabs available", async () => {
    const user = userEvent.setup();
    renderSession({
      ...completedSession,
      progress: {
        ...completedSession.progress,
        correctCount: 1,
        wrongCount: 0,
        reviewCount: 0,
      },
      summary: {
        ...completedSession.summary,
        results: completedSession.summary.results.map((result) => ({
          ...result,
          outcome: "Correct",
        })),
      },
    });
    expect(screen.getByRole("tab", { name: "Doğru 1" })).toBeInTheDocument();
    const review = screen.getByRole("tab", { name: "Bilmiyorum 0" });
    expect(review).toBeEnabled();
    expect(
      screen.getByRole("tabpanel", { name: "Doğru sonuçları" }),
    ).toBeInTheDocument();
    const correctPanel = screen.getByRole("tabpanel", {
      name: "Doğru sonuçları",
    });
    expect(within(correctPanel).getByText("cat")).toBeInTheDocument();
    expect(within(correctPanel).getByText("kedi")).toBeInTheDocument();
    await user.click(review);
    expect(
      within(
        screen.getByRole("tabpanel", { name: "Bilmiyorum sonuçları" }),
      ).getByText("Gözden geçirilecek cevap yok."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Yanlış 0" }));
    expect(
      screen.getByRole("tabpanel", { name: "Yanlış sonuçları" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Sonuç listesini/ }),
    ).not.toBeInTheDocument();
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
    moveMouse();
    await user.click(screen.getByRole("button", { name: "Şimdi yazamam" }));

    expect(
      screen.getByText("Yazma soruları 10 dakika ertelensin mi?"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "İngilizce cevap" }),
    ).not.toBeInTheDocument();
    expect(deferStudySkill).not.toHaveBeenCalled();

    moveMouse();
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(
      screen.getByRole("button", { name: "Şimdi yazamam" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "İngilizce cevap" }),
    ).toHaveValue("dog");
    expect(
      screen.getByRole("textbox", { name: "İngilizce cevap" }),
    ).toHaveFocus();
    expect(deferStudySkill).not.toHaveBeenCalled();

    moveMouse();
    await user.click(screen.getByRole("button", { name: "Şimdi yazamam" }));
    moveMouse();
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
    expect(screen.getByLabelText("Oturum özeti")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ana sayfaya dön" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Devam et" }));
    expect(continueAfterStudySession).toHaveBeenCalledWith(sessionId);
  });

  it("releases the completed session before returning home", async () => {
    vi.mocked(abandonStudySession).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSession(completedSession);

    await user.click(screen.getByRole("button", { name: "Ana sayfaya dön" }));

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
    expect(screen.getByLabelText("Doğru cevaplar: 1")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "dog" }, { timeout: 1_500 }),
    ).toBeInTheDocument();
  });

  it("navigates all four arrows with wrapping without submitting an answer", async () => {
    const user = userEvent.setup();
    renderSession(activeSession);
    const options = activeSession.question!.options.map((option) =>
      screen.getByRole("button", { name: option }),
    );
    const title = screen.getByRole("heading", { name: "cat" });
    await user.keyboard("{ArrowDown}");
    expect(options[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(options[1]).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(options[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(options.at(-1)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(options[0]).toHaveFocus();
    title.focus();
    await user.keyboard("{ArrowLeft}");
    expect(options.at(-1)).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, {
      key: "ArrowDown",
      repeat: true,
    });
    expect(options[0]).toHaveFocus();
    expect(answerStudyQuestion).not.toHaveBeenCalled();
  });

  it("answers the focused option once with Enter and restores title focus for continuation", async () => {
    const nextSession = makeNextQuestionSession("Wrong");
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer("Wrong", nextSession, { correctIndex: 1, selectedIndex: 0 }),
    );
    const user = userEvent.setup();
    renderSession(activeSession);
    await user.keyboard("{Enter}");
    expect(answerStudyQuestion).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(answerStudyQuestion).toHaveBeenCalledExactlyOnceWith(
      sessionId,
      0,
      1,
      0,
      null,
    );
    expect(screen.getByRole("heading", { name: "cat" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "dog" })).toHaveFocus();
    expect(screen.getByRole("main")).toHaveClass("cursor-none");
    await user.keyboard("{Enter}");
    expect(answerStudyQuestion).toHaveBeenCalledTimes(1);
  });

  it.each(["movement", "press"])(
    "ignores Enter after mouse %s until arrow navigation resumes",
    async (wake) => {
      vi.mocked(answerStudyQuestion).mockResolvedValue(
        makeAnswer("Wrong", completedSession, {
          correctIndex: 0,
          selectedIndex: 1,
        }),
      );
      const user = userEvent.setup();
      renderSession(activeSession);
      await user.keyboard("{ArrowDown}");
      const page = screen.getByRole("main");
      if (wake === "movement") moveMouse();
      else await user.pointer({ target: page, keys: "[MouseLeft]" });
      expect(page).not.toHaveClass("cursor-none");
      await user.keyboard("{Enter}{Enter}");
      expect(answerStudyQuestion).not.toHaveBeenCalled();
      expect(page).not.toHaveClass("cursor-none");
      await user.keyboard("{ArrowRight}{Enter}");
      expect(answerStudyQuestion).toHaveBeenCalledExactlyOnceWith(
        sessionId,
        0,
        1,
        1,
        null,
      );
    },
  );

  it("hides the page cursor only in keyboard mode and restores it for mouse input", async () => {
    const user = userEvent.setup();
    renderSession(activeSession);
    const page = screen.getByRole("main");
    const move = (movementX = 0) => {
      const event = new Event("pointermove", { bubbles: true });
      Object.assign(event, {
        pointerType: "mouse",
        clientX: 100,
        clientY: 100,
        movementX,
        movementY: 0,
      });
      fireEvent(window, event);
    };
    move();
    await user.keyboard("{ArrowDown}");
    expect(page).toHaveClass("cursor-none", "**:cursor-none");
    move();
    expect(page).toHaveClass("cursor-none");
    move(1);
    expect(page).not.toHaveClass("cursor-none");
    await user.keyboard("{ArrowUp}");
    expect(page).toHaveClass("cursor-none");
    await user.pointer({ target: page, keys: "[MouseLeft]" });
    expect(page).not.toHaveClass("cursor-none");
  });

  it("does not redirect arrows from footer controls or while browsing results", async () => {
    const user = userEvent.setup();
    renderSession(activeSession);
    const counter = screen.getByRole("button", { name: "Yanlış cevaplar: 0" });
    counter.focus();
    await user.keyboard("{ArrowDown}1");
    expect(counter).toHaveFocus();
    expect(answerStudyQuestion).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("region", { name: "Çalışma sonuçları" }),
    ).toHaveFocus();
    expect(screen.getByRole("main")).not.toHaveClass("cursor-none");
    await user.keyboard("{ArrowDown}{ArrowRight}1");
    expect(answerStudyQuestion).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(document.body).toHaveFocus();
    expect(screen.getByRole("main")).toHaveClass("cursor-none");
  });

  it("resumes writing from a blank area without losing or duplicating characters", async () => {
    const user = userEvent.setup();
    renderSession(makeWrittenSession());
    const input = screen.getByRole("textbox", { name: "İngilizce cevap" });

    moveMouse();
    await user.click(screen.getByRole("main"));
    expect(input).not.toHaveFocus();
    await user.keyboard("ç{Shift>}A{/Shift}");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("çA");

    await user.keyboard("{ArrowLeft}");
    moveMouse();
    await user.click(screen.getByRole("main"));
    await user.keyboard("{b>3/}");
    expect(input).toHaveValue("çAbbb");
    expect(answerStudyQuestion).not.toHaveBeenCalled();
  });

  it("preserves shortcuts, selected text, and focus on other controls", async () => {
    const user = userEvent.setup();
    renderSession(makeWrittenSession());
    const input = screen.getByRole("textbox", { name: "İngilizce cevap" });
    moveMouse();
    await user.click(screen.getByRole("main"));

    await user.keyboard(
      "{Control>}a{/Control}{Meta>}f{/Meta}{Alt>}s{/Alt}{ArrowLeft}",
    );
    expect(input).not.toHaveFocus();
    expect(input).toHaveValue("");

    const button = screen.getByRole("button", { name: "Cevabı göster" });
    button.focus();
    await user.keyboard("a");
    expect(button).toHaveFocus();
    expect(input).toHaveValue("");

    screen.getByRole("heading", { name: "kedi" }).focus();
    const selection = window.getSelection()!;
    selection.selectAllChildren(screen.getByRole("heading", { name: "kedi" }));
    await user.keyboard("b");
    expect(input).not.toHaveFocus();
    expect(input).toHaveValue("");
    selection.removeAllRanges();
  });

  it("only releases focus with Escape and resumes writing on a character key", async () => {
    const user = userEvent.setup();
    renderSession(makeWrittenSession());
    const input = screen.getByRole("textbox", { name: "İngilizce cevap" });
    await user.keyboard("ca{Escape}");
    expect(input).not.toHaveFocus();
    expect(input).toHaveValue("ca");

    await user.keyboard("{Escape}");
    expect(document.body).toHaveFocus();
    await user.keyboard("t{Escape}");
    expect(input).not.toHaveFocus();
    await user.keyboard("s");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("cats");
    expect(answerStudyQuestion).not.toHaveBeenCalled();
  });

  it.each([
    ["written", makeWrittenSession(), "Cevabı göster"],
    ["multiple choice", activeSession, "köpek"],
  ])(
    "releases Tab focus with Escape in %s questions",
    async (_, session, label) => {
      const user = userEvent.setup();
      renderSession(session);
      await user.tab();
      const button = screen.getByRole("button", { name: label });
      expect(button).toHaveFocus();

      await user.keyboard("{Escape}");
      expect(document.body).toHaveFocus();
      expect(answerStudyQuestion).not.toHaveBeenCalled();

      if (session.question?.kind === "Written") {
        await user.keyboard("cat");
        expect(screen.getByRole("textbox")).toHaveFocus();
        expect(screen.getByRole("textbox")).toHaveValue("cat");
      }
    },
  );

  it("releases focus from both the actual navbar and the question after Tab navigation", async () => {
    const user = userEvent.setup();
    renderSession(makeWrittenSession(), true);

    await user.tab({ shift: true });
    expect(
      screen.getByRole("button", { name: "Hesap menüsünü aç" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(document.body).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(document.body).toHaveFocus();
    await user.keyboard("a");
    expect(screen.getByRole("textbox")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cevabı göster" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(document.body).toHaveFocus();
    expect(answerStudyQuestion).not.toHaveBeenCalled();
  });

  it("does not activate the deferral button with Enter after dismissing Tab focus", async () => {
    const user = userEvent.setup();
    renderSession(makeWrittenSession());
    await user.tab();
    await user.tab();
    const button = screen.getByRole("button", { name: "Şimdi yazamam" });
    expect(button).toHaveFocus();

    await user.keyboard("{Escape}{Enter}");
    expect(document.body).toHaveFocus();
    expect(button).not.toHaveFocus();
    expect(
      screen.queryByRole("group", { name: "Yazma sorularını erteleme onayı" }),
    ).not.toBeInTheDocument();
    expect(deferStudySkill).not.toHaveBeenCalled();
    expect(answerStudyQuestion).not.toHaveBeenCalled();
  });

  it("does not continue to the next question with Enter after dismissing button focus", async () => {
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer("Wrong", makeNextQuestionSession("Wrong"), {
        correctIndex: 1,
        selectedIndex: 0,
      }),
    );
    const user = userEvent.setup();
    renderSession(activeSession);
    await user.click(screen.getByRole("button", { name: "köpek" }));
    await screen.findByRole("button", { name: "Devam et" });
    await user.tab();
    expect(screen.getByRole("button", { name: "Devam et" })).toHaveFocus();

    await user.keyboard("{Escape}{Enter}");
    expect(document.body).toHaveFocus();
    expect(screen.getByRole("heading", { name: "cat" })).toBeInTheDocument();
    expect(answerStudyQuestion).toHaveBeenCalledTimes(1);
  });

  it("blurs the written input with Escape even when page text is selected", async () => {
    const user = userEvent.setup();
    renderSession(makeWrittenSession());
    const input = screen.getByRole("textbox", { name: "İngilizce cevap" });
    const selection = window.getSelection()!;
    selection.selectAllChildren(screen.getByRole("heading", { name: "kedi" }));

    await user.keyboard("{Escape}");
    selection.removeAllRanges();
    expect(input).not.toHaveFocus();
    await user.keyboard("{Escape}");
    expect(document.body).toHaveFocus();
  });

  it("does not redirect writing while browsing results or confirming deferral", async () => {
    const user = userEvent.setup();
    renderSession(makeWrittenSession());
    moveMouse();
    await user.click(
      screen.getByRole("button", { name: "Yanlış cevaplar: 0" }),
    );
    await user.keyboard("cat");
    expect(
      screen.getByRole("region", { name: "Çalışma sonuçları" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("textbox")).toHaveValue("");

    moveMouse();
    await user.click(screen.getByRole("button", { name: "Şimdi yazamam" }));
    await user.keyboard("cat");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(answerStudyQuestion).not.toHaveBeenCalled();
    expect(deferStudySkill).not.toHaveBeenCalled();
  });

  it("closes written results with Escape without restoring focus and resumes the draft on typing", async () => {
    const user = userEvent.setup();
    renderSession(makeWrittenSession());
    await user.keyboard("ca");
    moveMouse();
    await user.click(
      screen.getByRole("button", { name: "Yanlış cevaplar: 0" }),
    );

    await user.keyboard("{Escape}{Enter}{Escape}");
    expect(document.body).toHaveFocus();
    expect(
      screen.queryByRole("region", { name: "Çalışma sonuçları" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("ca");
    expect(answerStudyQuestion).not.toHaveBeenCalled();

    await user.keyboard("t");
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByRole("textbox")).toHaveValue("cat");
  });

  it("releases focus from deferral confirmation controls without confirming or cancelling", async () => {
    const user = userEvent.setup();
    renderSession(makeWrittenSession());
    await user.click(screen.getByRole("button", { name: "Şimdi yazamam" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Ertele" })).toHaveFocus();

    await user.keyboard("{Escape}{Enter}{Escape}");
    expect(document.body).toHaveFocus();
    expect(
      screen.getByRole("group", { name: "Yazma sorularını erteleme onayı" }),
    ).toBeInTheDocument();
    expect(deferStudySkill).not.toHaveBeenCalled();
    expect(answerStudyQuestion).not.toHaveBeenCalled();
  });

  it("leaves arrow keys in written inputs and keeps their caret visible", async () => {
    const user = userEvent.setup();
    renderSession(makeWrittenSession());
    const input = screen.getByRole("textbox", { name: "İngilizce cevap" });
    await user.type(input, "dog");
    await user.keyboard("{ArrowLeft}");
    expect(input).toHaveFocus();
    expect(input).toHaveProperty("selectionStart", 2);
    expect(input).not.toHaveClass("caret-transparent");
    expect(answerStudyQuestion).not.toHaveBeenCalled();
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
    for (const option of nextSession.question!.options) {
      expect(screen.getByRole("button", { name: option })).toHaveClass(
        "hover:bg-card",
      );
      expect(screen.getByRole("button", { name: option })).not.toHaveClass(
        "hover:bg-info-subtle",
      );
    }
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

  it.each([
    { label: "Cevabı göster", selectedIndex: null },
    { label: "köpek", selectedIndex: 0 },
  ])(
    "uses the first stationary mouse click on $label only to wake the cursor",
    async ({ label, selectedIndex }) => {
      vi.mocked(answerStudyQuestion).mockResolvedValue(
        makeAnswer("Review", completedSession, {
          correctIndex: 1,
          selectedIndex: null,
        }),
      );
      const user = userEvent.setup();
      renderSession(activeSession);
      const reveal = screen.getByRole("button", { name: label });
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("main")).toHaveAttribute(
        "data-question-keyboard",
      );
      await user.pointer({ target: reveal, keys: "[MouseLeft]" });
      expect(answerStudyQuestion).not.toHaveBeenCalled();
      expect(screen.getByRole("main")).not.toHaveAttribute(
        "data-question-keyboard",
      );
      expect(screen.getByRole("main")).not.toHaveClass("cursor-none");
      await user.pointer({ target: reveal, keys: "[MouseLeft]" });
      expect(answerStudyQuestion).toHaveBeenCalledExactlyOnceWith(
        sessionId,
        0,
        1,
        selectedIndex,
        null,
      );
    },
  );

  it("allows the first click after real mouse movement", async () => {
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer("Review", completedSession, {
        correctIndex: 1,
        selectedIndex: null,
      }),
    );
    const user = userEvent.setup();
    renderSession(activeSession);
    await user.keyboard("{ArrowDown}");
    const move = new Event("pointermove", { bubbles: true });
    Object.assign(move, {
      pointerType: "mouse",
      clientX: 10,
      clientY: 10,
      movementX: 1,
      movementY: 0,
    });
    fireEvent(window, move);
    await user.pointer({
      target: screen.getByRole("button", { name: "Cevabı göster" }),
      keys: "[MouseLeft]",
    });
    expect(answerStudyQuestion).toHaveBeenCalledExactlyOnceWith(
      sessionId,
      0,
      1,
      null,
      null,
    );
  });

  it("keeps touch and keyboard activation available while the cursor is hidden", async () => {
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer("Review", completedSession, {
        correctIndex: 1,
        selectedIndex: null,
      }),
    );
    const user = userEvent.setup();
    renderSession(activeSession);
    await user.keyboard("{ArrowDown}");
    const reveal = screen.getByRole("button", { name: "Cevabı göster" });
    reveal.focus();
    await user.keyboard("{Enter}");
    expect(answerStudyQuestion).toHaveBeenCalledExactlyOnceWith(
      sessionId,
      0,
      1,
      null,
      null,
    );
    cleanup();
    vi.mocked(answerStudyQuestion).mockClear();
    renderSession(activeSession);
    await user.keyboard("{ArrowDown}");
    await user.pointer({
      target: screen.getByRole("button", { name: "Cevabı göster" }),
      keys: "[TouchA]",
    });
    expect(answerStudyQuestion).toHaveBeenCalledExactlyOnceWith(
      sessionId,
      0,
      1,
      null,
      null,
    );
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
    expect(answerField).toHaveFocus();
    await user.keyboard("cat");
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
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("heading", { name: "Oturum tamamlandı" }),
    ).toBeInTheDocument();
    expect(answerStudyQuestion).toHaveBeenCalledTimes(1);
  });

  it.each(["Correct", "Wrong", "Review"] as const)(
    "keeps an Escape-dismissed input unfocused when a pending %s answer arrives",
    async (outcome) => {
      let resolveAnswer!: (answer: StudyAnswer) => void;
      vi.mocked(answerStudyQuestion).mockReturnValue(
        new Promise<StudyAnswer>((resolve) => {
          resolveAnswer = resolve;
        }),
      );
      const user = userEvent.setup();
      renderSession(makeWrittenSession());
      await user.keyboard("cat{Enter}");
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("readonly");
      await user.keyboard("dog{Enter}");
      expect(input).toHaveValue("cat");
      expect(answerStudyQuestion).toHaveBeenCalledExactlyOnceWith(
        sessionId,
        0,
        1,
        null,
        "cat",
      );

      await user.keyboard("{Escape}");
      expect(document.body).toHaveFocus();
      await act(async () => {
        resolveAnswer(
          makeAnswer(outcome, completedSession, {
            correctIndex: null,
            selectedIndex: null,
          }),
        );
      });
      expect(document.body).toHaveFocus();
      expect(input).toHaveAttribute("readonly");
      await user.keyboard("{Enter}");
      expect(screen.getByRole("heading", { name: "kedi" })).toBeInTheDocument();
      expect(answerStudyQuestion).toHaveBeenCalledTimes(1);
    },
  );

  it("focuses a new written question after Escape dismissed focus on the previous answer", async () => {
    const writtenSession = makeWrittenSession();
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer(
        "Correct",
        {
          ...makeNextQuestionSession("Correct"),
          question: {
            ...writtenSession.question!,
            position: 1,
            wordId: 2,
            prompt: "köpek",
          },
        },
        { correctIndex: null, selectedIndex: null },
      ),
    );
    const user = userEvent.setup();
    renderSession(writtenSession);
    await user.keyboard("cat{Enter}");
    await screen.findByText("Sonraki soru…");
    await user.keyboard("{Escape}");
    expect(document.body).toHaveFocus();

    await screen.findByRole("heading", { name: "köpek" }, { timeout: 1_500 });
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("textbox")).not.toHaveAttribute("readonly");
  });

  it("focuses the next written question after continuing with Enter", async () => {
    const writtenSession = makeWrittenSession();
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer(
        "Wrong",
        {
          ...makeNextQuestionSession("Wrong"),
          question: { ...writtenSession.question!, position: 1, wordId: 2 },
        },
        { correctIndex: null, selectedIndex: null },
      ),
    );
    const user = userEvent.setup();
    renderSession(writtenSession);

    await user.keyboard("dog{Enter}");
    await screen.findByRole("button", { name: "Devam et" });
    expect(screen.getByRole("textbox")).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByRole("textbox")).toHaveValue("");
    await user.keyboard("cat");
    expect(screen.getByRole("textbox")).toHaveValue("cat");
    expect(answerStudyQuestion).toHaveBeenCalledTimes(1);
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
    moveMouse();
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

  it.each([
    ["Bilmiyorum cevapları: 0", "Bilmiyorum sonuçları"],
    ["Yanlış cevaplar: 0", "Yanlış sonuçları"],
  ])("opens and closes an empty list from %s", async (label, panelName) => {
    const user = userEvent.setup();
    renderSession(activeSession);
    const counter = screen.getByRole("button", { name: label });
    expect(counter).toBeEnabled();
    await user.click(counter);
    const panel = screen.getByRole("tabpanel", { name: panelName });
    expect(
      within(panel).getByText("Gözden geçirilecek cevap yok."),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: `${label}. Sonuç listesini kapat` }),
    );
    expect(screen.getByRole("heading", { name: "cat" })).toHaveFocus();
    expect(answerStudyQuestion).not.toHaveBeenCalled();
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
    expect(
      screen.getByRole("region", { name: "Çalışma sonuçları" }),
    ).toHaveFocus();
    expect(
      screen.queryByRole("heading", { name: "dog" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Soruya dön" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Bu oturumdaki cevaplar" }),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByRole("region", { name: "Çalışma sonuçları" })
        .closest('[data-slot="card"]')
        ?.querySelector('[data-slot="card-header"]'),
    ).toBeNull();
    expect(
      screen.getByLabelText("2 sorudan 1 tanesi cevaplandı"),
    ).toBeInTheDocument();
    expect(screen.getByText("cat")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Yanlış cevaplar: 1. Sonuç listesini kapat",
      }),
    );
    expect(screen.getByRole("button", { name: "köpek" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "dog" })).toHaveFocus();
  });

  it("blocks hidden answer shortcuts while browsing and returns with Escape or the selected counter", async () => {
    const user = userEvent.setup();
    renderSession(makeNextQuestionSession("Wrong"));
    moveMouse();
    await user.click(
      screen.getByRole("button", { name: "Yanlış cevaplar: 1" }),
    );
    await user.keyboard("1{Enter}");
    expect(answerStudyQuestion).not.toHaveBeenCalled();
    expect(
      screen.getByRole("region", { name: "Çalışma sonuçları" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(document.body).toHaveFocus();
    expect(
      screen.queryByRole("region", { name: "Çalışma sonuçları" }),
    ).not.toBeInTheDocument();
    moveMouse();
    await user.click(
      screen.getByRole("button", { name: "Yanlış cevaplar: 1" }),
    );
    moveMouse();
    await user.click(
      screen.getByRole("button", {
        name: "Yanlış cevaplar: 1. Sonuç listesini kapat",
      }),
    );
    expect(screen.getByRole("heading", { name: "dog" })).toHaveFocus();
    expect(answerStudyQuestion).not.toHaveBeenCalled();
  });

  it("does not advance an answered question from the interim review", async () => {
    vi.mocked(answerStudyQuestion).mockResolvedValue(
      makeAnswer("Wrong", makeNextQuestionSession("Wrong"), {
        correctIndex: 1,
        selectedIndex: 0,
      }),
    );
    const user = userEvent.setup();
    renderSession({
      ...activeSession,
      progress: { ...activeSession.progress, totalCount: 2 },
    });
    await user.click(screen.getByRole("button", { name: "köpek" }));
    await screen.findByRole("button", { name: "Devam et" });
    await user.click(
      screen.getByRole("button", { name: "Yanlış cevaplar: 1" }),
    );
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("region", { name: "Çalışma sonuçları" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Yanlış cevaplar: 1. Sonuç listesini kapat",
      }),
    );
    expect(screen.getByRole("heading", { name: "cat" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "dog" })).toBeInTheDocument();
    expect(answerStudyQuestion).toHaveBeenCalledTimes(1);
  });

  it("preserves a written draft when returning from interim review", async () => {
    const user = userEvent.setup();
    renderSession({
      ...makeNextQuestionSession("Wrong"),
      question: makeWrittenSession().question,
    });
    await user.type(
      screen.getByRole("textbox", { name: "İngilizce cevap" }),
      "dog",
    );
    moveMouse();
    await user.click(
      screen.getByRole("button", { name: "Yanlış cevaplar: 1" }),
    );
    expect(
      screen.queryByRole("textbox", { name: "İngilizce cevap" }),
    ).not.toBeInTheDocument();
    moveMouse();
    await user.click(
      screen.getByRole("button", {
        name: "Yanlış cevaplar: 1. Sonuç listesini kapat",
      }),
    );
    expect(
      screen.getByRole("textbox", { name: "İngilizce cevap" }),
    ).toHaveValue("dog");
    expect(
      screen.getByRole("textbox", { name: "İngilizce cevap" }),
    ).toHaveFocus();
    await user.keyboard("s");
    expect(
      screen.getByRole("textbox", { name: "İngilizce cevap" }),
    ).toHaveValue("dogs");
    expect(answerStudyQuestion).not.toHaveBeenCalled();
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

function moveMouse() {
  const event = new Event("pointermove", { bubbles: true });
  Object.assign(event, {
    pointerType: "mouse",
    clientX: 100,
    clientY: 100,
    movementX: 1,
    movementY: 0,
  });
  fireEvent(window, event);
}

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

function renderSession(
  initialSession: StudySession | null,
  withNavbar = false,
) {
  const queryClient = createTestQueryClient();
  if (withNavbar) {
    queryClient.setQueryDefaults(["auth", "session"], { staleTime: Infinity });
    queryClient.setQueryData(["auth", "session"], null);
  }
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: `/session/${sessionId}`,
            state: initialSession ? { session: initialSession } : null,
          },
        ]}
      >
        {withNavbar ? (
          <AuthProvider>
            <Navbar />
          </AuthProvider>
        ) : null}
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
