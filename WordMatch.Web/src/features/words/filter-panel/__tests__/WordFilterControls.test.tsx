/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isFilterValueActive,
  WordFilterControls,
  type WordFilterDefinition,
  type WordFilterSectionVisibility,
  type WordFilterValues,
} from "@/features/words/filter-panel/WordFilterControls";

afterEach(() => {
  cleanup();
});

const definitions: WordFilterDefinition[] = [
  {
    field: "partOfSpeech",
    label: "Sözcük Türü",
    options: [
      { label: "Tüm sözcük türleri", value: "all" },
      { label: "İsim", value: "Noun" },
    ],
  },
  {
    field: "level",
    label: "Seviye",
    options: [
      { label: "Tüm seviyeler", value: "all" },
      { label: "A1", value: "A1" },
    ],
  },
];

const allSectionsClosed: WordFilterSectionVisibility = {
  level: false,
  partOfSpeech: false,
  topic: false,
  verbType: false,
};

const allValuesUnset: WordFilterValues = {
  level: "all",
  partOfSpeech: "all",
  topic: "all",
  verbType: "none",
};

function baseProps() {
  return {
    definitions,
    sectionVisibility: allSectionsClosed,
    values: allValuesUnset,
    onSectionVisibilityChange: vi.fn(),
    onValueChange: vi.fn(),
  };
}

describe("WordFilterControls", () => {
  it("renders one section per definition with matching aria-expanded state", () => {
    render(
      <WordFilterControls
        {...baseProps()}
        sectionVisibility={{ ...allSectionsClosed, partOfSpeech: true }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Sözcük Türü filtresini daralt" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "Seviye filtresini genişlet" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("calls onSectionVisibilityChange when a section header is toggled", async () => {
    const onSectionVisibilityChange = vi.fn();
    const user = userEvent.setup();

    render(
      <WordFilterControls
        {...baseProps()}
        onSectionVisibilityChange={onSectionVisibilityChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Sözcük Türü filtresini genişlet" }),
    );

    expect(onSectionVisibilityChange).toHaveBeenCalledWith(
      "partOfSpeech",
      true,
    );
  });

  it("only renders options for open sections", () => {
    render(
      <WordFilterControls
        {...baseProps()}
        sectionVisibility={{ ...allSectionsClosed, partOfSpeech: true }}
      />,
    );

    expect(screen.getByText("İsim")).toBeInTheDocument();
    expect(screen.queryByText("A1")).not.toBeInTheDocument();
  });

  it("calls onValueChange when an option is selected", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();

    render(
      <WordFilterControls
        {...baseProps()}
        sectionVisibility={{ ...allSectionsClosed, partOfSpeech: true }}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByText("İsim"));

    expect(onValueChange).toHaveBeenCalledWith("partOfSpeech", "Noun");
  });
});

describe("isFilterValueActive", () => {
  it("treats the 'all' and 'none' sentinels as inactive", () => {
    expect(isFilterValueActive("all")).toBe(false);
    expect(isFilterValueActive("none")).toBe(false);
  });

  it("treats any other value as active", () => {
    expect(isFilterValueActive("correct")).toBe(true);
    expect(isFilterValueActive("A1")).toBe(true);
  });
});
