import { useCallback, useEffect, useRef, useState } from "react";
import { TriangleAlert, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PracticeSession } from "@/features/practice/api/practice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  playCorrectSound,
  playShowAnswerSound,
  playWrongSound,
} from "@/features/practice/questionSounds";
import { AnswerAnnouncement } from "@/features/practice/components/AnswerAnnouncement";
import { PracticeCardShell } from "@/features/practice/components/PracticeCardShell";
import { PracticeCardTitle } from "@/features/practice/components/PracticeCardTitle";
import { PracticeHeaderRow } from "@/features/practice/components/PracticeHeaderRow";
import { practiceFlowButtonClassName } from "@/features/practice/components/practiceStyles";
import { PracticeStats } from "@/features/practice/components/PracticeStats";
import { QuestionOptions } from "@/features/practice/components/QuestionOptions";
import { QuestionSkeleton } from "@/features/practice/components/QuestionSkeleton";
import { WrittenAnswerField } from "@/features/practice/components/WrittenAnswerField";
import { CompletionContent } from "@/features/practice/components/results/CompletionContent";
import { PracticeResultFooter } from "@/features/practice/components/results/PracticeResultFooter";
import type { PracticeResultCategory } from "@/features/practice/components/results/types";
import { useQuestionSession } from "@/features/practice/hooks/useQuestionSession";
import { useFeedbackSoundPreference } from "@/features/practice/hooks/useFeedbackSoundPreference";
import { useRestartPractice } from "@/features/practice/hooks/useRestartPractice";
import {
  getPracticeModeLabel,
  getPracticeModeShortLabel,
  getTopicLabel,
} from "@/lib/displayLabels";
import { cn } from "@/lib/utils";

const correctAnswerAdvanceDelay = 800;

export function QuestionPracticeContent({
  initialSession,
  sessionId,
}: {
  initialSession: PracticeSession | null;
  sessionId: string;
}) {
  const navigate = useNavigate();
  const [isBrowsingResults, setIsBrowsingResults] = useState(false);
  const [selectedResultCategory, setSelectedResultCategory] =
    useState<PracticeResultCategory>("wrong");
  const [automaticAdvanceDelayElapsed, setAutomaticAdvanceDelayElapsed] =
    useState(false);
  const { isFeedbackSoundEnabled, toggleFeedbackSound } =
    useFeedbackSoundPreference();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const {
    session,
    question,
    selectedIndex,
    correctIndex,
    writtenAnswer,
    correctCount,
    wrongCount,
    unknownCount,
    correctWords,
    wrongAnswers,
    unknownWords,
    totalCount,
    isComplete,
    isLoading,
    isSubmittingAnswer,
    error,
    answerError,
    answerOutcome,
    hasAnswered,
    canAdvance,
    loadNext,
    setWrittenAnswer,
    handleAnswer,
    handleWrittenAnswer,
    handleUnknown,
    retryAnswer,
    retry,
  } = useQuestionSession(sessionId, initialSession);
  const answeredCount = correctCount + unknownCount + wrongCount;
  const isLastQuestion =
    hasAnswered && totalCount > 0 && answeredCount >= totalCount;
  const isWrittenQuestion = question?.format === "Written";
  const modeSelectionPath = getModeSelectionPath(session);
  const categoryLabel = session?.topic
    ? getTopicLabel(session.topic)
    : "Çalışma";
  const shouldAutomaticallyAdvance = answerOutcome === "Correct";
  const { isRestarting, restartError, restart } = useRestartPractice(
    session
      ? { level: session.level, topic: session.topic, mode: session.mode }
      : null,
  );

  useEffect(() => {
    setAutomaticAdvanceDelayElapsed(false);
  }, [question?.position]);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const toggleResultsBrowser = (category: PracticeResultCategory) => {
    if (isBrowsingResults && selectedResultCategory === category) {
      setIsBrowsingResults(false);
      return;
    }

    setSelectedResultCategory(category);
    setIsBrowsingResults(true);
  };

  const answerQuestion = (index: number) => {
    if (!question) return;

    const outcome = handleAnswer(index);
    if (isFeedbackSoundEnabled && outcome === "Correct") {
      playCorrectSound();
    } else if (isFeedbackSoundEnabled && outcome === "Wrong") {
      playWrongSound();
    }
  };

  const showAnswer = () => {
    if (isFeedbackSoundEnabled) playShowAnswerSound();
    handleUnknown();
  };

  const checkWrittenAnswer = () => {
    const outcome = handleWrittenAnswer(writtenAnswer);
    if (isFeedbackSoundEnabled && outcome === "Correct") {
      playCorrectSound();
    } else if (isFeedbackSoundEnabled && outcome === "Wrong") {
      playWrongSound();
    }
  };

  const loadNextQuestion = useCallback(async () => {
    setAutomaticAdvanceDelayElapsed(false);
    await loadNext();
  }, [loadNext]);

  const changeMode = () => navigate(modeSelectionPath);

  useEffect(() => {
    if (
      !shouldAutomaticallyAdvance ||
      !hasAnswered ||
      !answerOutcome ||
      isComplete
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAutomaticAdvanceDelayElapsed(true);
    }, correctAnswerAdvanceDelay);

    return () => window.clearTimeout(timeoutId);
  }, [answerOutcome, hasAnswered, isComplete, shouldAutomaticallyAdvance]);

  useEffect(() => {
    if (
      !shouldAutomaticallyAdvance ||
      !automaticAdvanceDelayElapsed ||
      !canAdvance ||
      answerError ||
      isComplete
    ) {
      return;
    }

    void loadNextQuestion();
  }, [
    answerError,
    automaticAdvanceDelayElapsed,
    shouldAutomaticallyAdvance,
    canAdvance,
    isComplete,
    loadNextQuestion,
  ]);

  useEffect(() => {
    if (
      !question ||
      question.format !== "MultipleChoice" ||
      hasAnswered ||
      isComplete ||
      isLoading
    ) {
      return;
    }

    const handleAnswerShortcut = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.defaultPrevented ||
        event.metaKey ||
        event.repeat
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, select, textarea, [contenteditable=true]"))
      ) {
        return;
      }

      const shortcutNumber = Number(event.key);
      if (!Number.isInteger(shortcutNumber)) return;

      const optionIndex = shortcutNumber - 1;
      if (optionIndex < 0 || optionIndex >= question.options.length) return;

      event.preventDefault();
      answerQuestion(optionIndex);
    };

    window.addEventListener("keydown", handleAnswerShortcut);
    return () => window.removeEventListener("keydown", handleAnswerShortcut);
  }, [hasAnswered, isComplete, isLoading, question]);

  useEffect(() => {
    if (
      !question ||
      question.format !== "MultipleChoice" ||
      !hasAnswered ||
      answerOutcome === "Correct" ||
      !canAdvance ||
      answerError ||
      isComplete
    ) {
      return;
    }

    const handleContinueShortcut = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.altKey ||
        event.ctrlKey ||
        event.defaultPrevented ||
        event.metaKey ||
        event.repeat
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            "a, button, input, select, textarea, [contenteditable=true]",
          ))
      ) {
        return;
      }

      event.preventDefault();
      void loadNextQuestion();
    };

    window.addEventListener("keydown", handleContinueShortcut);
    return () => window.removeEventListener("keydown", handleContinueShortcut);
  }, [
    answerError,
    answerOutcome,
    canAdvance,
    hasAnswered,
    isComplete,
    loadNextQuestion,
    question,
  ]);

  return (
    <PracticeCardShell
      announcement={
        <AnswerAnnouncement
          isLastQuestion={isLastQuestion}
          outcome={answerOutcome}
        />
      }
      content={
        <div
          className={cn(
            "min-h-0",
            isComplete
              ? "h-full"
              : isBrowsingResults
                ? "h-full"
                : isWrittenQuestion && !error
                  ? "h-full"
                  : "grid h-full grid-rows-[minmax(0,1fr)_2.5rem] gap-2",
          )}
        >
          {isComplete ? (
            <CompletionContent
              correctCount={correctCount}
              correctWords={correctWords}
              unknownCount={unknownCount}
              unknownWords={unknownWords}
              selectedCategory={selectedResultCategory}
              wrongCount={wrongCount}
              wrongAnswers={wrongAnswers}
              onCategoryChange={setSelectedResultCategory}
            />
          ) : isBrowsingResults ? (
            <CompletionContent
              correctCount={correctCount}
              correctWords={correctWords}
              selectedCategory={selectedResultCategory}
              unknownCount={unknownCount}
              unknownWords={unknownWords}
              wrongCount={wrongCount}
              wrongAnswers={wrongAnswers}
              onCategoryChange={setSelectedResultCategory}
            />
          ) : (
            <>
              <div className="min-h-0">
                {error ? (
                  <div className="flex h-full items-center">
                    <Alert variant="destructive">
                      <TriangleAlert />
                      <AlertTitle>Soru kullanılamıyor</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </div>
                ) : !question ? (
                  <QuestionSkeleton />
                ) : question.format === "Written" ? (
                  <WrittenAnswerField
                    answerError={answerError}
                    answerOutcome={answerOutcome}
                    canAdvance={canAdvance}
                    hasAnswered={hasAnswered}
                    isLastQuestion={isLastQuestion}
                    isLoading={isLoading}
                    isSubmittingAnswer={isSubmittingAnswer}
                    question={question}
                    value={writtenAnswer}
                    onChange={setWrittenAnswer}
                    onCheck={checkWrittenAnswer}
                    onContinue={() => void loadNextQuestion()}
                    onRetryAnswer={retryAnswer}
                    onShowAnswer={showAnswer}
                  />
                ) : (
                  <QuestionOptions
                    hasAnswered={hasAnswered}
                    isLoading={isLoading}
                    question={question}
                    correctIndex={correctIndex}
                    selectedIndex={selectedIndex}
                    onAnswer={answerQuestion}
                  />
                )}
              </div>

              {!isWrittenQuestion ? (
                <div className="flex min-w-0 items-center justify-center">
                  {error ? (
                    <Button
                      className="w-full max-w-48"
                      type="button"
                      onClick={() => void retry()}
                    >
                      Tekrar dene
                    </Button>
                  ) : answerError ? (
                    <Button
                      className={practiceFlowButtonClassName}
                      disabled={isSubmittingAnswer}
                      type="button"
                      variant="outline"
                      onClick={retryAnswer}
                    >
                      {isSubmittingAnswer
                        ? "Kaydediliyor..."
                        : "Kaydetmeyi tekrar dene"}
                    </Button>
                  ) : answerOutcome === "Correct" ? null : hasAnswered ? (
                    <Button
                      className={practiceFlowButtonClassName}
                      disabled={!canAdvance}
                      type="button"
                      variant="outline"
                      onClick={() => void loadNextQuestion()}
                    >
                      {isSubmittingAnswer
                        ? "Kaydediliyor..."
                        : isLastQuestion
                          ? "Sonuçları gör"
                          : "Devam et"}
                    </Button>
                  ) : (
                    <Button
                      className={practiceFlowButtonClassName}
                      disabled={isLoading || !question}
                      type="button"
                      variant="outline"
                      onClick={showAnswer}
                    >
                      {isLoading ? "Yükleniyor..." : "Cevabı göster"}
                    </Button>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      }
      contentClassName={isComplete ? "p-0" : "px-4 py-3"}
      headerClassName={
        isComplete || isBrowsingResults ? "border-b-0" : undefined
      }
      footer={
        isComplete ? (
          <PracticeResultFooter
            isRestarting={isRestarting}
            modeSelectionPath={modeSelectionPath}
            restartError={restartError}
            onRestart={() => void restart()}
          />
        ) : (
          <PracticeStats
            correctCount={correctCount}
            isResultSelectionDisabled={shouldAutomaticallyAdvance}
            onChangeMode={changeMode}
            onResultSelect={toggleResultsBrowser}
            reviewCount={unknownCount}
            selectedResultCategory={
              isBrowsingResults ? selectedResultCategory : null
            }
            totalCount={totalCount}
            wrongCount={wrongCount}
          />
        )
      }
      footerClassName="p-0"
      header={
        <div
          aria-label="Çalışma başlığı"
          className="grid size-full grid-rows-2"
          role="group"
        >
          <PracticeHeaderRow
            rightContent={
              !isComplete && question ? (
                <Button
                  aria-pressed={isFeedbackSoundEnabled}
                  size="xs"
                  type="button"
                  variant="ghost"
                  onClick={toggleFeedbackSound}
                >
                  {isFeedbackSoundEnabled ? (
                    <Volume2 aria-hidden="true" />
                  ) : (
                    <VolumeX aria-hidden="true" />
                  )}
                  {isFeedbackSoundEnabled ? "Sesi kapat" : "Sesi aç"}
                </Button>
              ) : null
            }
          >
            <p
              aria-label={`Çalışma modu: ${getPracticeModeLabel(session?.mode)}`}
              className="type-helper line-clamp-2 min-w-0 px-2 text-center leading-tight font-medium wrap-anywhere"
              title={getPracticeModeLabel(session?.mode)}
            >
              {session
                ? `${session.level} · ${categoryLabel} · ${getPracticeModeShortLabel(session.mode)}`
                : "Çalışma"}
            </p>
          </PracticeHeaderRow>

          <PracticeCardTitle className="-translate-y-1">
            <h1
              ref={titleRef}
              className="w-full truncate px-2 outline-none"
              tabIndex={-1}
            >
              {isComplete
                ? "Sonuçlar"
                : error
                  ? "Kullanılamıyor"
                  : (question?.prompt ?? "Yükleniyor...")}
            </h1>
          </PracticeCardTitle>
        </div>
      }
    />
  );
}

function getModeSelectionPath(session: PracticeSession | null) {
  if (!session) return "/";

  const searchParams = new URLSearchParams({
    level: session.level,
    topic: session.topic,
  });

  return `/practice?${searchParams.toString()}`;
}
