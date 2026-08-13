import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, RotateCcw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import type {
  PracticeCriteria,
  PracticeMode,
} from "@/features/practice/api/practice";
import { startPractice } from "@/features/practice/api/practice";
import {
  fetchCategories,
  findCategoryOption,
  practiceCategoriesQueryKey,
  resetCategoryProgress,
  type CategoryModeStatus,
  type CategoryOption,
} from "@/features/practice/api/categories";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryProgressResetDialog } from "@/features/practice/components/CategoryProgressResetDialog";
import { PracticeCardShell } from "@/features/practice/components/PracticeCardShell";
import { PracticeCardTitle } from "@/features/practice/components/PracticeCardTitle";
import { PracticeHeaderRow } from "@/features/practice/components/PracticeHeaderRow";
import { practiceModeOptions } from "@/features/practice/constants";
import { getLocationStateValue } from "@/features/practice/utils/getLocationStateValue";
import { getTopicLabel } from "@/lib/displayLabels";
import { cn } from "@/lib/utils";

export function PracticeModeSelection() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const level = searchParams.get("level");
  const topic = searchParams.get("topic");
  const prefetchedCategory = useRef(
    getInitialCategory(location.state, level, topic),
  ).current;
  const [openingMode, setOpeningMode] = useState<PracticeMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const categoryCriteria = level && topic ? { level, topic } : null;

  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: practiceCategoriesQueryKey,
    queryFn: ({ signal }) => fetchCategories(signal),
    enabled: categoryCriteria !== null && prefetchedCategory === null,
  });
  const fetchedCategory = findCategoryOption(
    categoriesQuery.data,
    level,
    topic,
  );
  const category = prefetchedCategory ?? fetchedCategory;
  const isLoadingCategory =
    prefetchedCategory === null && categoriesQuery.isLoading;
  const loadError =
    prefetchedCategory === null && categoriesQuery.isError
      ? "Çalışma modları yüklenemedi."
      : null;
  const displayError = error ?? loadError;

  const startPracticeMutation = useMutation({
    mutationFn: (criteria: PracticeCriteria) => startPractice(criteria),
  });
  const resetCategoryProgressMutation = useMutation({
    mutationFn: ({ level, topic }: { level: string; topic: string }) =>
      resetCategoryProgress(level, topic),
  });

  useEffect(() => {
    if (
      categoryCriteria === null ||
      prefetchedCategory ||
      !categoriesQuery.data ||
      fetchedCategory
    ) {
      return;
    }

    navigate("/", { replace: true });
  }, [
    categoriesQuery.data,
    fetchedCategory,
    categoryCriteria,
    navigate,
    prefetchedCategory,
  ]);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  if (categoryCriteria === null) {
    return <Navigate replace to="/" />;
  }

  const openPractice = async (mode: PracticeMode) => {
    setOpeningMode(mode);
    setError(null);

    try {
      const modeStatus = category?.modes.find((status) => status.mode === mode);
      if (modeStatus?.activeSessionId) {
        navigate(`/practice/${modeStatus.activeSessionId}`);
        return;
      }

      const isComplete =
        modeStatus !== undefined &&
        modeStatus.completedQuestionCount >= modeStatus.totalQuestionCount;

      if (isComplete) {
        navigate(
          getResultsPath(categoryCriteria.level, categoryCriteria.topic, mode),
        );
        return;
      }

      const session = await startPracticeMutation.mutateAsync({
        level: categoryCriteria.level,
        topic: categoryCriteria.topic,
        mode,
      });
      void queryClient.invalidateQueries({
        queryKey: practiceCategoriesQueryKey,
      });
      navigate(`/practice/${session.sessionId}`, {
        state: { initialSession: session },
      });
    } catch {
      setError("Çalışma oturumu açılamadı.");
      setOpeningMode(null);
    }
  };

  const categoryReturnPath = `/?${new URLSearchParams({ level: categoryCriteria.level }).toString()}`;
  const hasProgress = (category?.completedQuestionCount ?? 0) > 0;

  const confirmReset = async () => {
    if (isResetting) return;

    setIsResetting(true);
    setResetError(null);

    try {
      await resetCategoryProgressMutation.mutateAsync(categoryCriteria);
      void queryClient.invalidateQueries({
        queryKey: practiceCategoriesQueryKey,
      });
      setIsResetDialogOpen(false);
      navigate(categoryReturnPath, {
        replace: true,
        state: { transitionDirection: "back" },
      });
    } catch {
      setResetError("İlerleme sıfırlanamadı. Tekrar deneyin.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <PracticeCardShell
        content={
          <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
            {isLoadingCategory
              ? Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))
              : practiceModeOptions.map((option) => {
                  const isOpening = openingMode === option.mode;
                  const modeStatus = category?.modes.find(
                    (status) => status.mode === option.mode,
                  );
                  const statusLabel = getModeStatusLabel(modeStatus);
                  return (
                    <Button
                      key={option.mode}
                      aria-label={option.label}
                      className="h-14 w-full justify-center px-3 text-base font-semibold"
                      disabled={openingMode !== null || category === null}
                      type="button"
                      variant="outline"
                      onClick={() => void openPractice(option.mode)}
                    >
                      {isOpening ? (
                        <>
                          <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                          />
                          Açılıyor...
                        </>
                      ) : (
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                          <span className="flex min-w-0 items-center gap-1.5">
                            {option.mode === "Mixed" ? (
                              <span>Her iki yönde</span>
                            ) : (
                              <>
                                <span>{option.source}</span>
                                <ArrowRight aria-hidden="true" />
                                <span>{option.target}</span>
                              </>
                            )}
                          </span>
                          {statusLabel ? (
                            <span className="type-helper shrink-0 text-right whitespace-nowrap tabular-nums">
                              {statusLabel}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </Button>
                  );
                })}

            {displayError ? (
              <p className="type-helper text-center text-error" role="alert">
                {displayError}
              </p>
            ) : null}
          </div>
        }
        contentClassName="flex items-center px-4 py-3"
        footer={
          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center">
            <CategoryBackLink to={categoryReturnPath} />
            <p
              aria-label={`${category?.wordCount ?? 0} kelime`}
              className="type-helper justify-self-center whitespace-nowrap tabular-nums"
            >
              <span className="font-semibold text-foreground">
                {category?.wordCount ?? 0}
              </span>{" "}
              kelime
            </p>
            {hasProgress ? (
              <Button
                className="justify-self-end text-error hover:text-error"
                disabled={isResetting}
                size="xs"
                type="button"
                variant="ghost"
                onClick={() => {
                  setResetError(null);
                  setIsResetDialogOpen(true);
                }}
              >
                <RotateCcw aria-hidden="true" />
                Sıfırla
              </Button>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
        }
        footerClassName="flex items-center px-4"
        header={
          <div className="grid size-full grid-rows-2">
            <PracticeHeaderRow>
              <p className="type-helper min-w-0 px-2 text-center leading-tight font-medium wrap-anywhere">
                {categoryCriteria.level} ·{" "}
                {getTopicLabel(categoryCriteria.topic)}
              </p>
            </PracticeHeaderRow>
            <PracticeCardTitle className="-translate-y-1">
              <h1 ref={titleRef} className="outline-none" tabIndex={-1}>
                Çalışma modunu seçin
              </h1>
            </PracticeCardTitle>
          </div>
        }
      />

      <CategoryProgressResetDialog
        categoryLabel={getTopicLabel(categoryCriteria.topic)}
        error={resetError}
        isOpen={isResetDialogOpen}
        isResetting={isResetting}
        onCancel={() => {
          if (isResetting) return;
          setResetError(null);
          setIsResetDialogOpen(false);
        }}
        onConfirm={() => void confirmReset()}
      />
    </>
  );
}

function getModeStatusLabel(modeStatus?: CategoryModeStatus) {
  if (!modeStatus) return null;

  if (modeStatus.activeSessionId) {
    const answeredCount = modeStatus.activeAnsweredCount ?? 0;

    if (modeStatus.isReplay) {
      return `Tekrar · ${answeredCount}/${modeStatus.activeTotalCount ?? 0} soru`;
    }
  }

  const completedCount = Math.min(
    modeStatus.completedQuestionCount,
    modeStatus.totalQuestionCount,
  );

  if (completedCount === modeStatus.totalQuestionCount) return "Sonuçları gör";
  if (completedCount === 0)
    return `Başla · ${modeStatus.totalQuestionCount} soru`;

  return `Devam et · ${completedCount}/${modeStatus.totalQuestionCount} soru`;
}

function getInitialCategory(
  locationState: unknown,
  level: string | null,
  topic: string | null,
) {
  if (!level || !topic) return null;

  const selectedLevel = getLocationStateValue<string>(
    locationState,
    "level",
    (value) => value === level,
  );
  if (!selectedLevel) return null;

  return getLocationStateValue<CategoryOption>(
    locationState,
    "category",
    (category) => category.value === topic,
  );
}

function getResultsPath(level: string, topic: string, mode: PracticeMode) {
  return `/practice/results?${new URLSearchParams({ level, topic, mode }).toString()}`;
}

function CategoryBackLink({ to }: { to: string }) {
  return (
    <Link
      aria-label="Kategorilere dön"
      className={cn(
        buttonVariants({ size: "xs", variant: "ghost" }),
        "justify-self-start",
      )}
      state={{ transitionDirection: "back" }}
      to={to}
    >
      <ArrowLeft aria-hidden="true" />
      Kategoriler
    </Link>
  );
}
