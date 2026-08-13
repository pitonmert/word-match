import type { Ref } from "react";
import { TriangleAlert } from "lucide-react";
import type { WordResponse } from "@/features/words/api/words";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { WordColumnId } from "@/features/words/filter-panel/wordColumns";
import { WordListFooter } from "@/features/words/table-panel/WordListFooter";
import type { SortDirection, WordSortField } from "@/features/words/wordList";
import { WordsDataTable } from "@/features/words/table-panel/WordsDataTable";

type WordsTablePanelProps = {
  currentPage: number;
  error: string | null;
  hasVisibleColumns: boolean;
  isLoading: boolean;
  pageCount: number;
  pageSize: number;
  panelHeight: number;
  sortDirection: SortDirection;
  sortField: WordSortField;
  tableHeight: number;
  tableRef: Ref<HTMLTableElement>;
  totalCount: number;
  visibleColumnOrder: WordColumnId[];
  words: WordResponse[];
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onSort: (field: WordSortField) => void;
};

export function WordsTablePanel({
  currentPage,
  error,
  hasVisibleColumns,
  isLoading,
  pageCount,
  pageSize,
  panelHeight,
  sortDirection,
  sortField,
  tableHeight,
  tableRef,
  totalCount,
  visibleColumnOrder,
  words,
  onPageChange,
  onRetry,
  onSort,
}: WordsTablePanelProps) {
  return (
    <Card
      className="max-h-full gap-0 overflow-hidden py-0"
      style={{ height: panelHeight }}
    >
      {isLoading ? (
        <WordsLoadingState />
      ) : error ? (
        <div className="flex min-h-0 flex-1 items-start p-4">
          <Alert className="w-full" variant="destructive">
            <TriangleAlert />
            <AlertTitle>Kelimeler kullanılamıyor</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <AlertAction>
              <Button size="sm" type="button" onClick={onRetry}>
                Tekrar dene
              </Button>
            </AlertAction>
          </Alert>
        </div>
      ) : !hasVisibleColumns || totalCount === 0 ? (
        <WordListEmptyState
          message={
            hasVisibleColumns
              ? "Geçerli filtrelerle eşleşen kelime bulunamadı."
              : "Lütfen en az bir sütun seçin."
          }
        />
      ) : (
        <>
          <div
            className="overflow-hidden *:data-[slot=table-container]:h-full *:data-[slot=table-container]:overflow-y-hidden"
            style={{ height: tableHeight }}
          >
            <WordsDataTable
              currentPage={currentPage}
              pageSize={pageSize}
              sortDirection={sortDirection}
              sortField={sortField}
              tableRef={tableRef}
              visibleColumnOrder={visibleColumnOrder}
              words={words}
              onSort={onSort}
            />
          </div>
          <WordListFooter
            currentPage={currentPage}
            pageCount={pageCount}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={onPageChange}
          />
        </>
      )}
    </Card>
  );
}

function WordListEmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center p-4 text-center"
      data-slot="word-list-empty-state"
    >
      <p className="type-body text-muted-foreground">{message}</p>
    </div>
  );
}

function WordsLoadingState() {
  return (
    <div
      aria-label="Kelimeler yükleniyor"
      className="grid min-h-0 flex-1 content-start gap-2 p-4"
      role="status"
    >
      <span className="sr-only">Kelimeler yükleniyor...</span>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}
