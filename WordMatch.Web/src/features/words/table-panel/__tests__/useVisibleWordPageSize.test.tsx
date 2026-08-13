/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVisibleWordPageSize } from "@/features/words/table-panel/useVisibleWordPageSize";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useVisibleWordPageSize", () => {
  it("starts measuring when the table area mounts after loading", async () => {
    let containerHeight = 361;
    let notifyResize = () => {};
    const observedSlots: string[] = [];

    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.slot === "word-table-capacity"
          ? containerHeight
          : 0;
      },
    );

    class TestResizeObserver {
      readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        if (target instanceof HTMLElement && target.dataset.slot) {
          observedSlots.push(target.dataset.slot);
        }
        notifyResize = () =>
          this.callback(
            [{ target } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        notifyResize();
      }

      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    const user = userEvent.setup();

    render(<PageSizeHarness />);

    expect(screen.getByText("20 rows")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mount table" }));

    expect(await screen.findByText("8 rows")).toBeInTheDocument();
    expect(screen.getByText("1 unused pixels")).toBeInTheDocument();
    expect(observedSlots).toEqual(
      expect.arrayContaining([
        "word-table-capacity",
        "table",
        "word-list-footer",
      ]),
    );

    containerHeight = 281;
    act(() => notifyResize());

    expect(await screen.findByText("6 rows")).toBeInTheDocument();
    expect(screen.getByText("1 unused pixels")).toBeInTheDocument();
  });
});

function PageSizeHarness() {
  const [showTable, setShowTable] = useState(false);
  const [tableCapacity, setTableCapacity] = useState<HTMLDivElement | null>(
    null,
  );
  const { pageSize, unusedHeight } = useVisibleWordPageSize(
    tableCapacity,
    0,
    1,
  );

  return (
    <>
      <button type="button" onClick={() => setShowTable(true)}>
        Mount table
      </button>
      <p>{pageSize} rows</p>
      <p>{unusedHeight} unused pixels</p>
      {showTable && (
        <div ref={setTableCapacity} data-slot="word-table-capacity">
          <div data-slot="table-container">
            <table data-slot="table">
              <thead>
                <tr>
                  <th>Word</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>apple</td>
                </tr>
              </tbody>
            </table>
          </div>
          <footer data-slot="word-list-footer" />
        </div>
      )}
    </>
  );
}
