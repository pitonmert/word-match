import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchCategories,
  practiceCategoriesQueryKey,
  type CategoryOption,
  type LevelCategory,
} from "@/features/practice/api/categories";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryBrowser } from "@/features/practice/components/CategoryBrowser";
import { PracticeCardShell } from "@/features/practice/components/PracticeCardShell";
import { PracticeCardTitle } from "@/features/practice/components/PracticeCardTitle";
import { useTabListKeyboardNav } from "@/features/practice/hooks/useTabListKeyboardNav";
import { getLocationStateValue } from "@/features/practice/utils/getLocationStateValue";
import { cn } from "@/lib/utils";

export default function CategorySelectionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLevel = searchParams.get("level");
  const [selectedLevel, setSelectedLevel] = useState<string | null>(
    initialLevel,
  );
  const [retryCount, setRetryCount] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const categoriesQuery = useQuery({
    queryKey: practiceCategoriesQueryKey,
    queryFn: ({ signal }) => fetchCategories(signal),
  });
  const categories = categoriesQuery.data ?? null;
  const isLoading = categoriesQuery.isLoading;
  const error = categoriesQuery.isError
    ? "Çalışma kategorileri yüklenemedi."
    : null;

  useEffect(() => {
    if (!categoriesQuery.data) return;

    setSelectedLevel((currentLevel) =>
      categoriesQuery.data.levels.some((level) => level.value === currentLevel)
        ? currentLevel
        : (categoriesQuery.data.levels[0]?.value ?? null),
    );
  }, [categoriesQuery.data]);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const selectedLevelCategory = categories?.levels.find(
    (level) => level.value === selectedLevel,
  );

  const selectLevel = (level: string) => {
    setSelectedLevel(level);
    setSearchParams({ level }, { replace: true });
  };

  const openCategory = (level: string, category: CategoryOption) => {
    const query = new URLSearchParams({ level, topic: category.value });
    navigate(`/practice?${query.toString()}`, {
      state: { category, level, transitionDirection: "forward" },
    });
  };

  const levels = categories?.levels ?? [];
  const activeLevel = selectedLevelCategory ?? levels[0] ?? null;
  const transitionDirection = getTransitionDirection(location.state);

  return (
    <PracticeCardShell
      content={
        <div className="flex size-full min-h-0 flex-col gap-1">
          {!error && (isLoading || levels.length > 0) ? (
            <LevelTabs
              levels={levels}
              selectedLevel={activeLevel?.value ?? null}
              onLevelChange={selectLevel}
            />
          ) : null}

          <div className="min-h-0 flex-1">
            {error ? (
              <CategoryError
                message={error}
                onRetry={() => {
                  setRetryCount((count) => count + 1);
                  void categoriesQuery.refetch();
                }}
              />
            ) : isLoading || !categories ? (
              <CategoryListSkeleton />
            ) : !activeLevel ? (
              <div className="flex size-full items-center">
                <Alert>
                  <TriangleAlert />
                  <AlertTitle>Kullanılabilir seviye yok</AlertTitle>
                  <AlertDescription>
                    Şu anda kategorilere ayrılmış kelime bulunmuyor.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div
                key={activeLevel.value}
                className="size-full min-h-0 motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in"
              >
                <CategoryBrowser
                  key={`${activeLevel.value}:${retryCount}`}
                  level={activeLevel}
                  onStart={openCategory}
                />
              </div>
            )}
          </div>
        </div>
      }
      contentClassName="px-3 py-2"
      footer={
        isLoading ? (
          <Skeleton className="h-4 w-32" />
        ) : activeLevel ? (
          <p
            aria-label={`${activeLevel.topics.length} kategori, ${activeLevel.wordCount} kelime`}
            className="type-helper tabular-nums"
          >
            <span className="font-semibold text-foreground">
              {activeLevel.topics.length}
            </span>{" "}
            kategori
            <span aria-hidden="true"> · </span>
            <span className="font-semibold text-foreground">
              {activeLevel.wordCount}
            </span>{" "}
            kelime
          </p>
        ) : null
      }
      footerClassName="flex items-center justify-center px-4"
      header={
        <PracticeCardTitle className="size-full">
          <h1
            ref={titleRef}
            className="w-full text-center outline-none"
            tabIndex={-1}
          >
            Kategori seçin
          </h1>
        </PracticeCardTitle>
      }
      headerClassName="flex items-center justify-center [.border-b]:pb-0"
      transitionDirection={transitionDirection}
    />
  );
}

function LevelTabs({
  levels,
  selectedLevel,
  onLevelChange,
}: {
  levels: LevelCategory[];
  selectedLevel: string | null;
  onLevelChange: (level: string) => void;
}) {
  const { containerRef, onKeyDown } = useTabListKeyboardNav<HTMLDivElement>();

  return (
    <div
      ref={containerRef}
      aria-label="Çalışma seviyesi"
      className="mx-auto flex min-w-0 items-center justify-center gap-1"
      role="tablist"
      onKeyDown={onKeyDown}
    >
      {levels.length === 0
        ? Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-7 w-11" />
          ))
        : levels.map((level) => {
            const isSelected = level.value === selectedLevel;

            return (
              <Button
                key={level.value}
                aria-controls="category-list"
                aria-current={isSelected ? "page" : undefined}
                aria-selected={isSelected}
                className={cn(
                  "h-7 min-w-11 px-2",
                  isSelected &&
                    "bg-selected font-bold text-selected-foreground shadow-surface hover:bg-selected hover:text-selected-foreground active:bg-selected",
                )}
                role="tab"
                size="xs"
                tabIndex={isSelected ? 0 : -1}
                type="button"
                variant="ghost"
                onClick={() => onLevelChange(level.value)}
              >
                {level.label}
              </Button>
            );
          })}
    </div>
  );
}

function CategoryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3">
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Kategoriler kullanılamıyor</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button type="button" onClick={onRetry}>
        Tekrar dene
      </Button>
    </div>
  );
}

function CategoryListSkeleton() {
  return (
    <div aria-label="Kategoriler yükleniyor" className="grid gap-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

function getTransitionDirection(locationState: unknown) {
  return (
    getLocationStateValue<"back">(
      locationState,
      "transitionDirection",
      (value) => value === "back",
    ) ?? "forward"
  );
}
