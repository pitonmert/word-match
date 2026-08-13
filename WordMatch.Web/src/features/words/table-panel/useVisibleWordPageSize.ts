import { useLayoutEffect, useRef, useState } from "react";

const fallbackPageSize = 20;
const tableHeaderHeight = 40;
const tableRowHeight = 40;
const tableSafetySpace = 1;
export const wordListFooterHeight = 53;

type WordListLayout = {
  footerHeight: number;
  pageSize: number;
  tableHeight: number;
  unusedHeight: number;
};

export function useVisibleWordPageSize(
  capacityContainer: HTMLElement | null,
  footerHeight: number,
  layoutVersion: string | number,
) {
  const horizontalScrollbarHeightRef = useRef(0);
  const [layout, setLayout] = useState<WordListLayout>(() =>
    createWordListLayout(fallbackPageSize, 0, 0, footerHeight),
  );

  useLayoutEffect(() => {
    if (!capacityContainer) return;

    const updateLayout = () => {
      const capacityHeight = capacityContainer.clientHeight;
      if (capacityHeight === 0) return;

      const tableContainer = capacityContainer.querySelector<HTMLElement>(
        '[data-slot="table-container"]',
      );
      const table = capacityContainer.querySelector<HTMLTableElement>(
        '[data-slot="table"]',
      );
      const footer = capacityContainer.querySelector<HTMLElement>(
        '[data-slot="word-list-footer"]',
      );
      const measuredFooterHeight = footer?.offsetHeight || footerHeight;
      const measuredHeaderHeight =
        table?.tHead?.getBoundingClientRect().height || tableHeaderHeight;
      const measuredRowHeight =
        table?.tBodies[0]?.rows[0]?.getBoundingClientRect().height ||
        tableRowHeight;

      if (tableContainer) {
        horizontalScrollbarHeightRef.current = Math.max(
          0,
          tableContainer.offsetHeight - tableContainer.clientHeight,
        );
      }

      const horizontalScrollbarHeight = horizontalScrollbarHeightRef.current;
      const pageSize = getVisibleWordPageSize(
        capacityHeight,
        measuredFooterHeight,
        horizontalScrollbarHeight,
        measuredHeaderHeight,
        measuredRowHeight,
      );

      setLayout((current) => {
        const next = createWordListLayout(
          pageSize,
          horizontalScrollbarHeight,
          capacityHeight - measuredFooterHeight,
          measuredFooterHeight,
          measuredHeaderHeight,
          measuredRowHeight,
        );

        return current.footerHeight === next.footerHeight &&
          current.pageSize === next.pageSize &&
          current.tableHeight === next.tableHeight &&
          current.unusedHeight === next.unusedHeight
          ? current
          : next;
      });
    };

    updateLayout();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateLayout);
      return () => window.removeEventListener("resize", updateLayout);
    }

    const observer = new ResizeObserver(updateLayout);
    observer.observe(capacityContainer);
    const table = capacityContainer.querySelector<HTMLElement>(
      '[data-slot="table"]',
    );
    const footer = capacityContainer.querySelector<HTMLElement>(
      '[data-slot="word-list-footer"]',
    );

    if (table) observer.observe(table);
    if (footer) observer.observe(footer);

    return () => observer.disconnect();
  }, [capacityContainer, footerHeight, layoutVersion]);

  return layout;
}

export function getVisibleWordPageSize(
  capacityHeight: number,
  footerHeight = 0,
  horizontalScrollbarHeight = 0,
  headerHeight = tableHeaderHeight,
  rowHeight = tableRowHeight,
) {
  const availableHeight =
    capacityHeight -
    footerHeight -
    horizontalScrollbarHeight -
    tableSafetySpace;

  return Math.max(1, Math.floor((availableHeight - headerHeight) / rowHeight));
}

function createWordListLayout(
  pageSize: number,
  horizontalScrollbarHeight: number,
  availableTableHeight: number,
  footerHeight: number,
  headerHeight = tableHeaderHeight,
  rowHeight = tableRowHeight,
): WordListLayout {
  const tableHeight =
    headerHeight + pageSize * rowHeight + horizontalScrollbarHeight;

  return {
    footerHeight,
    pageSize,
    tableHeight,
    unusedHeight: Math.max(0, availableTableHeight - tableHeight),
  };
}
