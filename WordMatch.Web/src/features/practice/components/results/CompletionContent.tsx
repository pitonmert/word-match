import { CircleCheck, CircleHelp, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PracticeWordRecord } from "@/features/practice/api/practice";
import {
  PracticeResultColumn,
  type PracticeResultColumn as PracticeResultColumnType,
} from "@/features/practice/components/results/PracticeResultColumn";
import type { PracticeResultCategory } from "@/features/practice/components/results/types";
import { useTabListKeyboardNav } from "@/features/practice/hooks/useTabListKeyboardNav";
import { getPracticeOutcomeLabel } from "@/lib/displayLabels";
import { cn } from "@/lib/utils";

type CompletionContentProps = {
  correctCount: number;
  correctWords: PracticeWordRecord[];
  selectedCategory: PracticeResultCategory;
  unknownCount: number;
  unknownWords: PracticeWordRecord[];
  wrongCount: number;
  wrongAnswers: PracticeWordRecord[];
  onCategoryChange: (category: PracticeResultCategory) => void;
};

export function CompletionContent({
  correctCount,
  correctWords,
  selectedCategory,
  unknownCount,
  unknownWords,
  wrongCount,
  wrongAnswers,
  onCategoryChange,
}: CompletionContentProps) {
  const { containerRef, onKeyDown } = useTabListKeyboardNav<HTMLDivElement>();
  const resultColumns: PracticeResultColumnType[] = [
    {
      value: "correct",
      label: getPracticeOutcomeLabel("Correct"),
      count: correctCount,
      words: correctWords,
    },
    {
      value: "review",
      label: getPracticeOutcomeLabel("Review"),
      count: unknownCount,
      words: unknownWords,
    },
    {
      value: "wrong",
      label: getPracticeOutcomeLabel("Wrong"),
      count: wrongCount,
      words: wrongAnswers,
    },
  ];
  const selectedColumn = resultColumns.find(
    (column) => column.value === selectedCategory,
  )!;

  return (
    <div
      aria-label="Çalışma sonuçları"
      className="grid h-full min-h-0 grid-rows-[2.5rem_minmax(0,1fr)]"
      role="region"
    >
      <div
        ref={containerRef}
        aria-label="Sonuç kategorisi"
        className="grid grid-cols-3"
        role="tablist"
        onKeyDown={onKeyDown}
      >
        {resultColumns.map((column) => {
          const isSelected = column.value === selectedCategory;
          const Icon =
            column.value === "correct"
              ? CircleCheck
              : column.value === "review"
                ? CircleHelp
                : CircleX;

          return (
            <Button
              key={column.value}
              aria-controls="result-list"
              aria-label={`${column.label} ${column.count}`}
              aria-selected={isSelected}
              className={cn(
                "relative h-full min-w-0 gap-1 rounded-none px-1.5 text-muted-foreground shadow-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent hover:bg-transparent hover:text-foreground active:bg-transparent",
                isSelected &&
                  "font-semibold text-foreground hover:text-foreground",
                isSelected && column.value === "correct" && "after:bg-success",
                isSelected && column.value === "review" && "after:bg-warning",
                isSelected && column.value === "wrong" && "after:bg-error",
              )}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              type="button"
              variant="ghost"
              onClick={() => onCategoryChange(column.value)}
            >
              <Icon aria-hidden="true" className="size-3.5" />
              <span className="truncate">{column.label}</span>
              <span className="text-xs leading-4 tabular-nums">
                ({column.count})
              </span>
            </Button>
          );
        })}
      </div>

      <ScrollArea
        key={selectedColumn.value}
        className="min-h-0 *:data-[slot=scroll-area-viewport]:[-webkit-overflow-scrolling:auto]"
      >
        <div
          id="result-list"
          aria-label={`${selectedColumn.label} sonuçları`}
          role="tabpanel"
        >
          <PracticeResultColumn column={selectedColumn} />
        </div>
      </ScrollArea>
    </div>
  );
}
