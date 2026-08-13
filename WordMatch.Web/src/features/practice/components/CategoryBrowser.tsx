import { useState } from "react";
import { ChevronRight, CircleCheck } from "lucide-react";
import {
  type CategoryOption,
  type LevelCategory,
} from "@/features/practice/api/categories";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTabListKeyboardNav } from "@/features/practice/hooks/useTabListKeyboardNav";
import { getTopicLabel } from "@/lib/displayLabels";
import { cn } from "@/lib/utils";

type CategoryBrowserProps = {
  level: LevelCategory;
  onStart: (level: string, category: CategoryOption) => void;
};

type CategoryStatus = "available" | "completed" | "inProgress";
const categoryStatusStorageKey = "word-match-category-status";

export function CategoryBrowser({ level, onStart }: CategoryBrowserProps) {
  const categoryGroups: Record<CategoryStatus, CategoryOption[]> = {
    inProgress: level.topics.filter(
      (category) =>
        category.status === "InProgress" || hasActiveSession(category),
    ),
    available: level.topics.filter(
      (category) =>
        category.status === "Available" && !hasActiveSession(category),
    ),
    completed: level.topics.filter(
      (category) =>
        category.status === "Completed" && !hasActiveSession(category),
    ),
  };
  const [selectedStatus, setSelectedStatus] = useState<CategoryStatus>(
    getInitialCategoryStatus,
  );
  const selectedCategories = categoryGroups[selectedStatus];

  const selectStatus = (status: CategoryStatus) => {
    setSelectedStatus(status);
    storeCategoryStatus(status);
  };
  const { containerRef, onKeyDown } = useTabListKeyboardNav<HTMLDivElement>();

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div
        ref={containerRef}
        aria-label="Kategori durumu"
        className="grid shrink-0 grid-cols-3 pr-3"
        role="tablist"
        onKeyDown={onKeyDown}
      >
        {categoryTabs.map((tab) => {
          const isSelected = selectedStatus === tab.value;

          return (
            <Button
              key={tab.value}
              aria-controls="category-list"
              aria-selected={isSelected}
              className={cn(
                "relative h-9 min-w-0 gap-1 rounded-none px-1 text-muted-foreground shadow-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent hover:bg-transparent hover:text-foreground active:bg-transparent",
                isSelected &&
                  "font-semibold text-foreground after:bg-primary hover:text-foreground",
              )}
              role="tab"
              size="xs"
              tabIndex={isSelected ? 0 : -1}
              type="button"
              variant="ghost"
              onClick={() => selectStatus(tab.value)}
            >
              {tab.label}
              <span className="text-xs leading-4 tabular-nums">
                ({categoryGroups[tab.value].length})
              </span>
            </Button>
          );
        })}
      </div>

      <ScrollArea
        key={selectedStatus}
        className="min-h-0 flex-1"
        contentClassName="py-2"
      >
        <div
          id="category-list"
          aria-label={`${level.label} ${getCategoryStatusLabel(selectedStatus)} kategorileri`}
          className="grid gap-0.5 pr-3"
          role="tabpanel"
        >
          {selectedCategories.length === 0 ? (
            <p className="type-helper px-3 py-6 text-center">
              Kategori bulunmuyor.
            </p>
          ) : (
            selectedCategories.map((category) => (
              <CategoryRow
                key={category.value}
                category={category}
                displayStatus={selectedStatus}
                level={level.value}
                onStart={onStart}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function getInitialCategoryStatus(): CategoryStatus {
  let storedStatus: string | null = null;

  try {
    storedStatus = window.sessionStorage.getItem(categoryStatusStorageKey);
  } catch {
    // The default remains available when browser storage is blocked.
  }

  return storedStatus === "available" ||
    storedStatus === "completed" ||
    storedStatus === "inProgress"
    ? storedStatus
    : "inProgress";
}

function storeCategoryStatus(status: CategoryStatus) {
  try {
    window.sessionStorage.setItem(categoryStatusStorageKey, status);
  } catch {
    // Tab selection still works when browser storage is blocked.
  }
}

function hasActiveSession(category: CategoryOption) {
  return category.modes.some((mode) => Boolean(mode.activeSessionId));
}

const categoryTabs: { label: string; value: CategoryStatus }[] = [
  { label: "Devam Eden", value: "inProgress" },
  { label: "Kullanılabilir", value: "available" },
  { label: "Tamamlanan", value: "completed" },
];

function getCategoryStatusLabel(status: CategoryStatus) {
  return categoryTabs.find((tab) => tab.value === status)?.label ?? "";
}

function CategoryRow({
  category,
  displayStatus,
  level,
  onStart,
}: {
  category: CategoryOption;
  displayStatus: CategoryStatus;
  level: string;
  onStart: (level: string, category: CategoryOption) => void;
}) {
  const categoryLabel = getTopicLabel(category.value);
  const progress = getCategoryProgress(category);
  const accessibleLabel =
    displayStatus === "inProgress"
      ? `${categoryLabel}, ${progress.label}`
      : displayStatus === "completed"
        ? `${categoryLabel}, tamamlandı`
        : categoryLabel;

  return (
    <div className="relative min-w-0">
      <Button
        aria-label={accessibleLabel}
        className="h-13 min-h-13 w-full min-w-0 justify-start overflow-hidden p-2 pr-16 text-left whitespace-normal"
        type="button"
        variant="ghost"
        onClick={() => onStart(level, category)}
      >
        {displayStatus === "inProgress" ? (
          <span className="grid min-w-0 flex-1 grid-rows-[auto_auto] gap-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="line-clamp-1 min-w-0 flex-1 leading-tight wrap-break-word">
                {categoryLabel}
              </span>
              <span className="type-helper shrink-0 whitespace-nowrap tabular-nums">
                {progress.label}
              </span>
            </span>
            <span className="h-1 w-full overflow-hidden rounded-full bg-disabled">
              <span
                aria-label={`${categoryLabel} çalışma ilerlemesi`}
                aria-valuemax={progress.totalCount}
                aria-valuemin={0}
                aria-valuenow={progress.answeredCount}
                aria-valuetext={`${progress.totalCount} sorudan ${progress.answeredCount} tanesi çalışıldı.`}
                className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                role="progressbar"
                style={{ width: `${progress.percentage}%` }}
              />
            </span>
          </span>
        ) : (
          <span className="line-clamp-1 min-w-0 flex-1 leading-tight wrap-break-word">
            {categoryLabel}
          </span>
        )}
      </Button>

      <span className="pointer-events-none absolute inset-y-0 right-2 grid grid-cols-2 items-center">
        <span className="flex size-7 items-center justify-center">
          {displayStatus === "completed" ? (
            <CircleCheck aria-hidden="true" className="size-4 text-success" />
          ) : null}
        </span>
        <span className="flex size-7 items-center justify-center">
          <CategoryChevron />
        </span>
      </span>
    </div>
  );
}

function getCategoryProgress(category: CategoryOption) {
  const activeMode = category.modes.find((mode) => mode.activeSessionId);
  const answeredCount = activeMode
    ? (activeMode.activeAnsweredCount ?? 0)
    : category.completedQuestionCount;
  const totalCount = activeMode
    ? (activeMode.activeTotalCount ?? 0)
    : category.totalQuestionCount;
  const boundedAnsweredCount = Math.min(answeredCount, totalCount);
  const percentage =
    totalCount > 0 ? (boundedAnsweredCount / totalCount) * 100 : 0;
  const prefix = activeMode?.isReplay ? "Tekrar " : "";

  return {
    answeredCount: boundedAnsweredCount,
    totalCount,
    percentage,
    label: `${prefix}${boundedAnsweredCount}/${totalCount} soru`,
  };
}

function CategoryChevron() {
  return (
    <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
  );
}
