/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WordResponse } from "@/features/words/api/words";
import WordsPage from "@/features/words/WordsPage";
import {
  getVisibleWordPageSize,
  wordListFooterHeight,
} from "@/features/words/table-panel/useVisibleWordPageSize";
import { createTestQueryClient } from "@/test/createTestQueryClient";

function renderWordsPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <WordsPage />
    </QueryClientProvider>,
  );
}

const words: WordResponse[] = [
  {
    id: 1,
    english: "apple",
    turkishTranslations: ["elma", "alma"],
    partOfSpeech: "Noun",
    pastSimple: null,
    pastParticiple: null,
    isIrregular: false,
    level: "A1",
    topic: "FoodAndDrink",
    currentOutcome: null,
  },
  {
    id: 2,
    english: "go",
    turkishTranslations: ["gitmek"],
    partOfSpeech: "Verb",
    pastSimple: "went",
    pastParticiple: "gone",
    isIrregular: true,
    level: "A1",
    topic: "Actions",
    currentOutcome: null,
  },
  {
    id: 3,
    english: "beautiful",
    turkishTranslations: ["güzel"],
    partOfSpeech: "Adjective",
    pastSimple: null,
    pastParticiple: null,
    isIrregular: false,
    level: "A2",
    topic: "Descriptions",
    currentOutcome: null,
  },
];

const paginatedWords: WordResponse[] = Array.from(
  { length: 41 },
  (_, index) => ({
    id: index + 101,
    english: `word-${index + 1}`,
    turkishTranslations: [`kelime-${index + 1}`],
    partOfSpeech: "Noun",
    pastSimple: null,
    pastParticiple: null,
    isIrregular: false,
    level: "A1",
    topic: "General",
    currentOutcome: null,
  }),
);

const verbWords: WordResponse[] = [
  ...words,
  {
    id: 4,
    english: "walk",
    turkishTranslations: ["yürümek"],
    partOfSpeech: "Verb",
    pastSimple: "walked",
    pastParticiple: "walked",
    isIrregular: false,
    level: "A1",
    topic: "Actions",
    currentOutcome: null,
  },
];

const topicWords: WordResponse[] = [
  "Actions",
  "Animals",
  "BodyAndHealth",
  "CalendarAndTime",
  "Colors",
  "Education",
].map((topic, index) => ({
  id: index + 1,
  english: `topic-word-${index + 1}`,
  turkishTranslations: [`konu-${index + 1}`],
  partOfSpeech: "Noun",
  pastSimple: null,
  pastParticiple: null,
  isIrregular: false,
  level: "A1",
  topic,
  currentOutcome: null,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1024,
  });
});

describe("WordsPage", () => {
  it("renders loading and then every word field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );

    renderWordsPage();

    expect(screen.getByText("Kelimeler yükleniyor...")).toBeInTheDocument();
    const loadingCard = screen
      .getByText("Kelimeler yükleniyor...")
      .closest<HTMLElement>('[data-slot="card"]');
    const loadingCardHeight = loadingCard?.style.height;

    expect(await screen.findByText("apple")).toBeInTheDocument();
    expect(
      screen.getByRole("table").closest<HTMLElement>('[data-slot="card"]'),
    ).toHaveStyle({ height: loadingCardHeight });
    expect(screen.getByText("elma, alma")).toBeInTheDocument();
    expect(screen.getAllByText("Yiyecek ve İçecek")).toHaveLength(2);
    expect(screen.getByText("3 kelime")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Görünür sütunları seçin, 9 sütundan 6 tanesi gösteriliyor",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Fiilin 2\. Hâli sütununu .* sırala/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "1. sayfaya git" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.queryByRole("button", { name: "Önceki sayfa" }),
    ).not.toBeInTheDocument();
  });

  it("keeps progress indicators out of the word rows", async () => {
    const wordsWithProgress = words.map((word) =>
      word.id === 1
        ? { ...word, currentOutcome: "Wrong" as const }
        : word.id === 2
          ? { ...word, currentOutcome: "Review" as const }
          : word,
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => wordsWithProgress }),
    );

    renderWordsPage();

    await screen.findByText("apple");

    expect(screen.queryByLabelText("Answered incorrectly")).toBeNull();
    expect(screen.queryByLabelText("Marked as unknown")).toBeNull();
    expect(
      screen.queryByLabelText("Previously answered incorrectly"),
    ).toBeNull();
  });

  it("filters words by their practice progress", async () => {
    const wordsWithProgress: WordResponse[] = [
      { ...words[0], currentOutcome: "Wrong" },
      { ...words[1], currentOutcome: "Review" },
      {
        ...words[2],
        currentOutcome: "Correct",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => wordsWithProgress,
      }),
    );
    const user = userEvent.setup();

    renderWordsPage();
    await screen.findByText("apple");

    await user.click(screen.getByRole("radio", { name: "Doğru" }));
    const table = screen.getByRole("table");
    expect(within(table).getByText("beautiful")).toBeInTheDocument();
    expect(within(table).queryByText("apple")).not.toBeInTheDocument();
    expect(within(table).queryByText("go")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Tekrar" }));
    expect(within(table).getByText("go")).toBeInTheDocument();
    expect(within(table).queryByText("beautiful")).not.toBeInTheDocument();
  });

  it("renders an error and retries the request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => words });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderWordsPage();

    expect(
      await screen.findByText("Kelimeler yüklenemedi."),
    ).toBeInTheDocument();
    const errorCard = screen
      .getByText("Kelimeler yüklenemedi.")
      .closest<HTMLElement>('[data-slot="card"]');
    const errorCardHeight = errorCard?.style.height;

    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));

    expect(await screen.findByText("apple")).toBeInTheDocument();
    expect(
      screen.getByRole("table").closest<HTMLElement>('[data-slot="card"]'),
    ).toHaveStyle({ height: errorCardHeight });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renders the empty state when search removes every word", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    const populatedTableHeight = Number.parseFloat(
      screen.getByRole("table").parentElement!.parentElement!.style.height,
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Kelime ara" }),
      "book",
    );

    const emptyMessage = screen.getByText(
      "Geçerli filtrelerle eşleşen kelime bulunamadı.",
    );
    const emptyCard = emptyMessage.closest<HTMLElement>('[data-slot="card"]');

    expect(emptyCard).toHaveStyle({
      height: `${populatedTableHeight + wordListFooterHeight}px`,
    });
    expect(screen.queryByText("0 kelime")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Sayfalama" }),
    ).not.toBeInTheDocument();
  });

  it("calculates the page size from the available table height", () => {
    expect(getVisibleWordPageSize(40)).toBe(1);
    expect(getVisibleWordPageSize(200)).toBe(3);
    expect(getVisibleWordPageSize(881)).toBe(21);
    expect(getVisibleWordPageSize(881, 0, 15)).toBe(20);
    expect(getVisibleWordPageSize(881, 56)).toBe(19);
  });

  it("sorts from column headings in both directions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    const sortButton = screen.getByRole("button", {
      name: "İngilizce sütununu artan sırala",
    });
    await user.click(sortButton);

    expect(getEnglishColumn()).toEqual(["apple", "beautiful", "go"]);
    expect(sortButton.closest("th")).toHaveAttribute("aria-sort", "ascending");

    await user.click(
      screen.getByRole("button", { name: "İngilizce sütununu azalan sırala" }),
    );

    expect(getEnglishColumn()).toEqual(["go", "beautiful", "apple"]);
  });

  it("hides selected columns from the table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    await user.click(
      screen.getByRole("button", { name: /Görünür sütunları seçin/ }),
    );
    const columnsPanel = await screen.findByRole("region", {
      name: "Sütunlar",
    });
    const topicCheckbox = within(columnsPanel).getByRole("checkbox", {
      name: "Konu",
    });

    await user.click(within(columnsPanel).getByText("Konu"));
    expect(topicCheckbox).toHaveAttribute("aria-checked", "true");

    await user.click(topicCheckbox);

    expect(
      screen.queryByRole("button", { name: /Konu sütununu .* sırala/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Yiyecek ve İçecek")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Görünür sütunları seçin, 9 sütundan 5 tanesi gösteriliyor",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Tüm sütunları göster" }),
    ).toHaveAttribute("aria-checked", "mixed");
  });

  it("provides drag handles only inside the columns panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    await user.click(
      screen.getByRole("button", { name: /Görünür sütunları seçin/ }),
    );

    const columnsPanel = await screen.findByRole("region", {
      name: "Sütunlar",
    });

    expect(
      within(columnsPanel).getByRole("button", {
        name: "İngilizce sütununu sürükle",
      }),
    ).toBeInTheDocument();
    expect(
      within(columnsPanel).getByRole("button", {
        name: "İngilizce sütununu sürükle",
      }),
    ).toHaveAttribute("tabindex", "0");
    expect(
      screen.queryByRole("button", { name: "Move English column down" }),
    ).not.toBeInTheDocument();
    expect(
      within(
        screen
          .getByRole("button", {
            name: "İngilizce sütununu artan sırala",
          })
          .closest("th")!,
      ).queryByRole("button", { name: "İngilizce sütununu sürükle" }),
    ).not.toBeInTheDocument();
  });

  it("resets desktop columns to their default visibility and order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    await user.click(
      screen.getByRole("button", { name: /Görünür sütunları seçin/ }),
    );
    const columnsPanel = await screen.findByRole("region", {
      name: "Sütunlar",
    });

    await user.click(
      within(columnsPanel).getByRole("checkbox", { name: "Konu" }),
    );
    expect(
      screen.queryByRole("button", { name: /Konu sütununu .* sırala/ }),
    ).not.toBeInTheDocument();

    await user.click(
      within(columnsPanel).getByRole("button", { name: "Sütunları sıfırla" }),
    );

    expect(
      screen.getByRole("button", { name: /Konu sütununu .* sırala/ }),
    ).toBeInTheDocument();
    expect(
      within(columnsPanel).getByRole("checkbox", { name: "Konu" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("keeps the desktop layout fluid while columns change", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    const layout = document.querySelector<HTMLElement>(
      '[data-slot="words-layout"]',
    );

    expect(layout).toHaveClass("lg:grid-cols-[16rem_minmax(0,1fr)]");
    expect(layout?.style.gridTemplateColumns).toBe("");
    expect(screen.getByRole("table")).toHaveClass(
      "table-auto",
      "w-max",
      "min-w-full",
    );

    await user.click(
      screen.getByRole("button", { name: /Görünür sütunları seçin/ }),
    );
    await user.click(
      await screen.findByRole("checkbox", { name: "Fiilin 2. Hâli" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Fiilin 3. Hâli" }));

    expect(layout?.style.gridTemplateColumns).toBe("");
    expect(
      await screen.findByRole("button", {
        name: /Fiilin 3\. Hâli sütununu .* sırala/,
      }),
    ).toBeInTheDocument();
  });

  it("shows and hides every available column from the master checkbox", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    await user.click(
      screen.getByRole("button", { name: /Görünür sütunları seçin/ }),
    );

    const masterCheckbox = await screen.findByRole("checkbox", {
      name: "Tüm sütunları göster",
    });

    expect(masterCheckbox).toHaveAttribute("aria-checked", "mixed");
    await user.click(masterCheckbox);
    expect(
      screen.getByRole("checkbox", { name: "Tüm sütunları gizle" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      await screen.findByRole("button", {
        name: /Fiilin 2\. Hâli sütununu .* sırala/,
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: "Tüm sütunları gizle" }),
    );

    expect(
      screen.getByText("Lütfen en az bir sütun seçin."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Tüm sütunları göster" }),
    ).toHaveAttribute("aria-checked", "false");

    await user.click(
      screen.getByRole("checkbox", { name: "Tüm sütunları göster" }),
    );

    expect(await screen.findByText("apple")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Tüm sütunları gizle" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("keeps the column menu available when every column is hidden", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    await user.click(
      screen.getByRole("button", { name: /Görünür sütunları seçin/ }),
    );

    await user.click(
      await screen.findByRole("checkbox", { name: "Tüm sütunları göster" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Tüm sütunları gizle" }),
    );

    expect(
      screen.getByText("Lütfen en az bir sütun seçin."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Görünür sütunları seçin, 9 sütundan 0 tanesi gösteriliyor",
      }),
    ).toBeInTheDocument();
  });

  it("paginates words and changes pages from the table footer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => paginatedWords,
      }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    expect(await screen.findByText("word-1")).toBeInTheDocument();
    expect(screen.getByText("word-20")).toBeInTheDocument();
    expect(screen.queryByText("word-21")).not.toBeInTheDocument();
    expect(screen.getByText("41 kelimeden 1-20")).toBeInTheDocument();
    expect(
      within(screen.getByText("word-1").closest("tr")!).getAllByRole("cell")[0],
    ).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "2. sayfaya git" }));

    expect(screen.getByText("word-21")).toBeInTheDocument();
    expect(screen.queryByText("word-20")).not.toBeInTheDocument();
    expect(screen.getByText("41 kelimeden 21-40")).toBeInTheDocument();
    expect(
      within(screen.getByText("word-21").closest("tr")!).getAllByRole(
        "cell",
      )[0],
    ).toHaveTextContent("21");
    expect(
      screen.getByRole("button", { name: "2. sayfaya git" }),
    ).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("button", { name: "3. sayfaya git" }));

    expect(screen.getByText("word-41")).toBeInTheDocument();
    expect(screen.getByText("41 kelimeden 41-41")).toBeInTheDocument();
  });

  it("filters verb types and manages their relevant columns", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => verbWords }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    await user.click(screen.getByRole("radio", { name: "Düzenli fiiller" }));

    expect(screen.getByText("walk")).toBeInTheDocument();
    expect(screen.queryByText("apple")).not.toBeInTheDocument();
    expect(screen.queryByText("go")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Fiil" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.queryByRole("button", {
        name: /Fiilin 2\. Hâli sütununu .* sırala/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Fiilin 3\. Hâli sütununu .* sırala/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Düzensiz sütununu .* sırala/ }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Görünür sütunları seçin/ }),
    );
    await screen.findByRole("region", { name: "Sütunlar" });
    expect(
      screen.queryByRole("checkbox", { name: "Fiilin 2. Hâli" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Fiilin 3. Hâli" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Düzensiz" }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("radio", { name: "İsim" }));

    expect(screen.getByText("apple")).toBeInTheDocument();
    expect(screen.queryByText("walk")).not.toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Düzenli fiiller" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("radio", { name: "Düzensiz fiiller" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.queryByRole("button", {
        name: /Fiilin 2\. Hâli sütununu .* sırala/,
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Fiil" }));

    expect(screen.getByText("go")).toBeInTheDocument();
    expect(screen.getByText("walk")).toBeInTheDocument();
    expect(screen.queryByText("apple")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Fiilin 2\. Hâli sütununu .* sırala/,
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Düzensiz fiiller" }));

    expect(screen.getByText("go")).toBeInTheDocument();
    expect(screen.queryByText("walk")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: /Fiilin 2\. Hâli sütununu .* sırala/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Fiilin 3\. Hâli sütununu .* sırala/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Düzensiz sütununu .* sırala/ }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Görünür sütunları seçin/ }),
    );
    await user.click(
      await screen.findByRole("checkbox", { name: "Fiilin 2. Hâli" }),
    );
    expect(
      screen.queryByRole("button", {
        name: /Fiilin 2\. Hâli sütununu .* sırala/,
      }),
    ).not.toBeInTheDocument();
  });

  it("applies visible filters immediately and preserves search when clearing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    await user.click(screen.getByRole("radio", { name: "A1" }));
    await user.click(screen.getByRole("radio", { name: "Eylemler" }));

    expect(screen.getByText("go")).toBeInTheDocument();
    expect(screen.queryByText("apple")).not.toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: "Kelime ara" }),
      "go",
    );
    await user.click(
      screen.getByRole("button", { name: "Filtreleri temizle" }),
    );

    expect(screen.getByRole("searchbox", { name: "Kelime ara" })).toHaveValue(
      "go",
    );
    expect(screen.getByText("go")).toBeInTheDocument();
    expect(screen.queryByText("apple")).not.toBeInTheDocument();
  });

  it("shows every topic option inside the filter scroll area", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => topicWords }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("topic-word-1");
    expect(screen.getByRole("radio", { name: "Renkler" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Eğitim" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Renkler" }));

    expect(screen.getByText("topic-word-5")).toBeInTheDocument();
    expect(screen.queryByText("topic-word-1")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Renkler" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.queryByRole("button", { name: /(Daha fazla|Daha az) göster/ }),
    ).not.toBeInTheDocument();
  });

  it("collapses filter sections without leaving their options visible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => topicWords }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("topic-word-1");
    await user.click(
      screen.getByRole("button", { name: "Konu filtresini daralt" }),
    );

    expect(
      screen.queryByRole("radio", { name: "Tüm konular" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Daha fazla göster" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Konu filtresini genişlet" }),
    );

    expect(
      screen.getByRole("radio", { name: "Tüm konular" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Eğitim" })).toBeInTheDocument();
  });

  it("expands and collapses every desktop filter section together", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => topicWords }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("topic-word-1");
    await user.click(
      screen.getByRole("button", { name: "Tüm filtreleri daralt" }),
    );

    expect(
      screen.queryByRole("radio", { name: "Tüm sözcük türleri" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "Düzenli fiiller" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "Tüm seviyeler" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "Tüm konular" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Tüm filtreleri genişlet" }),
    );

    expect(
      screen.getByRole("radio", { name: "Tüm sözcük türleri" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Tüm konular" }),
    ).toBeInTheDocument();
  });

  it("opens the compact filter tray and applies its values immediately", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    await user.click(
      screen.getByRole("button", { name: "Kelimeleri filtrele" }),
    );
    const tray = screen.getByRole("region", { name: "Filtreler" });

    await user.click(screen.getByRole("button", { name: "Seviye" }));
    await user.click(within(tray).getByRole("radio", { name: "A2" }));

    expect(screen.getByText("beautiful")).toBeInTheDocument();
    expect(screen.queryByText("apple")).not.toBeInTheDocument();
  });

  it("uses content-sized columns for default and manually selected mobile columns", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    const table = screen.getByRole("table");

    expect(table).toHaveClass("table-auto", "w-max", "min-w-full");
    expect(table).not.toHaveClass("table-fixed");
    expect(
      screen.getByRole("button", {
        name: "Görünür sütunları seçin, 9 sütundan 3 tanesi gösteriliyor",
      }),
    ).toBeInTheDocument();
    const englishHeading = screen.getByRole("button", {
      name: "İngilizce sütununu artan sırala",
    });
    const turkishHeading = screen.getByRole("button", {
      name: "Türkçe sütununu artan sırala",
    });

    expect(englishHeading).toHaveClass("justify-center");
    expect(turkishHeading).toHaveClass("justify-center");
    expect(englishHeading.querySelector("span span")).not.toHaveClass(
      "truncate",
    );
    expect(screen.getByText("apple")).not.toHaveClass("truncate");
    expect(englishHeading.closest("tr")).not.toHaveClass("grid");
    expect(englishHeading.querySelector("svg")).not.toHaveClass("absolute");
    expect(turkishHeading.querySelector("svg")).not.toHaveClass("absolute");
    expect(
      screen.queryByRole("button", { name: /Sözcük Türü sütununu .* sırala/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Konu sütununu .* sırala/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Seviye sütununu artan sırala" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Görünür sütunları seçin/ }),
    );
    const columnsPanel = await screen.findByRole("region", {
      name: "Sütunlar",
    });

    await user.click(
      within(columnsPanel).getByRole("checkbox", { name: "Sözcük Türü" }),
    );
    expect(table).toHaveClass("table-auto", "w-max", "min-w-full");

    await user.click(
      within(columnsPanel).getByRole("button", { name: "Sütunları sıfırla" }),
    );
    expect(
      screen.queryByRole("button", { name: /Sözcük Türü sütununu .* sırala/ }),
    ).not.toBeInTheDocument();

    await user.click(
      within(columnsPanel).getByRole("checkbox", { name: "İngilizce" }),
    );
    await user.click(
      within(columnsPanel).getByRole("checkbox", { name: "Düzensiz" }),
    );

    expect(table).toHaveClass("table-auto", "w-max", "min-w-full");
    expect(
      screen.getByRole("button", { name: "Düzensiz sütununu artan sırala" }),
    ).toHaveClass("justify-center");
  });

  it("opens compact filters and columns in the same disclosure area", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    await user.click(
      screen.getByRole("button", { name: "Kelimeleri filtrele" }),
    );
    expect(
      screen.getByRole("region", { name: "Filtreler" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Görünür sütunları seçin/ }),
    );

    expect(
      screen.queryByRole("region", { name: "Filtreler" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: "Sütunlar" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Görünür sütunları seçin/ }),
    );
    expect(
      screen.queryByRole("region", { name: "Sütunlar" }),
    ).not.toBeInTheDocument();
  });

  it("toggles the compact filter tray with the filter button", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => words }),
    );
    const user = userEvent.setup();

    renderWordsPage();

    await screen.findByText("apple");
    const filterButton = screen.getByRole("button", {
      name: "Kelimeleri filtrele",
    });
    await user.click(filterButton);
    expect(
      screen.getByRole("region", { name: "Filtreler" }),
    ).toBeInTheDocument();
    await user.click(filterButton);

    expect(
      screen.queryByRole("region", { name: "Filtreler" }),
    ).not.toBeInTheDocument();
    expect(filterButton).toHaveFocus();
  });
});

function getEnglishColumn() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[1].textContent);
}
