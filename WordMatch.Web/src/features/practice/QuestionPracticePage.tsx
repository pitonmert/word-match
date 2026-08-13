import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import type {
  PracticeMode,
  PracticeResultView,
  PracticeSession,
} from "@/features/practice/api/practice";
import { fetchPracticeResults } from "@/features/practice/api/practice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PracticeCardShell } from "@/features/practice/components/PracticeCardShell";
import { PracticeCardTitle } from "@/features/practice/components/PracticeCardTitle";
import { PracticeHeaderRow } from "@/features/practice/components/PracticeHeaderRow";
import { PracticeModeSelection } from "@/features/practice/components/PracticeModeSelection";
import { useRestartPractice } from "@/features/practice/hooks/useRestartPractice";
import { QuestionPracticeContent } from "@/features/practice/components/QuestionPracticeContent";
import { CompletionContent } from "@/features/practice/components/results/CompletionContent";
import { PracticeResultFooter } from "@/features/practice/components/results/PracticeResultFooter";
import type { PracticeResultCategory } from "@/features/practice/components/results/types";
import { supportedPracticeModes } from "@/features/practice/constants";
import {
  fetchCategories,
  findCategoryOption,
  practiceCategoriesQueryKey,
} from "@/features/practice/api/categories";
import { getLocationStateValue } from "@/features/practice/utils/getLocationStateValue";
import { getPracticeModeShortLabel, getTopicLabel } from "@/lib/displayLabels";

export default function QuestionPracticePage() {
  const location = useLocation();
  const { sessionId } = useParams();

  if (location.pathname === "/practice/results") {
    return <PracticeResultsRoute />;
  }

  if (sessionId) {
    return <PracticeSessionRoute key={sessionId} sessionId={sessionId} />;
  }

  return <PracticeModeSelection />;
}

function PracticeSessionRoute({ sessionId }: { sessionId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialSession = useRef(
    getInitialSession(location.state, sessionId),
  ).current;

  useEffect(() => {
    if (!initialSession) return;

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [initialSession, location.pathname, location.search, navigate]);

  return (
    <QuestionPracticeContent
      initialSession={initialSession}
      sessionId={sessionId}
    />
  );
}

function getInitialSession(
  locationState: unknown,
  sessionId: string | undefined,
) {
  if (!sessionId) return null;

  return getLocationStateValue<PracticeSession>(
    locationState,
    "initialSession",
    (session) => session.sessionId === sessionId,
  );
}

function PracticeResultsRoute() {
  const [searchParams] = useSearchParams();
  const level = searchParams.get("level");
  const topic = searchParams.get("topic");
  const mode = searchParams.get("mode") as PracticeMode | null;
  const hasResultCriteria = Boolean(level && topic && mode);
  const hasValidMode = mode !== null && supportedPracticeModes.has(mode);
  const categoriesQuery = useQuery({
    queryKey: practiceCategoriesQueryKey,
    queryFn: ({ signal }) => fetchCategories(signal),
    enabled: hasResultCriteria && hasValidMode,
  });
  const category = findCategoryOption(categoriesQuery.data, level, topic);
  const isValidResultRequest =
    hasResultCriteria && hasValidMode && category !== null;
  const resultsCriteria =
    level && topic && mode ? { level, topic, mode } : null;
  const resultsQuery = useQuery({
    queryKey: ["practice", "results", level, topic, mode],
    queryFn: ({ signal }) => fetchPracticeResults(resultsCriteria!, signal),
    enabled: isValidResultRequest,
  });
  const result = resultsQuery.data ?? null;
  const isLoading = resultsQuery.isLoading;
  const error = categoriesQuery.isError
    ? "Çalışma kategorileri doğrulanamadı."
    : resultsQuery.isError
      ? "Çalışma sonuçları yüklenemedi."
      : null;
  const [selectedResultCategory, setSelectedResultCategory] =
    useState<PracticeResultCategory>("wrong");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { isRestarting, restartError, restart } =
    useRestartPractice(resultsCriteria);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!result) return;

    setSelectedResultCategory((current) =>
      getResultCount(result, current) > 0
        ? current
        : getDefaultResultCategory(result),
    );
  }, [result]);

  if (!hasResultCriteria || !hasValidMode || !level || !topic || !mode) {
    return <Navigate replace to="/" />;
  }

  if (categoriesQuery.isLoading) {
    return <PracticeResultsLoadingCard />;
  }

  if (categoriesQuery.isSuccess && !isValidResultRequest) {
    return <Navigate replace to="/" />;
  }

  const modeSelectionPath = `/practice?${new URLSearchParams({ level, topic }).toString()}`;

  return (
    <PracticeCardShell
      content={
        isLoading ? (
          <div
            aria-label="Sonuçlar yükleniyor"
            className="grid h-full gap-2 p-4"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="w-full" />
            ))}
          </div>
        ) : error || !result ? (
          <div className="flex h-full items-center px-4">
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Sonuçlar kullanılamıyor</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  {error ?? "Bu çalışma için tamamlanmış sonuç bulunamadı."}
                </p>
                <Button
                  size="sm"
                  type="button"
                  onClick={() =>
                    void (categoriesQuery.isError
                      ? categoriesQuery.refetch()
                      : resultsQuery.refetch())
                  }
                >
                  Tekrar dene
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <CompletionContent
            correctCount={result.progress.correctCount}
            correctWords={result.results.correct}
            selectedCategory={selectedResultCategory}
            unknownCount={result.progress.reviewCount}
            unknownWords={result.results.review}
            wrongCount={result.progress.wrongCount}
            wrongAnswers={result.results.wrong}
            onCategoryChange={setSelectedResultCategory}
          />
        )
      }
      contentClassName="p-0"
      headerClassName="border-b-0"
      footer={
        <PracticeResultFooter
          isRestartDisabled={isLoading || !result}
          isRestarting={isRestarting}
          modeSelectionPath={modeSelectionPath}
          restartError={restartError}
          onRestart={() => void restart()}
        />
      }
      footerClassName="p-0"
      header={
        <div className="grid size-full grid-rows-2">
          <PracticeHeaderRow>
            <p className="type-helper line-clamp-2 min-w-0 px-2 text-center leading-tight font-medium wrap-anywhere">
              {level} · {getTopicLabel(topic)} ·{" "}
              {getPracticeModeShortLabel(mode)}
            </p>
          </PracticeHeaderRow>
          <PracticeCardTitle className="-translate-y-1">
            <h1 ref={titleRef} className="outline-none" tabIndex={-1}>
              Sonuçlar
            </h1>
          </PracticeCardTitle>
        </div>
      }
    />
  );
}

function getDefaultResultCategory(
  result: PracticeResultView,
): PracticeResultCategory {
  if (result.progress.wrongCount > 0) return "wrong";
  if (result.progress.reviewCount > 0) return "review";
  return "correct";
}

function getResultCount(
  result: PracticeResultView,
  category: PracticeResultCategory,
) {
  return category === "correct"
    ? result.progress.correctCount
    : category === "review"
      ? result.progress.reviewCount
      : result.progress.wrongCount;
}

function PracticeResultsLoadingCard() {
  return (
    <PracticeCardShell
      content={
        <div aria-label="Sonuçlar yükleniyor" className="grid h-full gap-2 p-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="w-full" />
          ))}
        </div>
      }
      contentClassName="p-0"
      footer={<span aria-hidden="true" />}
      header={
        <PracticeCardTitle className="size-full">
          <h1 className="w-full text-center">Sonuçlar</h1>
        </PracticeCardTitle>
      }
      headerClassName="flex items-center justify-center"
    />
  );
}
