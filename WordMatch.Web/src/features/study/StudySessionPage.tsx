import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnswerAnnouncement } from "@/features/question-session/components/AnswerAnnouncement";
import { QuestionAutoAdvanceNotice } from "@/features/question-session/components/QuestionAutoAdvanceNotice";
import { QuestionOptions } from "@/features/question-session/components/QuestionOptions";
import { QuestionResultBrowser } from "@/features/question-session/components/QuestionResultBrowser";
import {
  QuestionSessionCard,
  QuestionSessionCardTitle,
} from "@/features/question-session/components/QuestionSessionCard";
import { QuestionSessionStats } from "@/features/question-session/components/QuestionSessionStats";
import { QuestionSkeleton } from "@/features/question-session/components/QuestionSkeleton";
import { WrittenAnswerField } from "@/features/question-session/components/WrittenAnswerField";
import {
  playCorrectSound,
  playShowAnswerSound,
  playWrongSound,
} from "@/features/question-session/feedbackSounds";
import {
  questionFlowButtonClassName,
  questionRevealButtonClassName,
} from "@/features/question-session/styles";
import type {
  QuestionResultCategory,
  QuestionResultRecord,
} from "@/features/question-session/types";
import {
  abandonStudySession,
  continueAfterStudySession,
  studyOverviewQueryKey,
  type StudyQuestion,
  type StudySession,
  type StudySummary,
} from "@/features/study/api/study";
import { useStudySession } from "@/features/study/hooks/useStudySession";
import { getTopicLabel } from "@/lib/displayLabels";
import { reloadAt } from "@/lib/pageNavigation";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";

const correctAnswerAdvanceDelay = 800;

export default function StudySessionPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialSession = useRef(
    readInitialSession(location.state, sessionId),
  ).current;

  useEffect(() => {
    if (!initialSession) return;
    navigate(location.pathname, { replace: true, state: null });
  }, [initialSession, location.pathname, navigate]);

  if (!sessionId) return <Navigate replace to="/" />;
  return (
    <StudySessionContent
      initialSession={initialSession}
      sessionId={sessionId}
    />
  );
}

function StudySessionContent({
  initialSession,
  sessionId,
}: {
  initialSession: StudySession | null;
  sessionId: string;
}) {
  const study = useStudySession(sessionId, initialSession);

  if (study.phase === "loading") return <StudyLoadingCard />;
  if (study.error || !study.session) {
    return (
      <StudyErrorCard
        message={study.error ?? "Bu oturum artık kullanılamıyor."}
        onRetry={() => void study.retryLoad()}
      />
    );
  }

  if (study.phase === "completed" || study.session.status === "Completed") {
    return <StudyCompletionCard session={study.session} />;
  }

  if (!study.session.question) return <Navigate replace to="/" />;
  return <StudyQuestionCard study={study} />;
}

type StudyState = ReturnType<typeof useStudySession>;

function StudyQuestionCard({ study }: { study: StudyState }) {
  const [isBrowsingResults, setIsBrowsingResults] = useState(false);
  const [selectedResultCategory, setSelectedResultCategory] =
    useState<QuestionResultCategory>("wrong");
  const [automaticAdvanceDelayElapsed, setAutomaticAdvanceDelayElapsed] =
    useState(false);
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const playedAnswerRef = useRef<string | null>(null);
  const session = study.session!;
  const question = session.question!;
  const displaySession = study.pendingSession ?? session;
  const answerOutcome = study.answer?.outcome ?? null;
  const hasAnswered = study.phase === "answered";
  const isSubmitting = study.phase === "submitting";
  const isLastQuestion = Boolean(study.answer?.isComplete);
  const isWrittenQuestion = question.kind === "Written";
  const canDeferCurrentSkill = !hasAnswered && study.phase === "answering";
  const shouldAutomaticallyAdvance = answerOutcome === "Correct";
  const resultGroups = toStudyResultGroups(displaySession.summary);

  useEffect(() => {
    setAutomaticAdvanceDelayElapsed(false);
    setIsBrowsingResults(false);
  }, [question.dimension, question.position, question.wordId]);

  useEffect(() => {
    if (isBrowsingResults) resultsRef.current?.focus();
    else titleRef.current?.focus();
  }, [
    isBrowsingResults,
    question.dimension,
    question.position,
    question.wordId,
  ]);

  useEffect(() => {
    if (!isBrowsingResults) return;
    const closeResults = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setIsBrowsingResults(false);
    };
    window.addEventListener("keydown", closeResults);
    return () => window.removeEventListener("keydown", closeResults);
  }, [isBrowsingResults]);

  useEffect(() => {
    if (!hasAnswered || !study.answer) return;
    const answerKey = `${question.position}:${study.answer.outcome}`;
    if (playedAnswerRef.current === answerKey) return;
    playedAnswerRef.current = answerKey;
    if (study.answer.outcome === "Correct") playCorrectSound();
    if (study.answer.outcome === "Wrong") playWrongSound();
  }, [hasAnswered, question.position, study.answer]);

  const advance = useCallback(() => study.advance(), [study]);

  useEffect(() => {
    if (!shouldAutomaticallyAdvance || !hasAnswered || isLastQuestion) return;
    const timeoutId = window.setTimeout(
      () => setAutomaticAdvanceDelayElapsed(true),
      correctAnswerAdvanceDelay,
    );
    return () => window.clearTimeout(timeoutId);
  }, [hasAnswered, isLastQuestion, shouldAutomaticallyAdvance]);

  useEffect(() => {
    if (
      !shouldAutomaticallyAdvance ||
      !automaticAdvanceDelayElapsed ||
      study.answerError ||
      isLastQuestion
    ) {
      return;
    }
    advance();
  }, [
    advance,
    automaticAdvanceDelayElapsed,
    isLastQuestion,
    shouldAutomaticallyAdvance,
    study.answerError,
  ]);

  useEffect(() => {
    if (
      question.kind !== "MultipleChoice" ||
      isBrowsingResults ||
      study.phase !== "answering" ||
      study.answerError
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
      const optionIndex = Number(event.key) - 1;
      if (!Number.isInteger(optionIndex) || optionIndex < 0) return;
      if (optionIndex >= question.options.length) return;
      event.preventDefault();
      study.answerChoice(optionIndex);
    };
    window.addEventListener("keydown", handleAnswerShortcut);
    return () => window.removeEventListener("keydown", handleAnswerShortcut);
  }, [isBrowsingResults, question, study]);

  useEffect(() => {
    if (
      question.kind !== "MultipleChoice" ||
      isBrowsingResults ||
      !hasAnswered ||
      answerOutcome === "Correct" ||
      study.answerError
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
      study.advance();
    };
    window.addEventListener("keydown", handleContinueShortcut);
    return () => window.removeEventListener("keydown", handleContinueShortcut);
  }, [answerOutcome, hasAnswered, isBrowsingResults, question.kind, study]);

  const toggleResultsBrowser = (category: QuestionResultCategory) => {
    if (study.phase === "confirmingDeferral" || study.phase === "deferring")
      return;
    if (isBrowsingResults && selectedResultCategory === category) {
      setIsBrowsingResults(false);
      return;
    }
    setSelectedResultCategory(category);
    setIsBrowsingResults(true);
  };

  const showAnswer = () => {
    playShowAnswerSound();
    study.showAnswer();
  };

  const confirmDeferral = async () => {
    if (await study.confirmDeferral()) {
      await queryClient.invalidateQueries({ queryKey: studyOverviewQueryKey });
    }
  };

  return (
    <QuestionSessionCard
      announcement={
        isBrowsingResults ? undefined : (
          <AnswerAnnouncement
            isLastQuestion={isLastQuestion}
            outcome={answerOutcome}
          />
        )
      }
      contentClassName={isBrowsingResults ? "p-0" : "px-6 pt-1.5 pb-2"}
      footer={
        <QuestionSessionStats
          correctCount={displaySession.progress.correctCount}
          isResultSelectionDisabled={
            isSubmitting ||
            shouldAutomaticallyAdvance ||
            study.phase === "confirmingDeferral" ||
            study.phase === "deferring"
          }
          reviewCount={displaySession.progress.reviewCount}
          reviewScoreLabel="Bilmiyorum cevapları"
          selectedResultCategory={
            isBrowsingResults ? selectedResultCategory : null
          }
          totalCount={displaySession.progress.totalCount}
          wrongCount={displaySession.progress.wrongCount}
          onResultSelect={toggleResultsBrowser}
        />
      }
      footerClassName="p-0"
      header={
        isBrowsingResults ? undefined : (
          <StudyCardHeader
            isReinforcement={displaySession.mode === "Review"}
            question={question}
            titleRef={titleRef}
          />
        )
      }
      layout="question"
    >
      {isBrowsingResults ? (
        <QuestionResultBrowser
          ref={resultsRef}
          layout="content"
          reviewRecords={resultGroups.review}
          selectedCategory={selectedResultCategory}
          wrongRecords={resultGroups.wrong}
          onCategoryChange={setSelectedResultCategory}
        />
      ) : isWrittenQuestion && study.deferral ? (
        <div className="flex h-full items-center justify-center">
          <StudySkillDeferralConfirmation
            error={study.deferral.error}
            isPending={study.phase === "deferring"}
            onCancel={study.cancelDeferral}
            onConfirm={() => void confirmDeferral()}
          />
        </div>
      ) : (
        <div
          className={cn(
            "min-h-0",
            isWrittenQuestion
              ? "relative h-full"
              : "grid h-full grid-rows-[minmax(0,1fr)_3rem] gap-1.5",
          )}
        >
          <div className="h-full min-h-0">
            {isWrittenQuestion ? (
              <WrittenAnswerField
                answerError={study.answerError}
                answerLanguage="İngilizce"
                answerOutcome={answerOutcome}
                canAdvance={hasAnswered}
                correctAnswers={
                  study.answer?.correctAnswer
                    ? [study.answer.correctAnswer]
                    : []
                }
                hasAnswered={hasAnswered}
                isLastQuestion={isLastQuestion}
                isLoading={isSubmitting}
                isSubmittingAnswer={isSubmitting}
                value={study.writtenAnswer}
                verticallyCentered
                onChange={study.setWrittenAnswer}
                onCheck={study.answerWritten}
                onContinue={study.advance}
                onRetryAnswer={study.retryAnswer}
                onShowAnswer={showAnswer}
              />
            ) : (
              <QuestionOptions
                correctIndex={study.answer?.correctIndex ?? null}
                hasAnswered={hasAnswered}
                isLoading={isSubmitting || Boolean(study.answerError)}
                isAnswerRevealed={answerOutcome === "Review"}
                options={question.options}
                selectedIndex={study.answer?.selectedIndex ?? null}
                onAnswer={study.answerChoice}
              />
            )}
          </div>

          {isWrittenQuestion ? (
            <div className="absolute inset-x-0 bottom-6">
              <StudySkillDeferralAction
                canDefer={canDeferCurrentSkill}
                dimension={question.dimension}
                onRequest={() => study.requestDeferral(question.dimension)}
              />
            </div>
          ) : null}

          {!isWrittenQuestion ? (
            <div className="flex min-w-0 items-center justify-center">
              {study.answerError ? (
                <Button
                  className={questionFlowButtonClassName}
                  disabled={isSubmitting}
                  type="button"
                  variant="outline"
                  onClick={study.retryAnswer}
                >
                  {isSubmitting ? "Kaydediliyor..." : "Kaydetmeyi tekrar dene"}
                </Button>
              ) : answerOutcome === "Correct" && !isLastQuestion ? (
                <QuestionAutoAdvanceNotice />
              ) : hasAnswered ? (
                <Button
                  className={questionFlowButtonClassName}
                  type="button"
                  variant="outline"
                  onClick={study.advance}
                >
                  {isLastQuestion ? "Sonuçları gör" : "Devam et"}
                </Button>
              ) : (
                <Button
                  className={questionRevealButtonClassName}
                  disabled={isSubmitting}
                  type="button"
                  variant="outline"
                  onClick={showAnswer}
                >
                  {isSubmitting ? "Kaydediliyor..." : "Cevabı göster"}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </QuestionSessionCard>
  );
}

function StudyCardHeader({
  isReinforcement,
  question,
  titleRef,
}: {
  isReinforcement: boolean;
  question: StudyQuestion;
  titleRef: RefObject<HTMLHeadingElement | null>;
}) {
  const [isReinforcementExplanationOpen, setReinforcementExplanationOpen] =
    useState(false);
  const lastPointerType = useRef<string | null>(null);
  const reinforcementTriggerRef = useRef<HTMLButtonElement>(null);
  const reinforcementExplanationRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isReinforcementExplanationOpen) return;

    const closeWhenPressingElsewhere = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        reinforcementTriggerRef.current?.contains(target) ||
        reinforcementExplanationRef.current?.contains(target)
      )
        return;

      setReinforcementExplanationOpen(false);
    };

    document.addEventListener("pointerdown", closeWhenPressingElsewhere);
    return () =>
      document.removeEventListener("pointerdown", closeWhenPressingElsewhere);
  }, [isReinforcementExplanationOpen]);

  return (
    <div className="relative grid h-12 grid-cols-[1fr_auto_1fr] items-center">
      <span aria-hidden="true" />
      <div className="flex min-w-0 items-center gap-1.5">
        {isReinforcement ? (
          <span className="flex shrink-0">
            <button
              aria-expanded={isReinforcementExplanationOpen}
              aria-label="Pekiştirme sorusu"
              className="rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              ref={reinforcementTriggerRef}
              type="button"
              onClick={() => {
                if (lastPointerType.current === "mouse") {
                  setReinforcementExplanationOpen(true);
                  return;
                }

                setReinforcementExplanationOpen((isOpen) => !isOpen);
              }}
              onPointerDown={(event) => {
                lastPointerType.current = event.pointerType;
              }}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse")
                  setReinforcementExplanationOpen(true);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse")
                  setReinforcementExplanationOpen(false);
              }}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
            </button>
          </span>
        ) : null}
        <h1
          ref={titleRef}
          className="min-w-0 truncate text-center text-xl/7 font-semibold outline-none sm:text-2xl/8"
          tabIndex={-1}
        >
          {question.prompt}
        </h1>
      </div>
      <span aria-hidden="true" />
      {isReinforcement && isReinforcementExplanationOpen ? (
        <span
          ref={reinforcementExplanationRef}
          className="type-helper absolute top-full left-1/2 z-10 w-max max-w-[calc(100%+3rem)] -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-center text-popover-foreground shadow-overlay"
          role="tooltip"
        >
          Daha önce çalıştığın bir kelimeyi pekiştiriyorsun.
        </span>
      ) : null}
    </div>
  );
}

function StudySkillDeferralAction({
  canDefer,
  dimension,
  onRequest,
}: {
  canDefer: boolean;
  dimension: StudyQuestion["dimension"];
  onRequest: () => void;
}) {
  const label = getSkillDeferralLabel(dimension);
  if (!canDefer || !label) return null;

  return (
    <div className="flex justify-center">
      <Button
        className="text-muted-foreground"
        type="button"
        variant="ghost"
        onClick={onRequest}
      >
        {label}
      </Button>
    </div>
  );
}

function StudySkillDeferralConfirmation({
  error,
  isPending,
  onCancel,
  onConfirm,
}: {
  error: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      aria-label="Yazma sorularını erteleme onayı"
      className="mx-auto grid w-full max-w-sm gap-3 px-1 text-center"
      role="group"
    >
      <h2 className="text-lg/6 font-semibold text-foreground">
        Yazma soruları 10 dakika ertelensin mi?
      </h2>
      {error ? <p className="type-helper text-destructive">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          disabled={isPending}
          size="sm"
          type="button"
          onClick={onConfirm}
        >
          {isPending ? "Erteleniyor..." : error ? "Tekrar dene" : "Ertele"}
        </Button>
        <Button
          disabled={isPending}
          size="sm"
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Vazgeç
        </Button>
      </div>
    </div>
  );
}

function StudyCompletionCard({ session }: { session: StudySession }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const groups = toStudyResultGroups(session.summary);
  const [selectedResultCategory, setSelectedResultCategory] =
    useState<QuestionResultCategory>(() =>
      groups.wrong.length > 0
        ? "wrong"
        : groups.review.length > 0
          ? "review"
          : "correct",
    );
  const continueStudy = useMutation({
    mutationFn: () => continueAfterStudySession(session.sessionId),
    onSuccess: (nextSession) => {
      void queryClient.invalidateQueries({ queryKey: studyOverviewQueryKey });
      navigate(`/session/${nextSession.sessionId}`, {
        replace: true,
        state: { session: nextSession },
      });
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        (error.status === 404 ||
          error.code === "study_session_owned_by_another_device")
      )
        reloadAt("/");
    },
  });
  const returnHome = useMutation({
    mutationFn: () => abandonStudySession(session.sessionId),
    onSettled: () => reloadAt("/"),
  });

  return (
    <main className="h-full min-h-0 overflow-y-auto overscroll-y-contain">
      <section className="mx-auto grid min-h-full w-full max-w-md content-start gap-0 px-6 py-10 sm:py-14">
        <header className="mb-7 grid gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="type-page-title">Oturum tamamlandı</h1>
            <p className="type-body text-muted-foreground">
              {session.mode === "Topic" && session.topic
                ? `${session.topic.level} · ${getTopicLabel(session.topic.topic)}`
                : "Pekiştirme çalışması"}
            </p>
          </div>
          {session.mode === "Topic" && session.topic ? (
            <CompletionTopicProgress topic={session.topic} />
          ) : null}
        </header>

        <QuestionResultBrowser
          layout="content"
          disabled={continueStudy.isPending || returnHome.isPending}
          correctRecords={groups.correct}
          reviewRecords={groups.review}
          selectedCategory={selectedResultCategory}
          wrongRecords={groups.wrong}
          onCategoryChange={setSelectedResultCategory}
        />

        <footer aria-label="Oturum eylemleri" className="grid w-full gap-2">
          {session.summary.canContinue ? (
            <Button
              disabled={continueStudy.isPending || returnHome.isPending}
              size="lg"
              type="button"
              onClick={() => continueStudy.mutate()}
            >
              {continueStudy.isPending ? "Hazırlanıyor..." : "Devam et"}
            </Button>
          ) : null}
          <Button
            disabled={continueStudy.isPending || returnHome.isPending}
            type="button"
            variant="ghost"
            onClick={() => returnHome.mutate()}
          >
            Ana sayfaya dön
          </Button>
          {continueStudy.isError ? (
            <p className="type-helper text-destructive" role="alert">
              Devam edilemedi. Lütfen tekrar dene.
            </p>
          ) : null}
        </footer>
      </section>
    </main>
  );
}

function CompletionTopicProgress({
  topic,
}: {
  topic: NonNullable<StudySession["topic"]>;
}) {
  const progress =
    topic.wordCount === 0
      ? 0
      : Math.round((topic.introducedWordCount / topic.wordCount) * 100);

  return (
    <section aria-label="Konu ilerlemesi" className="grid w-full gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="type-label text-foreground">Konu ilerlemesi</p>
        <p className="type-helper tabular-nums">
          {topic.introducedWordCount} / {topic.wordCount} kelime
        </p>
      </div>
      <div
        aria-valuemax={topic.wordCount}
        aria-valuemin={0}
        aria-valuenow={topic.introducedWordCount}
        aria-valuetext={`${topic.introducedWordCount} / ${topic.wordCount} kelime`}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div
          aria-hidden="true"
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );
}

function StudyErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <QuestionSessionCard
      footer={
        <Link className={buttonVariants({ variant: "outline" })} to="/">
          Ana sayfaya dön
        </Link>
      }
      footerClassName="justify-center"
      header={
        <QuestionSessionCardTitle>
          <h1>Kullanılamıyor</h1>
        </QuestionSessionCardTitle>
      }
    >
      <div className="flex h-full items-center">
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Oturum açılamadı</AlertTitle>
          <AlertDescription className="grid gap-3">
            <p>{message}</p>
            <Button size="sm" onClick={onRetry}>
              Tekrar dene
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    </QuestionSessionCard>
  );
}

function StudyLoadingCard() {
  return (
    <QuestionSessionCard
      footer={<Skeleton className="h-4 w-40" />}
      footerClassName="justify-center"
      header={<Skeleton className="mx-auto h-8 w-48" />}
    >
      <QuestionSkeleton />
    </QuestionSessionCard>
  );
}

type StudyResultGroups = Record<QuestionResultCategory, QuestionResultRecord[]>;

function toStudyResultGroups(summary: StudySummary): StudyResultGroups {
  const groups: StudyResultGroups = { correct: [], review: [], wrong: [] };
  summary.results.forEach((result, index) => {
    const category =
      result.outcome === "Review"
        ? "review"
        : result.outcome === "Wrong"
          ? "wrong"
          : "correct";
    groups[category].push({
      key: `${result.wordId}-${result.dimension}-${index}`,
      correctAnswer: result.correctAnswer,
      formatLabel: getStudyDimensionLabel(result.dimension),
      prompt: result.prompt,
      selectedAnswer: result.selectedAnswer,
    });
  });
  return groups;
}

/**
 * Only skills a learner can be physically unable to perform right now can be
 * put aside. Picking the meaning from a list always works, so it has no entry
 * — and the aural and spoken entries light up on their own once those question
 * kinds start being planned.
 */
function getSkillDeferralLabel(dimension: StudyQuestion["dimension"]) {
  const deferrals = {
    WrittenRecall: "Şimdi yazamam",
    AuralRecognition: "Şimdi dinleyemem",
    SpokenRecall: "Şimdi konuşamam",
    WrittenRecognition: null,
  } satisfies Record<StudyQuestion["dimension"], string | null>;
  return deferrals[dimension];
}

function getStudyDimensionLabel(dimension: string) {
  if (dimension === "WrittenRecognition") return "Seçmeli";
  if (dimension === "WrittenRecall") return "Yazılı";
  if (dimension === "AuralRecognition") return "Dinleme";
  return "Konuşma";
}

function readInitialSession(state: unknown, sessionId: string | undefined) {
  if (
    !state ||
    typeof state !== "object" ||
    !sessionId ||
    !("session" in state)
  ) {
    return null;
  }
  const session = (state as { session?: StudySession }).session;
  return session?.sessionId === sessionId ? session : null;
}
