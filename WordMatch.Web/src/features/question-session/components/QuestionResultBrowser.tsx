import { useId, useLayoutEffect, useRef, useState, type Ref } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  QuestionResultCategory,
  QuestionResultRecord,
} from "@/features/question-session/types";
import { useTabListKeyboardNav } from "@/features/question-session/hooks/useTabListKeyboardNav";
import { cn } from "@/lib/utils";

type ResultColumn = {
  value: QuestionResultCategory;
  label: string;
  records: QuestionResultRecord[];
};

const categoryColors = {
  correct: {
    text: "text-success hover:text-success disabled:text-success",
    indicator: "bg-success",
  },
  review: {
    text: "text-warning hover:text-warning disabled:text-warning",
    indicator: "bg-warning",
  },
  wrong: {
    text: "text-error hover:text-error disabled:text-error",
    indicator: "bg-error",
  },
} satisfies Record<QuestionResultCategory, { text: string; indicator: string }>;

export function QuestionResultBrowser({
  ref,
  disabled = false,
  correctRecords,
  layout = "constrained",
  reviewLabel = "Bilmiyorum",
  reviewRecords,
  selectedCategory,
  wrongLabel = "Yanlış",
  wrongRecords,
  onCategoryChange,
}: {
  ref?: Ref<HTMLDivElement>;
  disabled?: boolean;
  correctRecords?: QuestionResultRecord[];
  layout?: "constrained" | "content";
  reviewLabel?: string;
  reviewRecords: QuestionResultRecord[];
  selectedCategory: QuestionResultCategory;
  wrongLabel?: string;
  wrongRecords: QuestionResultRecord[];
  onCategoryChange: (category: QuestionResultCategory) => void;
}) {
  const { containerRef, onKeyDown } = useTabListKeyboardNav<HTMLDivElement>();
  const id = useId();
  const carouselRef = useRef<HTMLDivElement>(null);
  const contentRefs = useRef<
    Partial<Record<QuestionResultCategory, HTMLElement | null>>
  >({});
  const positioned = useRef(false);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [scrollProgress, setScrollProgress] = useState<number | null>(null);
  const columns: ResultColumn[] = [
    ...(correctRecords
      ? [{ value: "correct" as const, label: "Doğru", records: correctRecords }]
      : []),
    { value: "review", label: reviewLabel, records: reviewRecords },
    { value: "wrong", label: wrongLabel, records: wrongRecords },
  ];
  const selectedIndex = Math.max(
    0,
    columns.findIndex((column) => column.value === selectedCategory),
  );
  const selectedRecordCount = columns[selectedIndex].records.length;
  // Match the fixed row and spacing tokens before the first DOM measurement.
  const initialContentHeight =
    selectedRecordCount > 0
      ? `calc(${selectedRecordCount} * var(--result-row-height) + ${selectedRecordCount + 1} * var(--result-spacing))`
      : "3rem";
  const listHeight =
    contentHeight === null ? initialContentHeight : `${contentHeight}px`;

  const isSummary = correctRecords !== undefined;

  useLayoutEffect(() => {
    const carousel = carouselRef.current;
    const content = contentRefs.current[selectedCategory];
    if (!carousel || !content) return;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    carousel.scrollTo?.({
      left: selectedIndex * carousel.clientWidth,
      behavior: positioned.current && !reducedMotion ? "smooth" : "instant",
    });
    positioned.current = true;
    const viewport = content.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    viewport?.scrollTo?.({ top: 0 });

    let width = carousel.clientWidth;
    const updateSize = () => {
      setContentHeight(content.getBoundingClientRect().height);
      if (viewport) {
        // Fade over the final 48px of vertical overflow, following the height animation.
        const overflow = Math.max(
          0,
          viewport.scrollHeight - viewport.clientHeight,
        );
        viewport.parentElement?.style.setProperty(
          "--result-scrollbar-opacity",
          String(Math.min(1, overflow / 48)),
        );
      }
      if (carousel.clientWidth !== width) {
        width = carousel.clientWidth;
        carousel.scrollTo?.({
          left: selectedIndex * width,
          behavior: "instant",
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(content);
    observer.observe(carousel);
    if (viewport) observer.observe(viewport);
    return () => observer.disconnect();
  }, [layout, selectedCategory, selectedIndex]);
  const results = (
    <ScrollArea
      scrollbarProps={{
        keepMounted: true,
        className:
          "pointer-events-none opacity-(--result-scrollbar-opacity) data-has-overflow-y:pointer-events-auto",
      }}
      className={cn(
        "min-h-0 [--result-scrollbar-opacity:0] *:data-[slot=scroll-area-viewport]:overscroll-x-auto *:data-[slot=scroll-area-viewport]:[-webkit-overflow-scrolling:auto]",
        layout === "content" &&
          "overflow-hidden transition-[height] duration-280 ease-in-out motion-reduce:transition-none",
      )}
      style={
        layout === "content"
          ? {
              // Four complete rows, three gaps, and equal top/bottom padding.
              height: `min(${listHeight}, var(--result-viewport-height))`,
            }
          : undefined
      }
    >
      <div
        ref={carouselRef}
        aria-label="Sonuç listeleri"
        className="flex snap-x snap-mandatory scrollbar-none items-start overflow-hidden transition-[height] duration-280 ease-in-out motion-reduce:transition-none pointer-coarse:overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ height: listHeight }}
        onScroll={(event) => {
          if (event.target !== event.currentTarget) return;
          const { scrollLeft, clientWidth } = event.currentTarget;
          if (clientWidth > 0) {
            setScrollProgress(
              Math.max(
                0,
                Math.min(columns.length - 1, scrollLeft / clientWidth),
              ),
            );
          }
        }}
        onScrollEnd={(event) => {
          if (event.target !== event.currentTarget) return;
          const { scrollLeft, clientWidth } = event.currentTarget;
          if (clientWidth <= 0) return;
          const index = Math.max(
            0,
            Math.min(columns.length - 1, Math.round(scrollLeft / clientWidth)),
          );
          const category = columns[index].value;
          if (category !== selectedCategory) onCategoryChange(category);
        }}
      >
        {columns.map((column) => (
          <section
            key={column.value}
            aria-hidden={column.value !== selectedCategory}
            inert={column.value !== selectedCategory}
            className="w-full min-w-0 shrink-0 snap-start"
            ref={(element) => {
              contentRefs.current[column.value] = element;
            }}
            id={`${id}-${column.value}-panel`}
            aria-label={`${column.label} sonuçları`}
            role="tabpanel"
            tabIndex={0}
          >
            {column.records.length === 0 ? (
              <p className="type-helper p-[1rem_0.25rem_1rem] text-center">
                Gözden geçirilecek cevap yok.
              </p>
            ) : (
              <ul className="flex flex-col gap-(--result-spacing) py-(--result-spacing)">
                {column.records.map((record) => (
                  <li
                    key={record.key}
                    className="grid h-(--result-row-height) shrink-0 grid-rows-[1rem_1rem] gap-1.5 overflow-hidden px-3 text-center text-xs/4 sm:px-4"
                  >
                    <div className="flex min-w-0 items-center justify-center gap-2">
                      <span className="max-w-[70%] truncate font-medium text-foreground">
                        {record.prompt}
                      </span>
                      <span className="shrink-0 text-[0.6875rem] leading-none text-muted-foreground">
                        {record.formatLabel}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center justify-center gap-1.5">
                      {column.value === "wrong" && record.selectedAnswer ? (
                        <>
                          <span className="min-w-0 truncate text-error line-through">
                            {record.selectedAnswer}
                          </span>
                          <ArrowRight
                            aria-hidden="true"
                            className="size-3.5 shrink-0 text-muted-foreground"
                          />
                          <span className="min-w-0 truncate text-success">
                            {record.correctAnswer}
                          </span>
                        </>
                      ) : (
                        <span className="truncate text-muted-foreground">
                          {record.correctAnswer}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </ScrollArea>
  );
  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-label="Çalışma sonuçları"
      className={cn(
        "grid min-h-0 gap-2 outline-none [--result-row-height:2.375rem] [--result-spacing:1rem] [--result-viewport-height:calc(4*var(--result-row-height)+5*var(--result-spacing))]",
        layout === "content"
          ? "max-h-full grid-rows-[auto_minmax(0,1fr)]"
          : "h-full grid-rows-[auto_minmax(0,1fr)]",
      )}
      style={
        isSummary && layout === "content"
          ? { gridTemplateRows: "auto var(--result-viewport-height)" }
          : undefined
      }
      role="region"
    >
      <div
        aria-label={isSummary ? "Oturum özeti" : undefined}
        role={isSummary ? "group" : undefined}
      >
        <div
          ref={containerRef}
          aria-label="Sonuç kategorisi"
          className={cn(
            "relative grid p-1",
            correctRecords ? "grid-cols-3" : "grid-cols-2",
            !isSummary && "mx-3 mt-3",
          )}
          role="tablist"
          onKeyDown={onKeyDown}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-1 h-0.5"
            style={{
              width: `calc((100% - 0.5rem) / ${columns.length})`,
              transform: `translateX(${(scrollProgress ?? selectedIndex) * 100}%)`,
            }}
          >
            <span
              className={cn(
                "mx-6 block h-full rounded-full transition-colors duration-280 motion-reduce:transition-none",
                categoryColors[selectedCategory].indicator,
              )}
            />
          </span>
          {columns.map((column) => {
            const isSelected = column.value === selectedCategory;

            return (
              <Button
                key={column.value}
                id={`${id}-${column.value}-tab`}
                aria-controls={`${id}-${column.value}-panel`}
                aria-label={`${column.label} ${column.records.length}`}
                aria-selected={isSelected}
                className={cn(
                  "relative min-w-0 gap-2 rounded-md shadow-none transition-colors duration-280 hover:bg-transparent active:bg-transparent motion-reduce:transition-none",
                  categoryColors[column.value].text,
                  isSummary && "h-auto flex-col gap-1 px-1 py-2",
                  "disabled:bg-transparent",
                )}
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => onCategoryChange(column.value)}
              >
                <span
                  className={cn(
                    "truncate",
                    isSummary && "order-last text-xs/4 font-normal",
                  )}
                >
                  {column.label}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "tabular-nums",
                    isSummary ? "text-2xl/8 font-semibold" : "text-xs/4",
                  )}
                >
                  {column.records.length}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
      {results}
    </div>
  );
}
