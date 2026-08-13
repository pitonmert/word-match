/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompactWordFilterPanel } from "@/features/words/filter-panel/CompactWordFilterPanel";
import type {
  WordFilterDefinition,
  WordFilterValues,
} from "@/features/words/filter-panel/WordFilterControls";

afterEach(() => {
  cleanup();
});

const definitions: WordFilterDefinition[] = [
  {
    field: "progress",
    label: "İlerleme",
    options: [
      { label: "Tüm ilerleme durumları", value: "all" },
      { label: "Doğru", value: "correct" },
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

const allValuesUnset: WordFilterValues = {
  level: "all",
  partOfSpeech: "all",
  progress: "all",
  topic: "all",
  verbType: "none",
};

function baseProps() {
  return {
    activeFilterCount: 0,
    children: <span>Arama kutusu</span>,
    definitions,
    isOpen: false,
    values: allValuesUnset,
    onClear: vi.fn(),
    onOpenChange: vi.fn(),
    onValueChange: vi.fn(),
  };
}

describe("CompactWordFilterPanel", () => {
  it("always renders the children alongside the filter trigger", () => {
    render(<CompactWordFilterPanel {...baseProps()} />);

    expect(screen.getByText("Arama kutusu")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kelimeleri filtrele" }),
    ).toBeInTheDocument();
  });

  it("reflects the active filter count in the trigger label", () => {
    render(<CompactWordFilterPanel {...baseProps()} activeFilterCount={2} />);

    expect(
      screen.getByRole("button", {
        name: "Kelimeleri filtrele, 2 etkin filtre",
      }),
    ).toBeInTheDocument();
  });

  it("toggles open state when the trigger is clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CompactWordFilterPanel {...baseProps()} onOpenChange={onOpenChange} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Kelimeleri filtrele" }),
    );

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
  });

  it("shows the active field's options and switches when another field tab is clicked", async () => {
    const user = userEvent.setup();

    render(<CompactWordFilterPanel {...baseProps()} isOpen />);

    expect(screen.getByText("Doğru")).toBeInTheDocument();
    expect(screen.queryByText("A1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Seviye" }));

    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.queryByText("Doğru")).not.toBeInTheDocument();
  });

  it("calls onValueChange when an option is selected", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CompactWordFilterPanel
        {...baseProps()}
        isOpen
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByText("Doğru"));

    expect(onValueChange).toHaveBeenCalledWith("progress", "correct");
  });

  it("only shows the clear-filters action when filters are active", () => {
    const { rerender } = render(
      <CompactWordFilterPanel {...baseProps()} isOpen />,
    );

    expect(
      screen.queryByRole("button", { name: "Filtreleri temizle" }),
    ).not.toBeInTheDocument();

    rerender(
      <CompactWordFilterPanel {...baseProps()} activeFilterCount={1} isOpen />,
    );

    expect(
      screen.getByRole("button", { name: "Filtreleri temizle" }),
    ).toBeInTheDocument();
  });

  it("calls onClear when the clear-filters action is clicked", async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();

    render(
      <CompactWordFilterPanel
        {...baseProps()}
        activeFilterCount={1}
        isOpen
        onClear={onClear}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Filtreleri temizle" }),
    );

    expect(onClear).toHaveBeenCalledOnce();
  });

  it("closes on Escape while open", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CompactWordFilterPanel
        {...baseProps()}
        isOpen
        onOpenChange={onOpenChange}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders only the children when there are no filter definitions", () => {
    render(<CompactWordFilterPanel {...baseProps()} definitions={[]} />);

    expect(screen.getByText("Arama kutusu")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Kelimeleri filtrele" }),
    ).not.toBeInTheDocument();
  });
});
