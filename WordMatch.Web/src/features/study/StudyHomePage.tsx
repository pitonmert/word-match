import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Play,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import {
  continueStudySession,
  fetchStudyOverview,
  startStudySession,
  studyOverviewQueryKey,
  takeOverStudySession,
  type StudyLevel,
  type StudyTopic,
} from "@/features/study/api/study";
import { getTopicLabel } from "@/lib/displayLabels";
import { cn } from "@/lib/utils";

export default function StudyHomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isTopicPickerOpen, setTopicPickerOpen] = useState(false);
  const [replacementTopicId, setReplacementTopicId] = useState<number | null>(
    null,
  );
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const overview = useQuery({
    queryKey: studyOverviewQueryKey,
    queryFn: ({ signal }) => fetchStudyOverview(signal),
  });
  const openSession = (
    session: Awaited<ReturnType<typeof startStudySession>>,
  ) => {
    setTopicPickerOpen(false);
    setReplacementTopicId(null);
    void queryClient.invalidateQueries({ queryKey: studyOverviewQueryKey });
    navigate(`/session/${session.sessionId}`, { state: { session } });
  };
  const continueSession = useMutation({
    mutationFn: continueStudySession,
    onSuccess: openSession,
  });
  const startSession = useMutation({
    mutationFn: startStudySession,
    onSuccess: openSession,
  });
  const takeOverSession = useMutation({
    mutationFn: takeOverStudySession,
    onSuccess: openSession,
  });

  if (overview.isLoading) return <StudyHomeSkeleton />;
  if (overview.isError || !overview.data) {
    return <StudyHomeError onRetry={() => void overview.refetch()} />;
  }

  const { curriculumTopic, nextAction, levels } = overview.data;
  const topics = levels.flatMap((level) => level.topics);
  const selectedTopic =
    selectedTopicId === null
      ? null
      : (topics.find((topic) => topic.id === selectedTopicId) ?? null);
  const actionTopic = selectedTopic ?? nextAction?.topic ?? curriculumTopic;
  const actionTopicIndex = actionTopic
    ? topics.findIndex((topic) => topic.id === actionTopic.id)
    : -1;
  const previousTopic =
    actionTopicIndex > 0 ? topics[actionTopicIndex - 1] : null;
  const nextTopic =
    actionTopicIndex >= 0 && actionTopicIndex < topics.length - 1
      ? topics[actionTopicIndex + 1]
      : null;
  const isPending =
    continueSession.isPending ||
    startSession.isPending ||
    takeOverSession.isPending;
  const startError =
    continueSession.error ?? startSession.error ?? takeOverSession.error;
  const isUnavailable =
    nextAction?.kind === "Unavailable" ||
    isSessionOpenOnAnotherDevice(startError);

  const chooseTopic = (curriculumTopicId: number) => {
    setSelectedTopicId(curriculumTopicId);
    setTopicPickerOpen(false);
  };

  const beginSelectedTopic = () => {
    if (selectedTopic === null) {
      continueSession.mutate();
      return;
    }

    if (
      nextAction?.kind === "Resume" &&
      nextAction.topic?.id !== selectedTopic.id
    ) {
      setReplacementTopicId(selectedTopic.id);
      return;
    }

    if (nextAction?.kind === "Resume") {
      continueSession.mutate();
      return;
    }

    startSession.mutate({
      mode: "Topic",
      curriculumTopicId: selectedTopic.id,
    });
  };

  return (
    <main className="h-full overflow-y-auto overscroll-y-contain bg-background-100/50">
      <div className="mx-auto grid min-h-full w-full max-w-2xl content-center gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <>
          <div className="grid gap-3">
            {actionTopic ? (
              <TopicNavigation
                nextTopic={nextTopic}
                previousTopic={previousTopic}
                onShowAllTopics={() => setTopicPickerOpen(true)}
                onSelect={setSelectedTopicId}
              />
            ) : null}

            <Card className="grid gap-5 border-border bg-card px-5 py-6 shadow-surface">
              {actionTopic ? (
                <section aria-label="Konu özeti" className="grid gap-6">
                  <header className="grid justify-items-center gap-2 text-center">
                    <p className="type-label text-muted-foreground">
                      {actionTopic.level}
                    </p>
                    <h1 className="type-page-title">
                      {getTopicLabel(actionTopic.topic)}
                    </h1>
                  </header>
                  <TopicProgress topic={actionTopic} />
                </section>
              ) : (
                <header className="grid justify-items-center gap-1 text-center">
                  <h1 className="type-page-title">
                    {nextAction?.kind === "Resume"
                      ? "Pekiştirme"
                      : "Tüm konuları tamamladın"}
                  </h1>
                  <Button
                    className="rounded-full border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:bg-primary-50 hover:text-foreground active:bg-primary-100"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => setTopicPickerOpen(true)}
                  >
                    Tüm Konular
                  </Button>
                </header>
              )}
            </Card>
          </div>

          {startError && !isUnavailable ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Oturum başlatılamadı</AlertTitle>
              <AlertDescription>
                {getStartErrorMessage(startError)}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            {isUnavailable ? (
              <StudyUnavailableNotice
                isPending={takeOverSession.isPending}
                onTakeOver={() => takeOverSession.mutate()}
              />
            ) : nextAction ? (
              <Button
                className="justify-center"
                disabled={isPending}
                size="lg"
                type="button"
                onClick={beginSelectedTopic}
              >
                <Play data-icon="inline-start" />
                {isPending ? "Oturum açılıyor..." : "Başla"}
              </Button>
            ) : null}
          </div>
        </>

        <Dialog open={isTopicPickerOpen} onOpenChange={setTopicPickerOpen}>
          <DialogContent
            aria-label="Konu seç"
            className="h-[calc(100dvh-2rem)] max-w-xl overflow-hidden transition-opacity duration-200 data-ending-style:scale-100 data-starting-style:scale-100 sm:h-[min(42rem,calc(100dvh-4rem))]"
          >
            <TopicSelection
              currentTopicId={actionTopic?.id ?? curriculumTopic?.id ?? null}
              levels={levels}
              onClose={() => setTopicPickerOpen(false)}
              onSelect={chooseTopic}
            />
          </DialogContent>
        </Dialog>

        <TopicReplacementConfirmation
          isPending={startSession.isPending}
          open={replacementTopicId !== null}
          onCancel={() => setReplacementTopicId(null)}
          onConfirm={() => {
            if (replacementTopicId === null) return;
            startSession.mutate({
              mode: "Topic",
              curriculumTopicId: replacementTopicId,
              replaceActiveSession: true,
            });
          }}
        />
      </div>
    </main>
  );
}

function TopicReplacementConfirmation({
  isPending,
  open,
  onCancel,
  onConfirm,
}: {
  isPending: boolean;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onCancel()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Çalışma değiştirilsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            Devam eden çalışma kapanacak. Cevapladığın sorular ve ilerlemen
            korunur.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={
              <Button disabled={isPending} type="button" variant="outline">
                Vazgeç
              </Button>
            }
          />
          <Button disabled={isPending} type="button" onClick={onConfirm}>
            {isPending ? "Açılıyor..." : "Konuya geç"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TopicSelection({
  currentTopicId,
  levels,
  onClose,
  onSelect,
}: {
  currentTopicId: number | null;
  levels: ReadonlyArray<StudyLevel>;
  onClose: () => void;
  onSelect: (curriculumTopicId: number) => void;
}) {
  const initialLevel =
    levels.find((level) =>
      level.topics.some((topic) => topic.id === currentTopicId),
    )?.level ??
    levels[0]?.level ??
    null;
  const [openLevels, setOpenLevels] = useState(
    () => new Set(initialLevel ? [initialLevel] : []),
  );

  const setLevelOpen = (level: string, isOpen: boolean) => {
    setOpenLevels((current) => {
      const next = new Set(current);
      if (isOpen) next.add(level);
      else next.delete(level);
      return next;
    });
  };

  return (
    <section aria-label="Konu seçimi" className="flex h-full flex-col">
      <header className="mb-3 flex items-center justify-between">
        <DialogTitle className="sr-only">Konu seç</DialogTitle>
        <Button
          aria-label="Konu seçimini kapat"
          className="text-muted-foreground hover:text-foreground"
          size="icon-sm"
          type="button"
          variant="outline"
          onClick={onClose}
        >
          <X />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1" contentClassName="pr-3">
        <div className="grid gap-4 pb-1">
          {levels.map((level) => (
            <Collapsible
              key={level.level}
              open={openLevels.has(level.level)}
              onOpenChange={(isOpen) => setLevelOpen(level.level, isOpen)}
            >
              <CollapsibleTrigger
                aria-label={`${level.level}, ${level.topics.length} konu`}
                className="group flex min-h-10 w-full items-center justify-between rounded-lg px-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 active:bg-background-200"
              >
                <span className="flex items-baseline gap-2">
                  <span className="type-card-title text-foreground">
                    {level.level}
                  </span>
                  <span className="type-helper tabular-nums">
                    {level.topics.length} konu
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="text-muted-foreground transition-transform duration-150 group-data-panel-open:rotate-180"
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <ul
                  aria-label={`${level.level} konuları`}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {level.topics.map((topic) => {
                    const isCurrent = topic.id === currentTopicId;
                    return (
                      <li data-slot="topic-card" key={topic.id}>
                        <button
                          aria-pressed={isCurrent}
                          className={cn(
                            "grid min-h-24 w-full content-between gap-4 rounded-xl border bg-background p-4 text-left transition-[background-color,border-color,transform] hover:border-primary/50 hover:bg-primary-50 active:translate-y-px active:bg-primary-100",
                            isCurrent && "border-primary",
                          )}
                          type="button"
                          onClick={() => onSelect(topic.id)}
                        >
                          <span className="flex items-start gap-2">
                            <span
                              className={cn(
                                "type-card-title min-w-0 flex-1",
                                isCurrent && "text-primary",
                              )}
                            >
                              {getTopicLabel(topic.topic)}
                            </span>
                            {topic.isCompleted ? (
                              <Check
                                aria-label="tamamlandı"
                                className="mt-0.5 size-4 shrink-0 text-primary"
                              />
                            ) : null}
                          </span>
                          <div className="grid gap-2">
                            <TopicProgressBar
                              ariaLabel={`${getTopicLabel(topic.topic)} ilerlemesi`}
                              topic={topic}
                            />
                            <p className="type-helper text-center text-muted-foreground tabular-nums">
                              {formatTopicCompletion(topic)}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}

function TopicProgress({ topic }: { topic: StudyTopic }) {
  const nextStepCount = Math.max(
    0,
    topic.recognitionWordCount - topic.introducedWordCount,
  );

  return (
    <section aria-label="Konu ilerlemesi" className="grid gap-2">
      <TopicProgressBar ariaLabel="Konu ilerlemesi" showTestIds topic={topic} />
      <p className="type-helper text-center text-muted-foreground tabular-nums">
        {formatTopicCompletion(topic)}
      </p>
      {nextStepCount > 0 ? (
        <p className="type-helper text-center text-muted-foreground">
          {nextStepCount} kelimeyi yazman kaldı
        </p>
      ) : null}
    </section>
  );
}

function TopicNavigation({
  nextTopic,
  previousTopic,
  onShowAllTopics,
  onSelect,
}: {
  nextTopic: StudyTopic | null;
  previousTopic: StudyTopic | null;
  onShowAllTopics: () => void;
  onSelect: (topicId: number) => void;
}) {
  return (
    <nav
      aria-label="Konu gezintisi"
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 sm:gap-6"
    >
      {previousTopic ? (
        <Button
          aria-label={`Önceki konu: ${getTopicLabel(previousTopic.topic)}`}
          className="min-w-0 justify-start px-0 text-muted-foreground hover:bg-transparent hover:text-foreground active:bg-transparent active:text-foreground"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => onSelect(previousTopic.id)}
        >
          <ChevronLeft data-icon="inline-start" />
          <span className="truncate">{getTopicLabel(previousTopic.topic)}</span>
        </Button>
      ) : (
        <span aria-hidden="true" />
      )}

      <Button
        className="rounded-full border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:bg-primary-50 hover:text-foreground active:bg-primary-100"
        size="xs"
        type="button"
        variant="outline"
        onClick={onShowAllTopics}
      >
        Tüm Konular
      </Button>

      {nextTopic ? (
        <Button
          aria-label={`Sonraki konu: ${getTopicLabel(nextTopic.topic)}`}
          className="min-w-0 justify-end px-0 text-muted-foreground hover:bg-transparent hover:text-foreground active:bg-transparent active:text-foreground"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => onSelect(nextTopic.id)}
        >
          <span className="truncate">{getTopicLabel(nextTopic.topic)}</span>
          <ChevronRight data-icon="inline-end" />
        </Button>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}

function TopicProgressBar({
  ariaLabel,
  showTestIds = false,
  topic,
}: {
  ariaLabel: string;
  showTestIds?: boolean;
  topic: StudyTopic;
}) {
  const completedPercentage =
    topic.wordCount === 0
      ? 0
      : Math.round((topic.introducedWordCount / topic.wordCount) * 100);

  return (
    <div
      aria-label={ariaLabel}
      aria-valuemax={topic.wordCount}
      aria-valuemin={0}
      aria-valuenow={topic.introducedWordCount}
      aria-valuetext={`${formatTopicCompletion(topic)}.`}
      className="h-1.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
    >
      <div
        aria-hidden="true"
        className="h-full bg-primary transition-[width] duration-300"
        data-testid={showTestIds ? "completion-progress" : undefined}
        style={{ width: `${completedPercentage}%` }}
      />
    </div>
  );
}

function formatTopicCompletion(topic: StudyTopic) {
  return `${topic.introducedWordCount} / ${topic.wordCount} kelime`;
}

// Must match StudyService.SessionOwnedByAnotherDeviceCode on the API — a stable
// contract independent of the human-facing message, which may change or be
// localized without breaking this check.
const sessionOwnedByAnotherDeviceCode = "study_session_owned_by_another_device";

function isSessionOpenOnAnotherDevice(error: unknown) {
  return (
    error instanceof ApiError && error.code === sessionOwnedByAnotherDeviceCode
  );
}

function StudyUnavailableNotice({
  isPending,
  onTakeOver,
}: {
  isPending: boolean;
  onTakeOver: () => void;
}) {
  return (
    <Card
      aria-live="polite"
      className="border-primary/25 bg-primary-50/70 px-5 py-4 shadow-none dark:bg-primary-950/30"
      role="status"
    >
      <div className="flex items-start gap-3">
        <Monitor
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-primary"
        />
        <div className="grid gap-3">
          <div className="grid gap-1">
            <h2 className="type-card-title">Çalışma başka bir cihazda açık</h2>
            <p className="type-body text-muted-foreground">
              Bu cihazdan devam edersen diğer cihazdaki çalışma durur.
            </p>
          </div>
          <Button
            className="justify-self-start"
            disabled={isPending}
            size="sm"
            type="button"
            onClick={onTakeOver}
          >
            {isPending ? "Devralınıyor..." : "Bu cihazdan devam et"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function getStartErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.message) return error.message;
  return "Lütfen yeniden dene.";
}

function StudyHomeError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grid h-full place-items-center bg-background-100/50 px-4">
      <Alert className="max-w-md" variant="destructive">
        <TriangleAlert />
        <AlertTitle>Study alanı yüklenemedi</AlertTitle>
        <AlertDescription className="grid gap-3">
          <p>Çalışma bilgileri alınırken bir sorun oluştu.</p>
          <Button
            className="justify-self-start"
            type="button"
            onClick={onRetry}
          >
            <RefreshCw data-icon="inline-start" />
            Tekrar dene
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  );
}

function StudyHomeSkeleton() {
  return (
    <main
      aria-label="Study yükleniyor"
      className="h-full overflow-y-auto bg-background-100/50"
    >
      <div className="mx-auto grid min-h-full w-full max-w-2xl content-center gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <section className="grid gap-5 rounded-2xl bg-background px-5 py-6">
          <div className="grid justify-items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-72" />
          </div>
          <div className="grid gap-2 border-t pt-5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        </section>
        <div className="grid gap-2">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </div>
    </main>
  );
}
