import { ArrowRight, CircleHelp, CircleX } from "lucide-react";
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

export function QuestionResultBrowser({
  reviewLabel = "Bilmiyorum",
  reviewRecords,
  selectedCategory,
  wrongLabel = "Yanlış",
  wrongRecords,
  onCategoryChange,
}: {
  reviewLabel?: string;
  reviewRecords: QuestionResultRecord[];
  selectedCategory: QuestionResultCategory;
  wrongLabel?: string;
  wrongRecords: QuestionResultRecord[];
  onCategoryChange: (category: QuestionResultCategory) => void;
}) {
  const { containerRef, onKeyDown } = useTabListKeyboardNav<HTMLDivElement>();
  const columns: ResultColumn[] = [
    { value: "review", label: reviewLabel, records: reviewRecords },
    { value: "wrong", label: wrongLabel, records: wrongRecords },
  ];
  return (
    <div
      aria-label="Çalışma sonuçları"
      className="grid h-full min-h-0 grid-rows-[2.5rem_minmax(0,1fr)]"
      role="region"
    >
      <div
        ref={containerRef}
        aria-label="Sonuç kategorisi"
        className="grid grid-cols-2"
        role="tablist"
        onKeyDown={onKeyDown}
      >
        {columns.map((column) => {
          const isSelected = column.value === selectedCategory;
          const Icon = column.value === "review" ? CircleHelp : CircleX;

          return (
            <Button
              key={column.value}
              aria-controls="question-result-list"
              aria-label={`${column.label} ${column.records.length}`}
              aria-selected={isSelected}
              className={cn(
                "relative h-full min-w-0 gap-1 rounded-none border-b px-1.5 text-muted-foreground shadow-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent hover:bg-transparent hover:text-foreground active:bg-transparent",
                isSelected &&
                  "font-semibold text-foreground hover:text-foreground",
                isSelected && column.value === "review" && "after:bg-warning",
                isSelected && column.value === "wrong" && "after:bg-error",
              )}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              type="button"
              variant="ghost"
              onClick={() => onCategoryChange(column.value)}
            >
              <Icon aria-hidden="true" />
              <span className="truncate">{column.label}</span>
              <span className="text-xs leading-4 tabular-nums">
                ({column.records.length})
              </span>
            </Button>
          );
        })}
      </div>

      <ScrollArea className="min-h-0 *:data-[slot=scroll-area-viewport]:[-webkit-overflow-scrolling:auto]">
        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2">
          {columns.map((column) => (
            <div
              key={column.value}
              className={cn(
                "min-w-0",
                column.value === "review" && "sm:col-start-1",
                column.value === "wrong" && "sm:col-start-2",
                column.value !== selectedCategory && "hidden",
              )}
            >
              {column.value === selectedCategory ? (
                <section
                  id="question-result-list"
                  aria-label={`${column.label} sonuçları`}
                  role="tabpanel"
                >
                  {column.records.length === 0 ? (
                    <p className="type-helper p-[1rem_0.25rem_1rem] text-center">
                      Gözden geçirilecek cevap yok.
                    </p>
                  ) : (
                    <ul>
                      {column.records.map((record) => (
                        <li
                          key={record.key}
                          className="grid grid-rows-[auto_auto] gap-1.5 overflow-hidden px-3 py-2.5 text-center text-xs sm:px-4"
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
                            {column.value === "wrong" &&
                            record.selectedAnswer ? (
                              <>
                                <span className="min-w-0 truncate text-error line-through">
                                  {record.selectedAnswer}
                                </span>
                                <ArrowRight
                                  aria-hidden="true"
                                  className="shrink-0 text-muted-foreground"
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
              ) : null}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
