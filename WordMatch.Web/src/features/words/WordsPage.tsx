import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ListChevronsDownUp, ListChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  filterPanelActionButtonClassName,
  filterPanelIconButtonClassName,
  filterPanelTooltipDelay,
} from "@/features/words/filter-panel/filterPanelStyles";
import {
  WordFilterControls,
  type WordFilterDefinition,
  type WordFilterField,
  type WordFilterSectionVisibility,
  type WordFilterValues,
} from "@/features/words/filter-panel/WordFilterControls";
import { CompactWordFilterPanel } from "@/features/words/filter-panel/CompactWordFilterPanel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  compactWordColumnVisibility,
  initialWordColumnOrder,
  initialWordColumnVisibility,
  wordColumnDefinitions,
  WordColumnsTrigger,
  type WordColumnId,
} from "@/features/words/filter-panel/wordColumns";
import {
  getUniqueValues,
  getVisibleWords,
  type SortDirection,
  type WordListFilters,
  type WordSortField,
} from "@/features/words/wordList";
import { useCloseOnEscape } from "@/features/words/hooks/useCloseOnEscape";
import { useIsCompactLayout } from "@/features/words/hooks/useIsCompactLayout";
import { useColumnReorderAnimation } from "@/features/words/table-panel/useColumnReorderAnimation";
import {
  useVisibleWordPageSize,
  wordListFooterHeight,
} from "@/features/words/table-panel/useVisibleWordPageSize";
import { useWords } from "@/features/words/hooks/useWords";
import { WordSearch } from "@/features/words/filter-panel/WordSearch";
import { wordSortFieldByColumn } from "@/features/words/table-panel/WordsDataTable";
import { WordsTablePanel } from "@/features/words/table-panel/WordsTablePanel";
import { getPartOfSpeechLabel, getTopicLabel } from "@/lib/displayLabels";

const WordColumnsPanel = lazy(() =>
  import("@/features/words/filter-panel/WordColumnsPanel").then((module) => ({
    default: module.WordColumnsPanel,
  })),
);

const initialFilters: WordListFilters = {
  search: "",
  level: "all",
  topic: "all",
  partOfSpeech: "all",
  progress: "all",
  verbType: "none",
};

const initialFilterSectionVisibility: WordFilterSectionVisibility = {
  progress: true,
  partOfSpeech: true,
  verbType: true,
  level: true,
  topic: true,
};

const regularVerbHiddenColumns = [
  "pastSimple",
  "pastParticiple",
  "isIrregular",
] as const satisfies readonly WordColumnId[];

export default function WordsPage() {
  const { words, isLoading, error, retry } = useWords();
  const isCompactLayout = useIsCompactLayout();
  const [tableCapacity, setTableCapacity] = useState<HTMLDivElement | null>(
    null,
  );
  const [filters, setFilters] = useState(initialFilters);
  const [sortField, setSortField] = useState<WordSortField>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [columnVisibility, setColumnVisibility] = useState(() => ({
    ...(isCompactLayout
      ? compactWordColumnVisibility
      : initialWordColumnVisibility),
  }));
  const [columnOrder, setColumnOrder] = useState<WordColumnId[]>([
    ...initialWordColumnOrder,
  ]);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [filterSectionVisibility, setFilterSectionVisibility] = useState(
    initialFilterSectionVisibility,
  );
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const [isCompactFiltersOpen, setIsCompactFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  const levels = useMemo(() => getUniqueValues(words, "level"), [words]);
  const topics = useMemo(() => getUniqueValues(words, "topic"), [words]);
  const partsOfSpeech = useMemo(
    () => getUniqueValues(words, "partOfSpeech"),
    [words],
  );
  const visibleWords = useMemo(
    () => getVisibleWords(words, filters, sortField, sortDirection),
    [filters, sortDirection, sortField, words],
  );
  const visibleColumnCount =
    Object.values(columnVisibility).filter(Boolean).length;
  const hasVisibleColumns = visibleColumnCount > 0;
  const visibleColumnOrder = columnOrder.filter(
    (column) => columnVisibility[column],
  );
  const { footerHeight, pageSize, tableHeight, unusedHeight } =
    useVisibleWordPageSize(
      tableCapacity,
      wordListFooterHeight,
      `${visibleWords.length}:${visibleColumnOrder.join(",")}`,
    );
  const previousPageSize = useRef(pageSize);
  const filterDefinitions = useMemo<WordFilterDefinition[]>(
    () => [
      {
        field: "progress",
        label: "Son çalışma sonucu",
        options: [
          { value: "all", label: "Tümü" },
          { value: "correct", label: "Doğru" },
          { value: "review", label: "Tekrar" },
          { value: "wrong", label: "Yanlış" },
          { value: "notPracticed", label: "Çalışılmadı" },
        ],
      },
      {
        field: "partOfSpeech",
        label: "Sözcük Türü",
        options: createFilterOptions(
          "Tüm sözcük türleri",
          partsOfSpeech,
          getPartOfSpeechLabel,
        ),
      },
      {
        field: "verbType",
        label: "Fiil Türü",
        options: [
          { value: "regular", label: "Düzenli fiiller" },
          { value: "irregular", label: "Düzensiz fiiller" },
        ],
      },
      {
        field: "level",
        label: "Seviye",
        options: createFilterOptions("Tüm seviyeler", levels),
      },
      {
        field: "topic",
        label: "Konu",
        options: createFilterOptions("Tüm konular", topics, getTopicLabel),
      },
    ],
    [levels, partsOfSpeech, topics],
  );
  const filterValues: WordFilterValues = {
    progress: filters.progress,
    partOfSpeech: filters.partOfSpeech,
    verbType: filters.verbType,
    level: filters.level,
    topic: filters.topic,
  };
  const activeFilterCount = Object.values(filterValues).filter(
    (value) => value !== "all" && value !== "none",
  ).length;
  const areAllFilterSectionsOpen = Object.values(filterSectionVisibility).every(
    Boolean,
  );
  const pageCount = Math.ceil(visibleWords.length / pageSize);
  const currentPage = Math.min(page, Math.max(pageCount, 1));
  const panelHeight = tableHeight + footerHeight;
  const contentOffset = !isLoading && !error ? unusedHeight / 2 : 0;
  const paginatedWords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visibleWords.slice(start, start + pageSize);
  }, [currentPage, pageSize, visibleWords]);

  useEffect(() => {
    if (previousPageSize.current === pageSize) return;

    setPage((current) => {
      const firstVisibleIndex = (current - 1) * previousPageSize.current;
      return Math.floor(firstVisibleIndex / pageSize) + 1;
    });
    previousPageSize.current = pageSize;
  }, [pageSize]);

  useCloseOnEscape(isColumnsOpen, () => setIsColumnsOpen(false));

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const { captureColumnLayout } = useColumnReorderAnimation(
    tableRef,
    columnOrder,
    columnVisibility,
  );

  const handleSort = (field: WordSortField) => {
    setPage(1);

    if (field === sortField) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const handleFilterChange = (field: WordFilterField, value: string) => {
    setPage(1);

    if (field === "verbType") {
      const verbType = value as WordListFilters["verbType"];

      setFilters((current) => ({
        ...current,
        partOfSpeech: "Verb",
        verbType,
      }));
      updateVerbColumnVisibility(verbType);
      return;
    }

    if (field === "partOfSpeech") {
      const keepsVerbType = value === "Verb";

      setFilters((current) => ({
        ...current,
        partOfSpeech: value,
        verbType: keepsVerbType ? current.verbType : "none",
      }));

      if (!keepsVerbType && filters.verbType === "regular") {
        updateVerbColumnVisibility("none");
      }
      return;
    }

    setFilters((current) => ({ ...current, [field]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters((current) => ({
      ...current,
      level: "all",
      topic: "all",
      partOfSpeech: "all",
      progress: "all",
      verbType: "none",
    }));
    updateVerbColumnVisibility("none");
  };

  const handleSearchChange = (search: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, search }));
  };

  const handleColumnVisibilityChangeMany = (
    columns: readonly WordColumnId[],
    isVisible: boolean,
  ) => {
    captureColumnLayout();
    setColumnVisibility((current) => {
      const next = { ...current };

      columns.forEach((column) => {
        next[column] = isVisible;
      });

      return next;
    });

    if (
      !isVisible &&
      columns.some((column) => wordSortFieldByColumn[column] === sortField)
    ) {
      setPage(1);
      setSortField("id");
      setSortDirection("asc");
    }
  };

  const handleColumnVisibilityChange = (
    column: WordColumnId,
    isVisible: boolean,
  ) => {
    handleColumnVisibilityChangeMany([column], isVisible);
  };

  const handleColumnOrderChange = (nextColumnOrder: WordColumnId[]) => {
    captureColumnLayout();
    setColumnOrder(nextColumnOrder);
  };

  const handleResetColumns = () => {
    const defaultVisibility = isCompactLayout
      ? compactWordColumnVisibility
      : initialWordColumnVisibility;
    const sortedColumn = wordColumnDefinitions.find(
      (column) => wordSortFieldByColumn[column.id] === sortField,
    )?.id;

    captureColumnLayout();
    setColumnOrder([...initialWordColumnOrder]);
    setColumnVisibility({ ...defaultVisibility });

    if (sortedColumn && !defaultVisibility[sortedColumn]) {
      setPage(1);
      setSortField("id");
      setSortDirection("asc");
    }
  };

  const updateVerbColumnVisibility = (
    verbType: WordListFilters["verbType"],
  ) => {
    const isVisible = verbType === "irregular";

    captureColumnLayout();
    setColumnVisibility((current) => ({
      ...current,
      pastSimple: isVisible,
      pastParticiple: isVisible,
      isIrregular: isVisible,
    }));

    if (
      !isVisible &&
      regularVerbHiddenColumns.some(
        (column) => wordSortFieldByColumn[column] === sortField,
      )
    ) {
      setSortField("id");
      setSortDirection("asc");
    }
  };

  const excludedColumns =
    filters.verbType === "regular" ? regularVerbHiddenColumns : undefined;
  const toggleColumns = () => {
    const nextIsOpen = !isColumnsOpen;

    setIsColumnsOpen(nextIsOpen);
    if (nextIsOpen) setIsCompactFiltersOpen(false);
  };
  const filterSectionToggleLabel = areAllFilterSectionsOpen
    ? "Tüm filtreleri daralt"
    : "Tüm filtreleri genişlet";
  const FilterSectionToggleIcon = areAllFilterSectionsOpen
    ? ListChevronsDownUp
    : ListChevronsUpDown;

  const toggleAllFilterSections = () => {
    const isOpen = !areAllFilterSectionsOpen;

    setFilterSectionVisibility({
      progress: isOpen,
      partOfSpeech: isOpen,
      verbType: isOpen,
      level: isOpen,
      topic: isOpen,
    });
  };

  return (
    <main className="h-full overflow-hidden overscroll-none">
      <h1 ref={titleRef} className="sr-only" tabIndex={-1}>
        Kelimeler
      </h1>
      <section className="mx-auto flex size-full min-h-0 max-w-[1600px] p-4 sm:p-6">
        <div
          className="grid size-full min-h-0 items-stretch gap-4 transition-transform duration-200 ease-out sm:gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]"
          data-slot="words-layout"
          style={
            contentOffset > 0
              ? { transform: `translateY(${contentOffset}px)` }
              : undefined
          }
        >
          {!isCompactLayout && (
            <aside className="min-h-0">
              <Card
                className="max-h-full min-h-0 gap-0 overflow-hidden py-0"
                style={{ height: panelHeight }}
              >
                <div className="flex shrink-0 gap-2 border-b p-3">
                  <WordSearch
                    className="min-w-0 flex-1"
                    search={filters.search}
                    onSearchChange={handleSearchChange}
                  />
                  <div className="flex shrink-0 gap-1">
                    <WordColumnsTrigger
                      controls="desktop-columns-panel"
                      excludedColumns={excludedColumns}
                      isOpen={isColumnsOpen}
                      visibility={columnVisibility}
                      onClick={toggleColumns}
                    />
                    <Tooltip>
                      <TooltipTrigger
                        delay={filterPanelTooltipDelay}
                        render={
                          <Button
                            aria-label={filterSectionToggleLabel}
                            className={filterPanelIconButtonClassName}
                            size="icon"
                            type="button"
                            variant="outline"
                            onClick={toggleAllFilterSections}
                          />
                        }
                      >
                        <FilterSectionToggleIcon />
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {filterSectionToggleLabel}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                {isColumnsOpen ? (
                  <Suspense
                    fallback={
                      <div className="min-h-0 flex-1 p-3">
                        <Skeleton className="size-full" />
                      </div>
                    }
                  >
                    <WordColumnsPanel
                      className="min-h-0 flex-1"
                      columnOrder={columnOrder}
                      excludedColumns={excludedColumns}
                      id="desktop-columns-panel"
                      visibility={columnVisibility}
                      onOrderChange={handleColumnOrderChange}
                      onReset={handleResetColumns}
                      onVisibilityChange={handleColumnVisibilityChange}
                      onVisibilityChangeMany={handleColumnVisibilityChangeMany}
                    />
                  </Suspense>
                ) : (
                  <ScrollArea className="min-h-0 flex-1 *:data-[slot=scroll-area-viewport]:overscroll-none">
                    <div className="p-3" data-word-filter-content>
                      <WordFilterControls
                        definitions={filterDefinitions}
                        sectionVisibility={filterSectionVisibility}
                        values={filterValues}
                        onSectionVisibilityChange={(field, isOpen) =>
                          setFilterSectionVisibility((current) => ({
                            ...current,
                            [field]: isOpen,
                          }))
                        }
                        onValueChange={handleFilterChange}
                      />
                    </div>
                  </ScrollArea>
                )}
                {activeFilterCount > 0 && (
                  <div className="shrink-0 border-t bg-muted p-3">
                    <Button
                      className={filterPanelActionButtonClassName}
                      type="button"
                      variant="outline"
                      onClick={clearFilters}
                    >
                      Filtreleri temizle
                    </Button>
                  </div>
                )}
              </Card>
            </aside>
          )}

          <div className="flex min-h-0 min-w-0 flex-col">
            {isCompactLayout && (
              <>
                <CompactWordFilterPanel
                  activeFilterCount={activeFilterCount}
                  definitions={filterDefinitions}
                  isOpen={isCompactFiltersOpen}
                  values={filterValues}
                  onClear={clearFilters}
                  onOpenChange={(isOpen) => {
                    setIsCompactFiltersOpen(isOpen);
                    if (isOpen) setIsColumnsOpen(false);
                  }}
                  onValueChange={handleFilterChange}
                  trailingAction={
                    <WordColumnsTrigger
                      controls="compact-columns-panel"
                      excludedColumns={excludedColumns}
                      isOpen={isColumnsOpen}
                      visibility={columnVisibility}
                      onClick={toggleColumns}
                    />
                  }
                >
                  <WordSearch
                    className="min-w-0 flex-1"
                    search={filters.search}
                    onSearchChange={handleSearchChange}
                  />
                </CompactWordFilterPanel>
                <Collapsible
                  className="-mt-2 mb-2 min-w-0"
                  open={isColumnsOpen}
                  onOpenChange={setIsColumnsOpen}
                >
                  <CollapsibleContent className="overflow-hidden transition-[height,opacity] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0">
                    <Suspense
                      fallback={
                        <Skeleton className="h-64 max-h-[calc(100svh-11rem)] rounded-lg" />
                      }
                    >
                      <WordColumnsPanel
                        className="h-64 max-h-[calc(100svh-11rem)] rounded-lg border"
                        columnOrder={columnOrder}
                        excludedColumns={excludedColumns}
                        id="compact-columns-panel"
                        visibility={columnVisibility}
                        onOrderChange={handleColumnOrderChange}
                        onReset={handleResetColumns}
                        onVisibilityChange={handleColumnVisibilityChange}
                        onVisibilityChangeMany={
                          handleColumnVisibilityChangeMany
                        }
                      />
                    </Suspense>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            <div ref={setTableCapacity} className="min-h-0 flex-1">
              <WordsTablePanel
                currentPage={currentPage}
                error={error}
                hasVisibleColumns={hasVisibleColumns}
                isLoading={isLoading}
                pageCount={pageCount}
                pageSize={pageSize}
                panelHeight={panelHeight}
                sortDirection={sortDirection}
                sortField={sortField}
                tableHeight={tableHeight}
                tableRef={tableRef}
                totalCount={visibleWords.length}
                visibleColumnOrder={visibleColumnOrder}
                words={paginatedWords}
                onPageChange={setPage}
                onRetry={retry}
                onSort={handleSort}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function createFilterOptions(
  allLabel: string,
  values: string[],
  formatValue: (value: string) => string = (value) => value,
) {
  return [
    { value: "all", label: allLabel },
    ...values.map((value) => ({
      value,
      label: formatValue(value),
    })),
  ];
}
