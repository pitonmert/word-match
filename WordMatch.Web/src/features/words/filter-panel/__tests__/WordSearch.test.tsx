/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WordSearch } from "@/features/words/filter-panel/WordSearch";

afterEach(() => {
  cleanup();
});

describe("WordSearch", () => {
  it("renders the current search value", () => {
    render(<WordSearch search="apple" onSearchChange={vi.fn()} />);

    expect(screen.getByLabelText("Kelime ara")).toHaveValue("apple");
  });

  it("calls onSearchChange as the user types", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();

    render(<WordSearch search="" onSearchChange={onSearchChange} />);

    await user.type(screen.getByLabelText("Kelime ara"), "go");

    expect(onSearchChange).toHaveBeenCalledWith("g");
    expect(onSearchChange).toHaveBeenCalledWith("o");
  });

  it("only shows the clear button when there is a search value", () => {
    const { rerender } = render(
      <WordSearch search="" onSearchChange={vi.fn()} />,
    );

    expect(
      screen.queryByRole("button", { name: "Aramayı temizle" }),
    ).not.toBeInTheDocument();

    rerender(<WordSearch search="apple" onSearchChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Aramayı temizle" }),
    ).toBeInTheDocument();
  });

  it("clears the search when the clear button is clicked", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();

    render(<WordSearch search="apple" onSearchChange={onSearchChange} />);

    await user.click(screen.getByRole("button", { name: "Aramayı temizle" }));

    expect(onSearchChange).toHaveBeenCalledWith("");
  });
});
