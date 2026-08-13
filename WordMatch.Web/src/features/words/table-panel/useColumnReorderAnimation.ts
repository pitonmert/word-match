import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type {
  WordColumnId,
  WordColumnVisibility,
} from "@/features/words/filter-panel/wordColumns";

const columnTransitionDuration = 360;

export function useColumnReorderAnimation(
  tableRef: RefObject<HTMLTableElement | null>,
  columnOrder: readonly WordColumnId[],
  columnVisibility: WordColumnVisibility,
) {
  const previousColumnPositions = useRef<Map<WordColumnId, number> | null>(
    null,
  );
  const columnAnimations = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    const previousPositions = previousColumnPositions.current;
    const table = tableRef.current;

    previousColumnPositions.current = null;
    if (!previousPositions || !table || prefersReducedMotion()) return;

    const animations: Animation[] = [];
    const currentPositions = getColumnHeaderPositions(table);
    const columnOffsets = new Map<WordColumnId, number>();

    previousPositions.forEach((previousLeft, column) => {
      const currentLeft = currentPositions.get(column);

      if (currentLeft === undefined) return;

      const offsetX = previousLeft - currentLeft;

      if (Math.abs(offsetX) >= 0.5) columnOffsets.set(column, offsetX);
    });

    table
      .querySelectorAll<HTMLElement>("[data-column-animation]")
      .forEach((element) => {
        const column = element.dataset.columnAnimation as
          WordColumnId | undefined;
        const offsetX = column ? columnOffsets.get(column) : undefined;

        if (offsetX === undefined || typeof element.animate !== "function") {
          return;
        }

        animations.push(
          element.animate(
            [
              { transform: `translateX(${offsetX}px)` },
              { transform: "translateX(0)" },
            ],
            {
              duration: columnTransitionDuration,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            },
          ),
        );
      });

    columnAnimations.current = animations;
  }, [columnOrder, columnVisibility]);

  useEffect(
    () => () => {
      columnAnimations.current.forEach((animation) => animation.cancel());
    },
    [],
  );

  const captureColumnLayout = () => {
    const table = tableRef.current;

    if (!table || prefersReducedMotion()) {
      previousColumnPositions.current = null;
      return;
    }

    columnAnimations.current.forEach((animation) => animation.cancel());
    columnAnimations.current = [];
    previousColumnPositions.current = getColumnHeaderPositions(table);
  };

  return { captureColumnLayout };
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getColumnHeaderPositions(table: HTMLTableElement) {
  const positions = new Map<WordColumnId, number>();

  table
    .querySelectorAll<HTMLElement>("thead [data-column-id]")
    .forEach((header) => {
      const column = header.dataset.columnId as WordColumnId | undefined;

      if (column) positions.set(column, header.getBoundingClientRect().left);
    });

  return positions;
}
