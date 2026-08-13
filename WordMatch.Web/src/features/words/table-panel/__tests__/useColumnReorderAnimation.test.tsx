/** @vitest-environment jsdom */

import { useRef, useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type WordColumnId,
  type WordColumnVisibility,
} from "@/features/words/filter-panel/wordColumns";
import { useColumnReorderAnimation } from "@/features/words/table-panel/useColumnReorderAnimation";

const visibleColumns: WordColumnVisibility = {
  rowNumber: true,
  english: true,
  turkishTranslations: true,
  partOfSpeech: true,
  pastSimple: true,
  pastParticiple: true,
  isIrregular: true,
  level: true,
  topic: true,
};

let positions = new Map<WordColumnId, number>();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useColumnReorderAnimation", () => {
  it("animates the headers and cells that moved after a column reorder", () => {
    positions = new Map([
      ["english", 0],
      ["turkishTranslations", 120],
    ]);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const column = this.dataset.columnId as WordColumnId | undefined;
        const left = column ? (positions.get(column) ?? 0) : 0;

        return {
          bottom: 0,
          height: 0,
          left,
          right: left,
          top: 0,
          width: 0,
          x: left,
          y: 0,
          toJSON: () => ({}),
        };
      },
    );
    const cancel = vi.fn();
    const animate = vi
      .fn<HTMLElement["animate"]>()
      .mockReturnValue({ cancel } as unknown as Animation);
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });

    render(<ColumnReorderHarness />);

    act(() => {
      screen.getByRole("button", { name: "Sütunları sırala" }).click();
    });

    expect(animate).toHaveBeenCalledTimes(4);
    expect(animate).toHaveBeenCalledWith(
      [{ transform: "translateX(-120px)" }, { transform: "translateX(0)" }],
      expect.objectContaining({ duration: 360 }),
    );
    expect(animate).toHaveBeenCalledWith(
      [{ transform: "translateX(120px)" }, { transform: "translateX(0)" }],
      expect.objectContaining({ duration: 360 }),
    );
  });

  it("does not animate when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const animate = vi.fn<HTMLElement["animate"]>();
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });

    render(<ColumnReorderHarness />);

    act(() => {
      screen.getByRole("button", { name: "Sütunları sırala" }).click();
    });

    expect(animate).not.toHaveBeenCalled();
  });
});

function ColumnReorderHarness() {
  const [columnOrder, setColumnOrder] = useState<WordColumnId[]>([
    "english",
    "turkishTranslations",
  ]);
  const tableRef = useRef<HTMLTableElement>(null);
  const { captureColumnLayout } = useColumnReorderAnimation(
    tableRef,
    columnOrder,
    visibleColumns,
  );

  const reorderColumns = () => {
    captureColumnLayout();
    positions = new Map([
      ["english", 120],
      ["turkishTranslations", 0],
    ]);
    setColumnOrder(["turkishTranslations", "english"]);
  };

  return (
    <>
      <button type="button" onClick={reorderColumns}>
        Sütunları sırala
      </button>
      <table ref={tableRef}>
        <thead>
          <tr>
            {columnOrder.map((column) => (
              <th key={column} data-column-id={column}>
                <span data-column-animation={column}>{column}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columnOrder.map((column) => (
              <td key={column} data-column-id={column}>
                <span data-column-animation={column}>{column}</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </>
  );
}
