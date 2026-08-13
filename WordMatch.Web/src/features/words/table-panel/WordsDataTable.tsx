import type { Ref } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { WordResponse } from "@/features/words/api/words";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  wordColumnDefinitions,
  type WordColumnId,
} from "@/features/words/filter-panel/wordColumns";
import type { SortDirection, WordSortField } from "@/features/words/wordList";
import { getPartOfSpeechLabel, getTopicLabel } from "@/lib/displayLabels";
import { cn } from "@/lib/utils";

export const wordSortFieldByColumn: Partial<
  Record<WordColumnId, WordSortField>
> = {
  english: "english",
  turkishTranslations: "turkishTranslations",
  partOfSpeech: "partOfSpeech",
  pastSimple: "pastSimple",
  pastParticiple: "pastParticiple",
  isIrregular: "isIrregular",
  level: "level",
  topic: "topic",
};

type WordsDataTableProps = {
  currentPage: number;
  pageSize: number;
  sortDirection: SortDirection;
  sortField: WordSortField;
  tableRef: Ref<HTMLTableElement>;
  visibleColumnOrder: WordColumnId[];
  words: WordResponse[];
  onSort: (field: WordSortField) => void;
};

export function WordsDataTable({
  currentPage,
  pageSize,
  sortDirection,
  sortField,
  tableRef,
  visibleColumnOrder,
  words,
  onSort,
}: WordsDataTableProps) {
  return (
    <Table ref={tableRef} className="w-max min-w-full table-auto">
      <TableHeader className="type-table-head bg-muted uppercase">
        <TableRow className="h-10 hover:bg-transparent">
          {visibleColumnOrder.map((column) => (
            <WordTableHeading
              key={column}
              column={column}
              sortDirection={sortDirection}
              sortField={sortField}
              onSort={onSort}
            />
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {words.map((word, index) => {
          const rowNumber = (currentPage - 1) * pageSize + index + 1;

          return (
            <TableRow key={word.id} className="h-10">
              {visibleColumnOrder.map((column) => (
                <WordTableCell
                  key={column}
                  column={column}
                  rowNumber={rowNumber}
                  word={word}
                />
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

type WordTableHeadingProps = {
  column: WordColumnId;
  sortField: WordSortField;
  sortDirection: SortDirection;
  onSort: (field: WordSortField) => void;
};

function WordTableHeading({
  column,
  sortField,
  sortDirection,
  onSort,
}: WordTableHeadingProps) {
  const field = wordSortFieldByColumn[column];
  const label = getWordColumnLabel(column);
  const isSorted = field === sortField;
  const nextDirection =
    isSorted && sortDirection === "asc" ? "azalan" : "artan";

  return (
    <TableHead
      aria-sort={
        field
          ? isSorted
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : "none"
          : undefined
      }
      className="animate-in bg-muted p-0 duration-360 fade-in motion-reduce:animate-none"
      data-column-id={column}
    >
      {field ? (
        <Button
          aria-label={`${label} sütununu ${nextDirection} sırala`}
          className={cn(
            "type-table-head h-10 w-full min-w-max rounded-none px-2 uppercase lg:px-3",
            getWordColumnHeadingClassName(column),
            isSorted && "text-foreground",
          )}
          size="sm"
          title={`${label} sütununu ${nextDirection} sırala`}
          type="button"
          variant="ghost"
          onClick={() => onSort(field)}
        >
          <span
            className="inline-flex items-center gap-1"
            data-column-animation={column}
          >
            <span>{label}</span>
            {isSorted ? (
              sortDirection === "asc" ? (
                <ArrowUp />
              ) : (
                <ArrowDown />
              )
            ) : (
              <ArrowUpDown className="text-muted-foreground" />
            )}
          </span>
        </Button>
      ) : (
        <div
          className={cn(
            "flex h-10 items-center px-2 lg:px-3",
            getWordColumnHeadingClassName(column),
          )}
        >
          <span className="inline-block" data-column-animation={column}>
            #
          </span>
        </div>
      )}
    </TableHead>
  );
}

type WordTableCellProps = {
  column: WordColumnId;
  rowNumber: number;
  word: WordResponse;
};

function WordTableCell({ column, rowNumber, word }: WordTableCellProps) {
  return (
    <TableCell
      className={cn(
        "animate-in px-2 duration-360 fade-in motion-reduce:animate-none lg:px-3",
        getWordColumnCellClassName(column),
      )}
      data-column-id={column}
    >
      <span
        className="inline-block whitespace-nowrap"
        data-column-animation={column}
      >
        {getWordColumnValue(column, word, rowNumber)}
      </span>
    </TableCell>
  );
}

function getWordColumnLabel(column: WordColumnId) {
  return (
    wordColumnDefinitions.find((definition) => definition.id === column)
      ?.label ?? column
  );
}

function getWordColumnHeadingClassName(column: WordColumnId) {
  if (column === "rowNumber") {
    return "justify-center text-center lg:justify-end lg:text-right";
  }

  if (
    column === "partOfSpeech" ||
    column === "pastSimple" ||
    column === "pastParticiple" ||
    column === "isIrregular" ||
    column === "level"
  ) {
    return "justify-center text-center";
  }

  return "justify-center text-center lg:justify-start lg:text-left";
}

function getWordColumnCellClassName(column: WordColumnId) {
  switch (column) {
    case "rowNumber":
      return "text-center text-muted-foreground tabular-nums lg:text-right";
    case "english":
      return "text-center font-medium lg:text-left";
    case "turkishTranslations":
      return "text-center lg:text-left";
    case "partOfSpeech":
      return "text-center";
    case "pastSimple":
      return "text-center";
    case "pastParticiple":
      return "text-center";
    case "isIrregular":
      return "text-center";
    case "level":
      return "text-center";
    case "topic":
      return "text-center lg:text-left";
  }
}

function getWordColumnValue(
  column: WordColumnId,
  word: WordResponse,
  rowNumber: number,
) {
  switch (column) {
    case "rowNumber":
      return rowNumber;
    case "english":
      return word.english;
    case "turkishTranslations":
      return word.turkishTranslations.join(", ");
    case "partOfSpeech":
      return getPartOfSpeechLabel(word.partOfSpeech);
    case "pastSimple":
      return word.pastSimple ?? "—";
    case "pastParticiple":
      return word.pastParticiple ?? "—";
    case "isIrregular":
      return word.isIrregular ? "Evet" : "Hayır";
    case "level":
      return word.level;
    case "topic":
      return getTopicLabel(word.topic);
  }
}
