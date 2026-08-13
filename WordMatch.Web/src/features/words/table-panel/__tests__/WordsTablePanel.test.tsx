/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WordResponse } from "@/features/words/api/words";
import type { WordColumnId } from "@/features/words/filter-panel/wordColumns";
import { WordsTablePanel } from "@/features/words/table-panel/WordsTablePanel";

afterEach(() => {
  cleanup();
});

const words: WordResponse[] = [
  {
    currentOutcome: null,
    english: "apple",
    id: 1,
    isIrregular: false,
    level: "A1",
    partOfSpeech: "Noun",
    pastParticiple: null,
    pastSimple: null,
    topic: "FoodAndDrink",
    turkishTranslations: ["elma"],
  },
];

function baseProps() {
  return {
    currentPage: 1,
    error: null,
    hasVisibleColumns: true,
    isLoading: false,
    pageCount: 1,
    pageSize: 10,
    panelHeight: 400,
    sortDirection: "asc" as const,
    sortField: "id" as const,
    tableHeight: 300,
    tableRef: null,
    totalCount: words.length,
    visibleColumnOrder: ["english"] as WordColumnId[],
    words,
    onPageChange: vi.fn(),
    onRetry: vi.fn(),
    onSort: vi.fn(),
  };
}

describe("WordsTablePanel", () => {
  it("shows a loading state instead of the table while loading", () => {
    render(<WordsTablePanel {...baseProps()} isLoading />);

    expect(screen.getByLabelText("Kelimeler yükleniyor")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the error message and retries on demand", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <WordsTablePanel
        {...baseProps()}
        error="Kelimeler yüklenemedi."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Kelimeler yüklenemedi.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("asks the user to select a column when none are visible", () => {
    render(
      <WordsTablePanel
        {...baseProps()}
        hasVisibleColumns={false}
        visibleColumnOrder={[]}
      />,
    );

    expect(
      screen.getByText("Lütfen en az bir sütun seçin."),
    ).toBeInTheDocument();
  });

  it("shows an empty-results message when no words match the filters", () => {
    render(<WordsTablePanel {...baseProps()} totalCount={0} words={[]} />);

    expect(
      screen.getByText("Geçerli filtrelerle eşleşen kelime bulunamadı."),
    ).toBeInTheDocument();
  });

  it("renders the table and footer once loaded successfully", () => {
    render(<WordsTablePanel {...baseProps()} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("apple")).toBeInTheDocument();
    expect(screen.getByText("1 kelime")).toBeInTheDocument();
  });
});
