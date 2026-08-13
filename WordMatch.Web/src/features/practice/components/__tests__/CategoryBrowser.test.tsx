/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CategoryOption,
  LevelCategory,
} from "@/features/practice/api/categories";
import { CategoryBrowser } from "@/features/practice/components/CategoryBrowser";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

const inProgressCategory: CategoryOption = {
  completedQuestionCount: 3,
  label: "Animals",
  modes: [
    {
      completedQuestionCount: 3,
      mode: "Mixed",
      totalQuestionCount: 10,
    },
  ],
  status: "InProgress",
  totalQuestionCount: 10,
  value: "Animals",
  wordCount: 20,
};

const availableCategory: CategoryOption = {
  completedQuestionCount: 0,
  label: "FoodAndDrink",
  modes: [],
  status: "Available",
  totalQuestionCount: 8,
  value: "FoodAndDrink",
  wordCount: 15,
};

const completedCategory: CategoryOption = {
  completedQuestionCount: 5,
  label: "Colors",
  modes: [],
  status: "Completed",
  totalQuestionCount: 5,
  value: "Colors",
  wordCount: 5,
};

const activeReplayCategory: CategoryOption = {
  completedQuestionCount: 0,
  label: "Days",
  modes: [
    {
      activeAnsweredCount: 2,
      activeSessionId: "session-1",
      activeTotalCount: 6,
      completedQuestionCount: 0,
      isReplay: true,
      mode: "TurkishToEnglish",
      totalQuestionCount: 6,
    },
  ],
  status: "Available",
  totalQuestionCount: 6,
  value: "Days",
  wordCount: 7,
};

const level: LevelCategory = {
  label: "A1",
  topics: [
    inProgressCategory,
    availableCategory,
    completedCategory,
    activeReplayCategory,
  ],
  value: "A1",
  wordCount: 47,
};

describe("CategoryBrowser", () => {
  it("defaults to the in-progress tab when nothing is stored", () => {
    render(<CategoryBrowser level={level} onStart={vi.fn()} />);

    expect(screen.getByRole("tab", { name: /Devam Eden/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("restores the previously selected tab from sessionStorage", () => {
    window.sessionStorage.setItem("word-match-category-status", "completed");

    render(<CategoryBrowser level={level} onStart={vi.fn()} />);

    expect(screen.getByRole("tab", { name: /Tamamlanan/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows category counts per tab and groups active sessions into in-progress", () => {
    render(<CategoryBrowser level={level} onStart={vi.fn()} />);

    expect(
      screen.getByRole("tab", { name: "Devam Eden(2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Kullanılabilir(1)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Tamamlanan(1)" }),
    ).toBeInTheDocument();
  });

  it("switches the visible list and persists the choice when a tab is clicked", async () => {
    const user = userEvent.setup();

    render(<CategoryBrowser level={level} onStart={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /Tamamlanan/ }));

    expect(screen.getByText("Renkler")).toBeInTheDocument();
    expect(screen.queryByText("Hayvanlar")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("word-match-category-status")).toBe(
      "completed",
    );
  });

  it("shows an empty state when a bucket has no categories", async () => {
    const emptyLevel: LevelCategory = {
      ...level,
      topics: [inProgressCategory],
    };
    const user = userEvent.setup();

    render(<CategoryBrowser level={emptyLevel} onStart={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /Tamamlanan/ }));

    expect(screen.getByText("Kategori bulunmuyor.")).toBeInTheDocument();
  });

  it("calls onStart with the level value and category when a row is clicked", async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();

    render(<CategoryBrowser level={level} onStart={onStart} />);

    await user.click(screen.getByRole("button", { name: /Hayvanlar/ }));

    expect(onStart).toHaveBeenCalledWith("A1", inProgressCategory);
  });

  it("shows replay progress with the correct accessible progress values", () => {
    render(<CategoryBrowser level={level} onStart={vi.fn()} />);

    const progressBar = screen.getByRole("progressbar", {
      name: "Günler çalışma ilerlemesi",
    });
    expect(progressBar).toHaveAttribute("aria-valuenow", "2");
    expect(progressBar).toHaveAttribute("aria-valuemax", "6");
    expect(screen.getByText("Tekrar 2/6 soru")).toBeInTheDocument();
  });
});
