import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  filterPanelIconButtonActiveClassName,
  filterPanelIconButtonClassName,
  filterPanelTooltipDelay,
} from "@/features/words/filter-panel/filterPanelStyles";
import { cn } from "@/lib/utils";

export const wordColumnDefinitions = [
  { id: "rowNumber", label: "Sıra numarası" },
  { id: "english", label: "İngilizce" },
  { id: "turkishTranslations", label: "Türkçe" },
  { id: "partOfSpeech", label: "Sözcük Türü" },
  { id: "pastSimple", label: "Fiilin 2. Hâli" },
  { id: "pastParticiple", label: "Fiilin 3. Hâli" },
  { id: "isIrregular", label: "Düzensiz" },
  { id: "level", label: "Seviye" },
  { id: "topic", label: "Konu" },
] as const;

export type WordColumnId = (typeof wordColumnDefinitions)[number]["id"];
export type WordColumnVisibility = Record<WordColumnId, boolean>;
export const initialWordColumnOrder = wordColumnDefinitions.map(
  (column) => column.id,
);

export const initialWordColumnVisibility: WordColumnVisibility = {
  rowNumber: true,
  english: true,
  turkishTranslations: true,
  partOfSpeech: true,
  pastSimple: false,
  pastParticiple: false,
  isIrregular: false,
  level: true,
  topic: true,
};

export const compactWordColumnVisibility: WordColumnVisibility = {
  rowNumber: false,
  english: true,
  turkishTranslations: true,
  partOfSpeech: false,
  pastSimple: false,
  pastParticiple: false,
  isIrregular: false,
  level: true,
  topic: false,
};

export type WordColumnsProps = {
  excludedColumns?: readonly WordColumnId[];
  visibility: WordColumnVisibility;
  onVisibilityChange: (column: WordColumnId, isVisible: boolean) => void;
  onVisibilityChangeMany: (
    columns: readonly WordColumnId[],
    isVisible: boolean,
  ) => void;
};

type WordColumnsTriggerProps = Pick<
  WordColumnsProps,
  "excludedColumns" | "visibility"
> & {
  controls: string;
  isOpen: boolean;
  onClick: () => void;
};

export function WordColumnsTrigger({
  controls,
  excludedColumns = [],
  isOpen,
  visibility,
  onClick,
}: WordColumnsTriggerProps) {
  const availableColumns = getAvailableColumns(excludedColumns);
  const visibleCount = availableColumns.filter(
    (column) => visibility[column.id],
  ).length;

  return (
    <Tooltip>
      <TooltipTrigger
        delay={filterPanelTooltipDelay}
        render={
          <Button
            aria-controls={controls}
            aria-expanded={isOpen}
            aria-label={`Görünür sütunları seçin, ${availableColumns.length} sütundan ${visibleCount} tanesi gösteriliyor`}
            className={cn(
              filterPanelIconButtonClassName,
              visibleCount !== availableColumns.length && "text-primary",
              isOpen && filterPanelIconButtonActiveClassName,
            )}
            size="icon"
            type="button"
            variant="outline"
            onClick={onClick}
          />
        }
      >
        <Columns3 />
      </TooltipTrigger>
      <TooltipContent side="bottom">Sütunlar</TooltipContent>
    </Tooltip>
  );
}

export function reorderColumnSubset(
  columnOrder: readonly WordColumnId[],
  movableColumns: readonly WordColumnId[],
  fromIndex: number,
  toIndex: number,
) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= movableColumns.length ||
    toIndex >= movableColumns.length
  ) {
    return [...columnOrder];
  }

  const reorderedColumns = [...movableColumns];
  const [movedColumn] = reorderedColumns.splice(fromIndex, 1);

  reorderedColumns.splice(toIndex, 0, movedColumn);
  let reorderedIndex = 0;

  return columnOrder.map((column) =>
    movableColumns.includes(column)
      ? reorderedColumns[reorderedIndex++]
      : column,
  );
}

export function getAvailableColumns(
  excludedColumns: readonly WordColumnId[],
  columnOrder: readonly WordColumnId[] = initialWordColumnOrder,
) {
  return columnOrder
    .filter((column) => !excludedColumns.includes(column))
    .map((column) =>
      wordColumnDefinitions.find((definition) => definition.id === column)!,
    );
}
