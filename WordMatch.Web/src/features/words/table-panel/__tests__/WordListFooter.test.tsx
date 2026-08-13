/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WordListFooter } from "@/features/words/table-panel/WordListFooter";

afterEach(() => {
  cleanup();
});

describe("WordListFooter", () => {
  it("shows a plain count and no navigation on a single page", () => {
    render(
      <WordListFooter
        currentPage={1}
        pageCount={1}
        pageSize={10}
        totalCount={7}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText("7 kelime")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Önceki sayfa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sonraki sayfa" }),
    ).not.toBeInTheDocument();
  });

  it("shows a range label and page navigation across multiple pages", () => {
    render(
      <WordListFooter
        currentPage={2}
        pageCount={3}
        pageSize={10}
        totalCount={25}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText("25 kelimeden 11-20")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Önceki sayfa" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sonraki sayfa" })).toBeEnabled();
  });

  it("disables previous on the first page and next on the last page", () => {
    const { rerender } = render(
      <WordListFooter
        currentPage={1}
        pageCount={3}
        pageSize={10}
        totalCount={25}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Önceki sayfa" })).toBeDisabled();

    rerender(
      <WordListFooter
        currentPage={3}
        pageCount={3}
        pageSize={10}
        totalCount={25}
        onPageChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Sonraki sayfa" }),
    ).toBeDisabled();
  });

  it("shows every page number without ellipsis when there are five pages or fewer", () => {
    render(
      <WordListFooter
        currentPage={1}
        pageCount={5}
        pageSize={10}
        totalCount={50}
        onPageChange={vi.fn()}
      />,
    );

    for (const page of [1, 2, 3, 4, 5]) {
      expect(
        screen.getByRole("button", { name: `${page}. sayfaya git` }),
      ).toBeInTheDocument();
    }
  });

  it("collapses distant pages behind an ellipsis and marks the current page", () => {
    render(
      <WordListFooter
        currentPage={5}
        pageCount={10}
        pageSize={10}
        totalCount={100}
        onPageChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "1. sayfaya git" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "5. sayfaya git" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: "10. sayfaya git" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "2. sayfaya git" }),
    ).not.toBeInTheDocument();
  });

  it("calls onPageChange with the target page for navigation controls", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();

    render(
      <WordListFooter
        currentPage={2}
        pageCount={3}
        pageSize={10}
        totalCount={25}
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Önceki sayfa" }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole("button", { name: "3. sayfaya git" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
