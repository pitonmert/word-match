import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
} from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Check, GripVertical, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { filterPanelActionButtonClassName } from "@/features/words/filter-panel/filterPanelStyles";
import {
  getAvailableColumns,
  reorderColumnSubset,
  wordColumnDefinitions,
  type WordColumnsProps,
  type WordColumnId,
} from "@/features/words/filter-panel/wordColumns";
import { cn } from "@/lib/utils";

type WordColumnsPanelProps = WordColumnsProps & {
  className?: string;
  columnOrder: readonly WordColumnId[];
  id: string;
  onOrderChange: (columnOrder: WordColumnId[]) => void;
  onReset: () => void;
};

export function WordColumnsPanel({
  className,
  columnOrder,
  excludedColumns = [],
  id,
  visibility,
  onOrderChange,
  onReset,
  onVisibilityChange,
  onVisibilityChangeMany,
}: WordColumnsPanelProps) {
  const availableColumns = getAvailableColumns(excludedColumns, columnOrder);
  const availableColumnIds = availableColumns.map((column) => column.id);
  const visibleCount = availableColumns.filter(
    (column) => visibility[column.id],
  ).length;
  const areAllColumnsVisible = visibleCount === availableColumns.length;
  const areSomeColumnsVisible = visibleCount > 0 && !areAllColumnsVisible;

  const toggleAllColumns = () => {
    onVisibilityChangeMany(availableColumnIds, !areAllColumnsVisible);
  };

  return (
    <section
      aria-label="Sütunlar"
      className={cn("flex min-h-0 flex-col overflow-hidden bg-card", className)}
      id={id}
    >
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <h2 className="type-label text-muted-foreground uppercase">Sütunlar</h2>
        <ColumnCheckbox
          label={
            areAllColumnsVisible
              ? "Tüm sütunları gizle"
              : "Tüm sütunları göster"
          }
          state={areSomeColumnsVisible ? "mixed" : areAllColumnsVisible}
          onClick={toggleAllColumns}
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <DragDropProvider
          sensors={[PointerSensor, KeyboardSensor]}
          onDragEnd={(event) => {
            if (event.canceled || !isSortable(event.operation.source)) return;

            const { initialIndex, index } = event.operation.source;

            if (initialIndex === index) return;

            onOrderChange(
              reorderColumnSubset(
                columnOrder,
                availableColumnIds,
                initialIndex,
                index,
              ),
            );
          }}
        >
          <div className="grid gap-0.5 p-2">
            {availableColumns.map((column, index) => (
              <SortableColumnOption
                key={column.id}
                column={column}
                index={index}
                isVisible={visibility[column.id]}
                onVisibilityChange={onVisibilityChange}
              />
            ))}
          </div>
        </DragDropProvider>
      </ScrollArea>
      <footer className="shrink-0 border-t bg-muted p-3">
        <Button
          className={filterPanelActionButtonClassName}
          type="button"
          variant="outline"
          onClick={onReset}
        >
          Sütunları sıfırla
        </Button>
      </footer>
    </section>
  );
}

type SortableColumnOptionProps = {
  column: (typeof wordColumnDefinitions)[number];
  index: number;
  isVisible: boolean;
  onVisibilityChange: (column: WordColumnId, isVisible: boolean) => void;
};

function SortableColumnOption({
  column,
  index,
  isVisible,
  onVisibilityChange,
}: SortableColumnOptionProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: column.id,
    index,
    group: "column-panel",
    transition: {
      duration: 200,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      idle: true,
    },
  });

  return (
    <div
      ref={ref}
      className={cn(
        "flex min-h-8 items-center transition-opacity duration-200",
        isDragging && "z-10 opacity-60",
      )}
    >
      <div className="mr-2 flex h-7 shrink-0 items-center border-r border-border pr-1">
        <button
          ref={handleRef}
          aria-label={`${column.label} sütununu sürükle`}
          className="inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-disabled-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
          tabIndex={0}
          title={`${column.label} sütununu sürükle`}
          type="button"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
      </div>
      <span className="type-body min-w-0 flex-1 truncate">{column.label}</span>
      <ColumnCheckbox
        className="mr-1 ml-3 shrink-0"
        label={column.label}
        state={isVisible}
        onClick={() => onVisibilityChange(column.id, !isVisible)}
      />
    </div>
  );
}

type ColumnCheckboxProps = {
  className?: string;
  label: string;
  state: boolean | "mixed";
  onClick: () => void;
};

function ColumnCheckbox({
  className,
  label,
  state,
  onClick,
}: ColumnCheckboxProps) {
  const isChecked = state === true;
  const isMixed = state === "mixed";

  return (
    <button
      aria-checked={state}
      aria-label={label}
      className={cn(
        "inline-flex size-5 cursor-pointer items-center justify-center rounded-sm border border-input bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        (isChecked || isMixed) &&
          "border-selected bg-selected text-selected-foreground hover:border-selected hover:bg-selected hover:text-selected-foreground",
        className,
      )}
      role="checkbox"
      type="button"
      onClick={onClick}
    >
      {isMixed ? (
        <Minus aria-hidden="true" className="size-3.5" />
      ) : isChecked ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : null}
    </button>
  );
}
