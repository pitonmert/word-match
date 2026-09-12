/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import StudyHomePage from "@/features/study/StudyHomePage";
import {
  continueStudySession,
  fetchStudyOverview,
  startStudySession,
  takeOverStudySession,
  type StudyOverview,
  type StudySession,
} from "@/features/study/api/study";
import { ApiError } from "@/lib/api/client";
import { createTestQueryClient } from "@/test/createTestQueryClient";

vi.mock("@/features/study/api/study", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/features/study/api/study")>();
  return {
    ...original,
    continueStudySession: vi.fn(),
    fetchStudyOverview: vi.fn(),
    startStudySession: vi.fn(),
    takeOverStudySession: vi.fn(),
  };
});

const currentTopic = {
  id: 7,
  level: "A1",
  topic: "Animals",
  introducedWordCount: 3,
  recognitionWordCount: 5,
  wordCount: 11,
  isCompleted: false,
};

const overview: StudyOverview = {
  curriculumTopic: currentTopic,
  curriculumCompleted: false,
  reviewQuestionCount: 2,
  nextAction: {
    kind: "StartTopic",
    sessionId: null,
    topic: currentTopic,
  },
  levels: [
    {
      level: "A1",
      // Curriculum order, which is deliberately not alphabetical.
      topics: [
        {
          id: 5,
          level: "A1",
          topic: "TechnologyAndMedia",
          introducedWordCount: 4,
          recognitionWordCount: 4,
          wordCount: 4,
          isCompleted: true,
        },
        currentTopic,
        {
          id: 9,
          level: "A1",
          topic: "Colors",
          introducedWordCount: 0,
          recognitionWordCount: 0,
          wordCount: 10,
          isCompleted: false,
        },
      ],
    },
    {
      level: "A2",
      topics: [
        {
          id: 21,
          level: "A2",
          topic: "Descriptions",
          introducedWordCount: 0,
          recognitionWordCount: 0,
          wordCount: 30,
          isCompleted: false,
        },
      ],
    },
  ],
};

const session: StudySession = {
  sessionId: "00000000-0000-0000-0000-000000000001",
  status: "Active",
  mode: "Topic",
  topic: currentTopic,
  progress: {
    answeredCount: 0,
    totalCount: 10,
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
    options: ["kedi", "köpek", "kitap", "radyo"],
    isIntroduction: true,
  },
  summary: {
    introducedWordCount: 0,
    strengthenedWordCount: 0,
    nextReviewAtUtc: null,
    topicCompleted: false,
    reviewQuestionCount: 2,
    canContinue: true,
    results: [],
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StudyHomePage", () => {
  it("shows the current topic and progress as a single start surface", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    renderHome();

    expect(
      await screen.findByRole("heading", { name: "Hayvanlar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.queryByText("Sıradaki konu")).not.toBeInTheDocument();
    expect(screen.getByText("3 / 11 kelime")).toBeInTheDocument();
    expect(screen.queryByText("İlerleme")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Başla" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tüm Konular" })).toBeEnabled();
  });

  it("shows completed progress and explains words with a next step", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    renderHome();

    await screen.findByRole("heading", { name: "Hayvanlar" });
    expect(screen.getByTestId("completion-progress")).toHaveStyle({
      width: "27%",
    });
    expect(
      screen.queryByTestId("recognition-progress"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("2 kelimeyi yazman kaldı")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "3 / 11 kelime.",
    );
  });

  it("offers no study type or skill selection", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    renderHome();
    await screen.findByRole("heading", { name: "Hayvanlar" });

    expect(screen.queryAllByRole("radiogroup")).toHaveLength(0);
    for (const removed of [
      "Planlı çalışma",
      "Konu keşfi",
      "Dengeli çalışma",
      "Anlamını seç",
      "Yazarak hatırla",
      "Dinleyerek seç",
      "Konuşarak hatırla",
    ]) {
      expect(screen.queryByText(removed)).not.toBeInTheDocument();
    }
  });

  it("starts the current topic without naming it", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    vi.mocked(continueStudySession).mockResolvedValue(session);
    const user = userEvent.setup();
    renderHome(true);

    await user.click(await screen.findByRole("button", { name: "Başla" }));

    expect(vi.mocked(continueStudySession)).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        `/session/${session.sessionId}`,
      ),
    );
  });

  it("browses adjacent topics on the home surface without starting work", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    const user = userEvent.setup();
    renderHome();

    await screen.findByRole("heading", { name: "Hayvanlar" });
    expect(
      screen.getByRole("button", {
        name: "Önceki konu: Teknoloji ve Medya",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Sonraki konu: Renkler" }),
    ).toBeEnabled();

    await user.click(
      screen.getByRole("button", { name: "Sonraki konu: Renkler" }),
    );

    expect(
      screen.getByRole("heading", { name: "Renkler" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Önceki konu: Hayvanlar" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Sonraki konu: Betimlemeler" }),
    ).toBeEnabled();
    expect(vi.mocked(startStudySession)).not.toHaveBeenCalled();
    expect(vi.mocked(continueStudySession)).not.toHaveBeenCalled();
  });

  it("changes the home topic from a separate selection surface without starting work", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    vi.mocked(startStudySession).mockResolvedValue(session);
    const user = userEvent.setup();
    renderHome(true);

    await user.click(
      await screen.findByRole("button", { name: "Tüm Konular" }),
    );

    expect(await screen.findByRole("dialog", { name: "Konu seç" })).toHaveClass(
      "h-[calc(100dvh-2rem)]",
      "sm:h-[min(42rem,calc(100dvh-4rem))]",
    );
    expect(
      await screen.findByRole("heading", { name: "Konu seç" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Konu seçimini kapat" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A1.*3 konu/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("list", { name: "A1 konuları" })).toHaveClass(
      "sm:grid-cols-2",
    );
    expect(
      Array.from(
        screen
          .getByRole("list", { name: "A1 konuları" })
          .querySelectorAll("li"),
      )
        .map((item) => item.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ).toEqual([
      "Teknoloji ve Medya4 / 4 kelime",
      "Hayvanlar3 / 11 kelime",
      "Renkler0 / 10 kelime",
    ]);

    await user.click(
      within(screen.getByRole("dialog", { name: "Konu seç" })).getByRole(
        "button",
        { name: /Renkler/ },
      ),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    expect(
      screen.getByRole("heading", { name: "Renkler" }),
    ).toBeInTheDocument();
    expect(vi.mocked(startStudySession)).not.toHaveBeenCalled();
    expect(vi.mocked(continueStudySession)).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/");

    await user.click(screen.getByRole("button", { name: "Başla" }));

    expect(vi.mocked(startStudySession).mock.calls[0]?.[0]).toEqual({
      mode: "Topic",
      curriculumTopicId: 9,
    });
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        `/session/${session.sessionId}`,
      ),
    );
  });

  it("closes the topic picker when its backdrop is clicked", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    const user = userEvent.setup();
    renderHome();

    await user.click(
      await screen.findByRole("button", { name: "Tüm Konular" }),
    );
    await screen.findByRole("dialog", { name: "Konu seç" });

    const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "Hayvanlar" }),
    ).toBeInTheDocument();
  });

  it("expands another level without collapsing the current level", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    const user = userEvent.setup();
    renderHome();

    await user.click(
      await screen.findByRole("button", { name: "Tüm Konular" }),
    );
    await user.click(screen.getByRole("button", { name: /A2.*1 konu/ }));

    expect(screen.getByRole("button", { name: /A2.*1 konu/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("list", { name: "A2 konuları" })).toHaveTextContent(
      "Betimlemeler",
    );
    expect(
      screen.getByRole("list", { name: "A1 konuları" }),
    ).toBeInTheDocument();
  });

  it("shows every topic in a scrollable catalog without pagination", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue({
      ...overview,
      levels: [
        {
          ...overview.levels[0],
          topics: [
            ...overview.levels[0].topics,
            { ...currentTopic, id: 10, topic: "Days" },
            { ...currentTopic, id: 11, topic: "Months" },
          ],
        },
        overview.levels[1],
      ],
    });
    const user = userEvent.setup();
    renderHome();

    await user.click(
      await screen.findByRole("button", { name: "Tüm Konular" }),
    );

    const topicList = screen.getByRole("list", { name: "A1 konuları" });
    const scrollArea = topicList.closest('[data-slot="scroll-area"]');

    expect(scrollArea).toHaveClass("min-h-0", "flex-1");
    expect(topicList.querySelectorAll("li")).toHaveLength(5);
    expect(
      within(screen.getByRole("dialog", { name: "Konu seç" })).getByRole(
        "button",
        { name: /Günler/ },
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog", { name: "Konu seç" })).getByRole(
        "button",
        { name: /Aylar/ },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Konu sayfaları" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the topic catalog in one column until the desktop breakpoint", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    const user = userEvent.setup();
    renderHome();

    await user.click(
      await screen.findByRole("button", { name: "Tüm Konular" }),
    );

    expect(screen.getByRole("list", { name: "A1 konuları" })).toHaveClass(
      "sm:grid-cols-2",
    );
  });

  it("keeps reinforcement out of the home dashboard", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    renderHome();

    await screen.findByRole("heading", { name: "Hayvanlar" });
    expect(
      screen.queryByRole("button", { name: /Pekiştir/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the primary action labelled as start when work can resume", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue({
      ...overview,
      nextAction: {
        kind: "Resume",
        sessionId: session.sessionId,
        topic: currentTopic,
      },
    });
    renderHome();

    expect(await screen.findByRole("button", { name: "Başla" })).toBeEnabled();
  });

  it("uses the informational device card when another device wins the start race", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    vi.mocked(takeOverStudySession).mockResolvedValue(session);
    vi.mocked(continueStudySession).mockRejectedValue(
      new ApiError(
        "Bu çalışma başka bir cihazda açık.",
        409,
        {},
        "study_session_owned_by_another_device",
      ),
    );
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole("button", { name: "Başla" }));

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Çalışma başka bir cihazda açık");
    expect(notice).toHaveClass("bg-primary-50/70", "border-primary/25");
    expect(
      screen.queryByRole("alert", { name: /Oturum başlatılamadı/ }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Bu cihazdan devam et" }),
    );
    expect(takeOverStudySession).toHaveBeenCalledOnce();
  });

  it("recognizes the device conflict by its code, not by the server's message text", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    // The message is unrelated to the "başka bir cihazda açık" wording a
    // substring match would rely on; only the code identifies the conflict.
    vi.mocked(continueStudySession).mockRejectedValue(
      new ApiError(
        "Şu anda bu işlemi tamamlayamıyoruz.",
        409,
        {},
        "study_session_owned_by_another_device",
      ),
    );
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole("button", { name: "Başla" }));

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(
      screen.queryByRole("alert", { name: /Oturum başlatılamadı/ }),
    ).not.toBeInTheDocument();
  });

  it("falls back to the generic error when a conflict has no recognized code", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue(overview);
    vi.mocked(continueStudySession).mockRejectedValue(
      new ApiError("Devam eden çalışman var.", 409),
    );
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole("button", { name: "Başla" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Oturum başlatılamadı",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("asks before starting a selected topic replaces an active session", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue({
      ...overview,
      nextAction: {
        kind: "Resume",
        sessionId: session.sessionId,
        topic: currentTopic,
      },
    });
    vi.mocked(startStudySession).mockResolvedValue(session);
    const user = userEvent.setup();
    renderHome();

    await user.click(
      await screen.findByRole("button", { name: "Tüm Konular" }),
    );
    await user.click(
      within(screen.getByRole("dialog", { name: "Konu seç" })).getByRole(
        "button",
        { name: /Renkler/ },
      ),
    );

    expect(
      screen.getByRole("heading", { name: "Renkler" }),
    ).toBeInTheDocument();
    expect(vi.mocked(startStudySession)).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Başla" }));

    expect(
      screen.getByRole("heading", { name: "Çalışma değiştirilsin mi?" }),
    ).toBeInTheDocument();
    expect(vi.mocked(startStudySession)).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Konuya geç" }));
    expect(vi.mocked(startStudySession).mock.calls[0]?.[0]).toEqual({
      mode: "Topic",
      curriculumTopicId: 9,
      replaceActiveSession: true,
    });
  });

  it("reports a completed curriculum without offering a topic", async () => {
    vi.mocked(fetchStudyOverview).mockResolvedValue({
      ...overview,
      curriculumTopic: null,
      curriculumCompleted: true,
      nextAction: null,
    });
    renderHome();

    expect(
      await screen.findByRole("heading", { name: "Tüm konuları tamamladın" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Başla" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Pekiştir/ }),
    ).not.toBeInTheDocument();
  });

  it("renders loading and retries an overview error", async () => {
    vi.mocked(fetchStudyOverview)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(overview);
    const user = userEvent.setup();
    renderHome();

    expect(screen.getByLabelText("Study yükleniyor")).toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", { name: /Tekrar dene/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Hayvanlar" }),
    ).toBeInTheDocument();
    expect(fetchStudyOverview).toHaveBeenCalledTimes(2);
  });
});

function renderHome(withLocation = false) {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <StudyHomePage />
                {withLocation ? <LocationProbe /> : null}
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}
