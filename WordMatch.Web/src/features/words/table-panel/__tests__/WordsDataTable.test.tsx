/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WordResponse } from "@/features/words/api/words";
import type { WordColumnId } from "@/features/words/filter-panel/wordColumns";
import { WordsDataTable } from "@/features/words/table-panel/WordsDataTable";

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
  {
    currentOutcome: null,
    english: "go",
    id: 2,
    isIrregular: true,
    level: "A1",
    partOfSpeech: "Verb",
    pastParticiple: "gone",
    pastSimple: "went",
    topic: "Actions",
    turkishTranslations: ["gitmek", "yürümek"],
  },
];

const allColumns: WordColumnId[] = [
  "rowNumber",
  "english",
  "turkishTranslations",
  "partOfSpeech",
  "pastSimple",
  "pastParticiple",
  "isIrregular",
  "level",
  "topic",
];

describe("WordsDataTable", () => {
  it("numbers rows relative to the current page", () => {
    render(
      <WordsDataTable
        currentPage={2}
        pageSize={10}
        sortDirection="asc"
        sortField="id"
        tableRef={null}
        visibleColumnOrder={["rowNumber", "english"]}
        words={words}
        onSort={vi.fn()}
      />,
    );

    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders the row-number header as plain text, not a button", () => {
    render(
      <WordsDataTable
        currentPage={1}
        pageSize={10}
        sortDirection="asc"
        sortField="id"
        tableRef={null}
        visibleColumnOrder={["rowNumber"]}
        words={words}
        onSort={vi.fn()}
      />,
    );

    expect(screen.getByText("#")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onSort with the mapped field when a sortable header is clicked", async () => {
    const onSort = vi.fn();
    const user = userEvent.setup();

    render(
      <WordsDataTable
        currentPage={1}
        pageSize={10}
        sortDirection="asc"
        sortField="id"
        tableRef={null}
        visibleColumnOrder={["english"]}
        words={words}
        onSort={onSort}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "İngilizce sütununu artan sırala" }),
    );

    expect(onSort).toHaveBeenCalledWith("english");
  });

  it("reflects the current sort state via aria-sort", () => {
    const { rerender } = render(
      <WordsDataTable
        currentPage={1}
        pageSize={10}
        sortDirection="asc"
        sortField="id"
        tableRef={null}
        visibleColumnOrder={["english"]}
        words={words}
        onSort={vi.fn()}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: "İngilizce sütununu artan sırala" })
        .closest("th"),
    ).toHaveAttribute("aria-sort", "none");

    rerender(
      <WordsDataTable
        currentPage={1}
        pageSize={10}
        sortDirection="asc"
        sortField="english"
        tableRef={null}
        visibleColumnOrder={["english"]}
        words={words}
        onSort={vi.fn()}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: "İngilizce sütununu azalan sırala" })
        .closest("th"),
    ).toHaveAttribute("aria-sort", "ascending");

    rerender(
      <WordsDataTable
        currentPage={1}
        pageSize={10}
        sortDirection="desc"
        sortField="english"
        tableRef={null}
        visibleColumnOrder={["english"]}
        words={words}
        onSort={vi.fn()}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: "İngilizce sütununu artan sırala" })
        .closest("th"),
    ).toHaveAttribute("aria-sort", "descending");
  });

  it("formats cell values for each column", () => {
    render(
      <WordsDataTable
        currentPage={1}
        pageSize={10}
        sortDirection="asc"
        sortField="id"
        tableRef={null}
        visibleColumnOrder={allColumns}
        words={words}
        onSort={vi.fn()}
      />,
    );

    expect(screen.getByText("elma")).toBeInTheDocument();
    expect(screen.getByText("gitmek, yürümek")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("went")).toBeInTheDocument();
    expect(screen.getByText("gone")).toBeInTheDocument();
    expect(screen.getByText("Evet")).toBeInTheDocument();
    expect(screen.getByText("Hayır")).toBeInTheDocument();
    expect(screen.getByText("İsim")).toBeInTheDocument();
    expect(screen.getByText("Fiil")).toBeInTheDocument();
    expect(screen.getByText("Yiyecek ve İçecek")).toBeInTheDocument();
    expect(screen.getByText("Eylemler")).toBeInTheDocument();
  });

  it("only renders the columns included in visibleColumnOrder", () => {
    render(
      <WordsDataTable
        currentPage={1}
        pageSize={10}
        sortDirection="asc"
        sortField="id"
        tableRef={null}
        visibleColumnOrder={["english"]}
        words={words}
        onSort={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("columnheader")).toHaveLength(1);
    expect(screen.queryByText("Seviye")).not.toBeInTheDocument();
  });
});
