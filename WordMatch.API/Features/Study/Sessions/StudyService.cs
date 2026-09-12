using Microsoft.EntityFrameworkCore;
using Npgsql;
using WordMatch.API.Data;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Study;

public sealed class StudyService(
    ApplicationDbContext db,
    StudyPlanner planner,
    StudyQuestionFactory questionFactory,
    TimeProvider timeProvider,
    IHttpContextAccessor httpContextAccessor,
    StudyDeviceIdentity devices
)
{
    private const string ServerDefaultDeviceId = "server-default-device";

    private const string SessionOwnedByAnotherDeviceCode = "study_session_owned_by_another_device";

    private string GetCurrentDeviceId() =>
        httpContextAccessor.HttpContext is { } context
            ? devices.GetOrCreateDeviceId(context)
            : ServerDefaultDeviceId;

    private static bool IsSessionAvailableToDevice(StudySession session, string deviceId) =>
        session.OwnerDeviceId == deviceId;

    public async Task<StudyOverviewResponse> GetOverviewAsync(
        string userId,
        CancellationToken cancellationToken
    )
    {
        var deviceId = GetCurrentDeviceId();
        var topics = await LoadCurriculumTopicsAsync(cancellationToken);
        var answeredDimensions = await LoadAnsweredDimensionsAsync(userId, cancellationToken);
        var completedWordIds = GetCompletedWordIds(answeredDimensions);
        var recognitionWordIds = GetAnsweredWordIds(
            answeredDimensions,
            VocabularyMasteryDimension.WrittenRecognition
        );
        var now = timeProvider.GetUtcNow();
        var pausedDimensions = await LoadPausedDimensionsAsync(userId, now, cancellationToken);
        var activeTopics = topics
            .Where(item => item.Status == CurriculumTopicStatus.Active)
            .ToList();
        var curriculumTopic = FindCurrentTopic(activeTopics, answeredDimensions);
        var plannableTopic = FindCurrentPlannableTopic(
            activeTopics,
            answeredDimensions,
            pausedDimensions
        );
        var canStartReview = HasCompletedTopic(activeTopics, completedWordIds);
        var activeSession = await db
            .StudySessions.AsNoTracking()
            .Include(item => item.CurriculumTopic)
                .ThenInclude(item => item!.Words)
            .AsSplitQuery()
            .SingleOrDefaultAsync(
                item => item.UserId == userId && item.Status == StudySessionStatus.Active,
                cancellationToken
            );
        var continuationReservation = activeSession is null
            ? await db
                .StudySessions.AsNoTracking()
                .Include(item => item.CurriculumTopic)
                    .ThenInclude(item => item!.Words)
                .AsSplitQuery()
                .Where(item =>
                    item.UserId == userId
                    && item.Status == StudySessionStatus.Completed
                    && item.ContinuationReservedAtUtc != null
                )
                .OrderByDescending(item => item.ContinuationReservedAtUtc)
                .FirstOrDefaultAsync(cancellationToken)
            : null;
        var session = activeSession ?? continuationReservation;
        var isSessionAvailable =
            session is not null && IsSessionAvailableToDevice(session, deviceId);
        var nextActionTopic =
            session?.Status == StudySessionStatus.Active ? session.CurriculumTopic : plannableTopic;
        var nextAction =
            session is not null
                ? new StudyNextActionResponse(
                    isSessionAvailable
                        ? StudyNextActionKind.Resume
                        : StudyNextActionKind.Unavailable,
                    isSessionAvailable ? session.Id : null,
                    nextActionTopic is null
                        ? null
                        : ToTopicResponse(nextActionTopic, completedWordIds, recognitionWordIds)
                )
            : plannableTopic is null ? null
            : new StudyNextActionResponse(
                StudyNextActionKind.StartTopic,
                null,
                ToTopicResponse(plannableTopic, completedWordIds, recognitionWordIds)
            );

        return new StudyOverviewResponse(
            curriculumTopic is null
                ? null
                : ToTopicResponse(curriculumTopic, completedWordIds, recognitionWordIds),
            curriculumTopic is null,
            canStartReview
                ? await CountReviewQuestionsAsync(
                    userId,
                    topics,
                    answeredDimensions,
                    cancellationToken
                )
                : 0,
            nextAction,
            activeTopics
                .GroupBy(item => item.Level)
                .OrderBy(group => group.Key)
                .Select(group => new StudyLevelResponse(
                    group.Key,
                    group
                        .OrderBy(item => item.SortOrder)
                        .Select(item => ToTopicResponse(item, completedWordIds, recognitionWordIds))
                        .ToList()
                ))
                .ToList()
        );
    }

    public async Task<StartStudySessionResult> StartOrResumeAsync(
        string userId,
        StartStudySessionRequest request,
        CancellationToken cancellationToken
    )
    {
        var deviceId = GetCurrentDeviceId();
        if (request.Mode == StudySessionMode.Review && request.CurriculumTopicId is not null)
            throw new StudyValidationException("Tekrar oturumu konu seçimi kabul etmez.");
        if (request.ReplaceActiveSession && request.CurriculumTopicId is null)
            throw new StudyValidationException(
                "Yalnızca seçilen bir konu mevcut çalışmanın yerine geçebilir."
            );

        if (request.Mode == StudySessionMode.Topic && request.CurriculumTopicId is null)
            return await ContinueAsync(userId, cancellationToken);

        var topics = await LoadCurriculumTopicsAsync(cancellationToken);
        var answeredDimensions = await LoadAnsweredDimensionsAsync(userId, cancellationToken);
        var completedWordIds = GetCompletedWordIds(answeredDimensions);
        var canStartReview = HasCompletedTopic(topics, completedWordIds);
        var now = timeProvider.GetUtcNow();
        var pausedDimensions = await LoadPausedDimensionsAsync(userId, now, cancellationToken);
        var targetTopic =
            request.Mode == StudySessionMode.Topic
                ? ResolveExplicitTopic(topics, request.CurriculumTopicId)
                : null;

        var activeSession = await db.StudySessions.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Status == StudySessionStatus.Active,
            cancellationToken
        );
        await EnsureActiveSessionIsOwnedAsync(activeSession, deviceId, cancellationToken);
        if (activeSession is null)
            _ = await ReleaseOwnContinuationReservationAsync(userId, deviceId, cancellationToken);
        if (
            activeSession is not null
            && activeSession.Mode == request.Mode
            && activeSession.CurriculumTopicId == targetTopic?.Id
        )
        {
            return new StartStudySessionResult(
                false,
                await GetAsync(userId, activeSession.Id, cancellationToken)
            );
        }

        if (request.Mode == StudySessionMode.Review && !canStartReview)
            throw new StudyConflictException(
                "Tekrar oturumu açmadan önce bir konunun tüm kelimelerini tamamlayın."
            );

        if (
            request.Mode == StudySessionMode.Review
            && activeSession?.Mode == StudySessionMode.Topic
        )
            throw new StudyConflictException(
                "Mevcut konu oturumunu tamamlamadan tekrar oturumuna geçemezsiniz."
            );

        if (activeSession is not null && !request.ReplaceActiveSession)
            throw new StudyConflictException(
                "Devam eden çalışman var. Konuyu değiştirmek için onayla."
            );

        if (activeSession is not null)
        {
            activeSession.Status = StudySessionStatus.Abandoned;
            activeSession.LastActivityAtUtc = now;
        }

        var plan = await CreatePlanAsync(
            userId,
            request.Mode,
            targetTopic,
            topics,
            answeredDimensions,
            pausedDimensions,
            new HashSet<StudyQuestionKey>(),
            request.Mode == StudySessionMode.Review ? StudyPlanner.ReviewSessionSize : int.MaxValue,
            now,
            cancellationToken
        );
        if (plan.Count == 0)
            throw new StudyConflictException(
                request.Mode == StudySessionMode.Topic
                    ? targetTopic!.Words.Any(word =>
                        StudyPlanner.SupportedDimensions.Any(dimension =>
                            !answeredDimensions.Contains(
                                new StudyQuestionKey(word.WordId, dimension)
                            )
                        )
                    )
                        ? "Bu konuda şu an çalışılabilecek soru yok."
                        : "Bu konudaki tüm kelimeler tanıtıldı."
                    : "Şu anda tekrar edilecek kelime yok."
            );

        var session = new StudySession
        {
            UserId = userId,
            OwnerDeviceId = deviceId,
            Mode = request.Mode,
            CurriculumTopicId = targetTopic?.Id,
            StartedAtUtc = now,
            LastActivityAtUtc = now,
        };
        AppendQuestions(session, plan, await LoadAllWordsAsync(cancellationToken), 0);

        return await SaveNewSessionAsync(userId, deviceId, session, cancellationToken);
    }

    public async Task<StartStudySessionResult> ContinueAsync(
        string userId,
        CancellationToken cancellationToken
    )
    {
        var deviceId = GetCurrentDeviceId();
        var activeSession = await db.StudySessions.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Status == StudySessionStatus.Active,
            cancellationToken
        );
        await EnsureActiveSessionIsOwnedAsync(activeSession, deviceId, cancellationToken);
        if (activeSession?.Mode == StudySessionMode.Topic)
        {
            return new StartStudySessionResult(
                false,
                await GetAsync(userId, activeSession.Id, cancellationToken)
            );
        }

        var continuationReservation = activeSession is null
            ? await ReleaseOwnContinuationReservationAsync(userId, deviceId, cancellationToken)
            : null;
        if (continuationReservation is not null)
            continuationReservation.ContinuationReservedAtUtc = null;

        return await StartTopicContinuationAsync(
            userId,
            null,
            activeSession,
            cancellationToken,
            deviceId,
            continuationReservation
        );
    }

    public async Task<StartStudySessionResult> ContinueAfterCompletionAsync(
        string userId,
        Guid sessionId,
        CancellationToken cancellationToken
    )
    {
        var deviceId = GetCurrentDeviceId();
        var sourceSession = await LoadContinuationReservationAsync(
            userId,
            sessionId,
            cancellationToken
        );
        if (sourceSession is null)
            throw new StudyNotFoundException();
        await EnsureContinuationReservationIsOwnedAsync(sourceSession, deviceId, cancellationToken);

        return await ContinueCompletedSessionAsync(
            userId,
            sourceSession,
            cancellationToken,
            deviceId
        );
    }

    public async Task<StudySessionResponse> TakeOverAsync(
        string userId,
        CancellationToken cancellationToken
    )
    {
        var deviceId = GetCurrentDeviceId();
        var session =
            await db
                .StudySessions.AsNoTracking()
                .Where(item =>
                    item.UserId == userId
                    && (
                        item.Status == StudySessionStatus.Active
                        || (
                            item.Status == StudySessionStatus.Completed
                            && item.ContinuationReservedAtUtc != null
                        )
                    )
                )
                .OrderByDescending(item => item.Status == StudySessionStatus.Active)
                .ThenByDescending(item => item.LastActivityAtUtc)
                .FirstOrDefaultAsync(cancellationToken)
            ?? throw new StudyNotFoundException();

        if (session.OwnerDeviceId != deviceId)
        {
            var claimed = await db
                .StudySessions.Where(item =>
                    item.Id == session.Id
                    && item.UserId == userId
                    && item.OwnerDeviceId == session.OwnerDeviceId
                    && (
                        item.Status == StudySessionStatus.Active
                        || (
                            item.Status == StudySessionStatus.Completed
                            && item.ContinuationReservedAtUtc != null
                        )
                    )
                )
                .ExecuteUpdateAsync(
                    setters =>
                        setters
                            .SetProperty(item => item.OwnerDeviceId, deviceId)
                            .SetProperty(item => item.LastActivityAtUtc, timeProvider.GetUtcNow()),
                    cancellationToken
                );
            if (claimed == 0)
                throw new StudyConflictException("Çalışma durumu değişti. Lütfen tekrar deneyin.");
        }

        return await GetAsync(userId, session.Id, cancellationToken);
    }

    private async Task<StartStudySessionResult> ContinueCompletedSessionAsync(
        string userId,
        StudySession sourceSession,
        CancellationToken cancellationToken,
        string deviceId
    )
    {
        if (sourceSession.Status != StudySessionStatus.Completed)
            throw new StudyConflictException("Önce mevcut çalışmayı tamamlayın.");

        var activeSessionExists = await db
            .StudySessions.AsNoTracking()
            .AnyAsync(
                item => item.UserId == userId && item.Status == StudySessionStatus.Active,
                cancellationToken
            );
        if (activeSessionExists)
            throw new StudyConflictException("Devam eden bir çalışma zaten açık.");

        var topics = await LoadCurriculumTopicsAsync(cancellationToken);
        var answeredDimensions = await LoadAnsweredDimensionsAsync(userId, cancellationToken);
        var now = timeProvider.GetUtcNow();
        var pausedDimensions = await LoadPausedDimensionsAsync(userId, now, cancellationToken);
        var reviewPlan = await CreatePlanAsync(
            userId,
            StudySessionMode.Review,
            null,
            topics,
            answeredDimensions,
            pausedDimensions,
            new HashSet<StudyQuestionKey>(),
            StudyPlanner.ReviewSessionSize,
            now,
            cancellationToken
        );
        var returnTopicId =
            sourceSession.Mode == StudySessionMode.Topic
                ? sourceSession.CurriculumTopicId
                : sourceSession.ReturnToCurriculumTopicId;
        if (reviewPlan.Count > 0)
        {
            var reviewSession = new StudySession
            {
                UserId = userId,
                OwnerDeviceId = deviceId,
                Mode = StudySessionMode.Review,
                ReturnToCurriculumTopicId = returnTopicId,
                StartedAtUtc = now,
                LastActivityAtUtc = now,
            };
            AppendQuestions(
                reviewSession,
                reviewPlan,
                await LoadAllWordsAsync(cancellationToken),
                0
            );

            sourceSession.ContinuationReservedAtUtc = null;

            return await SaveNewSessionAsync(userId, deviceId, reviewSession, cancellationToken);
        }

        return await StartTopicContinuationAsync(
            userId,
            returnTopicId,
            null,
            cancellationToken,
            deviceId,
            sourceSession
        );
    }

    private async Task<StartStudySessionResult> StartTopicContinuationAsync(
        string userId,
        int? preferredTopicId,
        StudySession? sessionToAbandon,
        CancellationToken cancellationToken,
        string deviceId,
        StudySession? continuationReservation = null
    )
    {
        var topics = await LoadCurriculumTopicsAsync(cancellationToken);
        var answeredDimensions = await LoadAnsweredDimensionsAsync(userId, cancellationToken);
        var now = timeProvider.GetUtcNow();
        var pausedDimensions = await LoadPausedDimensionsAsync(userId, now, cancellationToken);
        var preferredTopic = preferredTopicId is null
            ? null
            : topics.SingleOrDefault(item =>
                item.Id == preferredTopicId && item.Status == CurriculumTopicStatus.Active
            );
        var targetTopic =
            preferredTopic is not null
            && IsTopicPlannable(preferredTopic, answeredDimensions, pausedDimensions)
                ? preferredTopic
                : ResolveNextPlannableTopic(topics, answeredDimensions, pausedDimensions);
        var plan = await CreatePlanAsync(
            userId,
            StudySessionMode.Topic,
            targetTopic,
            topics,
            answeredDimensions,
            pausedDimensions,
            new HashSet<StudyQuestionKey>(),
            int.MaxValue,
            now,
            cancellationToken
        );
        if (plan.Count == 0)
            throw new StudyConflictException("Şu an çalışılabilecek soru yok.");

        if (sessionToAbandon is not null)
        {
            sessionToAbandon.Status = StudySessionStatus.Abandoned;
            sessionToAbandon.LastActivityAtUtc = now;
        }
        if (continuationReservation is not null)
            continuationReservation.ContinuationReservedAtUtc = null;

        var session = new StudySession
        {
            UserId = userId,
            OwnerDeviceId = deviceId,
            Mode = StudySessionMode.Topic,
            CurriculumTopicId = targetTopic.Id,
            StartedAtUtc = now,
            LastActivityAtUtc = now,
        };
        AppendQuestions(session, plan, await LoadAllWordsAsync(cancellationToken), 0);

        return await SaveNewSessionAsync(userId, deviceId, session, cancellationToken);
    }

    public async Task<StudySessionResponse> GetAsync(
        string userId,
        Guid sessionId,
        CancellationToken cancellationToken
    )
    {
        var session = await LoadSessionAsync(
            userId,
            sessionId,
            GetCurrentDeviceId(),
            cancellationToken
        );
        if (session.Status == StudySessionStatus.Abandoned)
            throw new StudyNotFoundException();

        return await ToResponseAsync(userId, session, cancellationToken);
    }

    public async Task<StudyAnswerResponse> AnswerAsync(
        string userId,
        Guid sessionId,
        AnswerStudyQuestionRequest request,
        CancellationToken cancellationToken
    )
    {
        if (request.SelectedIndex is not null && request.WrittenAnswer is not null)
            throw new StudyValidationException("Yalnızca bir cevap türü gönderin.");

        var deviceId = GetCurrentDeviceId();
        var session = await LoadSessionAsync(userId, sessionId, deviceId, cancellationToken);
        if (session.Status != StudySessionStatus.Active)
            throw new StudyConflictException("Bu Study oturumu etkin değil.");

        var question = session
            .Questions.OrderBy(item => item.Position)
            .FirstOrDefault(item => item.Outcome is null);
        if (
            question is null
            || question.Position != request.Position
            || question.WordId != request.WordId
        )
            throw new StudyConflictException("Bu soru artık etkin değil.");

        var normalizedAnswer = request.WrittenAnswer is null
            ? null
            : QuestionFactory.NormalizeAnswer(request.WrittenAnswer);
        var outcome = DetermineOutcome(question, request.SelectedIndex, normalizedAnswer);
        var now = timeProvider.GetUtcNow();

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var affectedQuestions = await db
            .StudySessionQuestions.Where(item =>
                item.StudySessionId == sessionId
                && item.Position == request.Position
                && item.WordId == request.WordId
                && item.Outcome == null
            )
            .ExecuteUpdateAsync(
                setters =>
                    setters
                        .SetProperty(item => item.Outcome, outcome)
                        .SetProperty(item => item.SelectedIndex, request.SelectedIndex)
                        .SetProperty(item => item.SelectedText, normalizedAnswer)
                        .SetProperty(item => item.AnsweredAtUtc, now),
                cancellationToken
            );
        if (affectedQuestions != 1)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new StudyConflictException("Bu soru daha önce cevaplandı.");
        }

        var existingMastery = await db.UserWordMastery.SingleOrDefaultAsync(
            item =>
                item.UserId == userId
                && item.WordId == question.WordId
                && item.Dimension == question.Dimension,
            cancellationToken
        );
        if (existingMastery is null)
        {
            existingMastery = new UserWordMastery
            {
                UserId = userId,
                WordId = question.WordId,
                Dimension = question.Dimension,
            };
            db.UserWordMastery.Add(existingMastery);
        }

        var introduction = await db.UserWordIntroductions.SingleOrDefaultAsync(
            item => item.UserId == userId && item.WordId == question.WordId,
            cancellationToken
        );
        if (introduction is null)
        {
            db.UserWordIntroductions.Add(
                new UserWordIntroduction
                {
                    UserId = userId,
                    WordId = question.WordId,
                    IntroducedAtUtc = now,
                }
            );
        }

        MasteryScheduler.Apply(existingMastery, outcome, now);

        var remainingCount = session.Questions.Count(item => item.Outcome is null) - 1;
        session.LastActivityAtUtc = now;
        if (remainingCount == 0)
        {
            session.Status = StudySessionStatus.Completed;
            session.CompletedAtUtc = now;
            session.ContinuationReservedAtUtc = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        db.ChangeTracker.Clear();

        var updated = await LoadSessionAsync(userId, sessionId, deviceId, cancellationToken);
        var response = await ToResponseAsync(userId, updated, cancellationToken);
        return new StudyAnswerResponse(
            outcome,
            question.CorrectIndex,
            request.SelectedIndex,
            normalizedAnswer,
            question.CorrectAnswerSnapshot,
            updated.Status == StudySessionStatus.Completed,
            response
        );
    }

    public async Task<StudySessionResponse> DeferSkillAsync(
        string userId,
        Guid sessionId,
        DeferStudySkillRequest request,
        CancellationToken cancellationToken
    )
    {
        if (!StudyPlanner.SupportedDimensions.Contains(request.Dimension))
            throw new StudyValidationException("Bu soru türü ertelenemez.");

        var session = await LoadSessionAsync(
            userId,
            sessionId,
            GetCurrentDeviceId(),
            cancellationToken
        );
        if (session.Status != StudySessionStatus.Active)
            throw new StudyConflictException("Bu Study oturumu etkin değil.");

        var now = timeProvider.GetUtcNow();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var pause = await db.UserStudySkillPauses.SingleOrDefaultAsync(
            item => item.UserId == userId && item.Dimension == request.Dimension,
            cancellationToken
        );
        if (pause is null)
        {
            db.UserStudySkillPauses.Add(
                new UserStudySkillPause
                {
                    UserId = userId,
                    Dimension = request.Dimension,
                    DeferredUntilUtc = now.AddMinutes(10),
                }
            );
        }
        else
        {
            pause.DeferredUntilUtc = now.AddMinutes(10);
        }

        var pausedDimensions = await LoadPausedDimensionsAsync(userId, now, cancellationToken);
        pausedDimensions.Add(request.Dimension);
        _ = StudyPlanner.ResolveAllowedDimensions(pausedDimensions);
        var pending = session.Questions.Where(item => item.Outcome is null).ToList();

        session.LastActivityAtUtc = now;
        db.StudySessionQuestions.RemoveRange(pending);
        session.Status = StudySessionStatus.Completed;
        session.CompletedAtUtc = now;
        session.ContinuationReservedAtUtc = now;

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        db.ChangeTracker.Clear();

        return await ToResponseAsync(
            userId,
            await LoadSessionAsync(userId, sessionId, GetCurrentDeviceId(), cancellationToken),
            cancellationToken
        );
    }

    public async Task AbandonAsync(
        string userId,
        Guid sessionId,
        CancellationToken cancellationToken
    )
    {
        var deviceId = GetCurrentDeviceId();
        var session =
            await db
                .StudySessions.AsNoTracking()
                .SingleOrDefaultAsync(
                    item => item.Id == sessionId && item.UserId == userId,
                    cancellationToken
                )
            ?? throw new StudyNotFoundException();

        if (session.OwnerDeviceId != deviceId)
            throw new StudyNotFoundException();

        if (
            session.Status == StudySessionStatus.Completed
            && session.ContinuationReservedAtUtc is not null
        )
        {
            await db
                .StudySessions.Where(item =>
                    item.Id == sessionId
                    && item.UserId == userId
                    && item.OwnerDeviceId == deviceId
                    && item.Status == StudySessionStatus.Completed
                )
                .ExecuteUpdateAsync(
                    setters =>
                        setters.SetProperty(
                            item => item.ContinuationReservedAtUtc,
                            (DateTimeOffset?)null
                        ),
                    cancellationToken
                );
            return;
        }

        if (session.Status != StudySessionStatus.Active)
            return;

        await db
            .StudySessions.Where(item =>
                item.Id == sessionId
                && item.UserId == userId
                && item.OwnerDeviceId == deviceId
                && item.Status == StudySessionStatus.Active
            )
            .ExecuteUpdateAsync(
                setters =>
                    setters
                        .SetProperty(item => item.Status, StudySessionStatus.Abandoned)
                        .SetProperty(item => item.LastActivityAtUtc, timeProvider.GetUtcNow()),
                cancellationToken
            );
    }

    private async Task<IReadOnlyList<PlannedStudyQuestion>> CreatePlanAsync(
        string userId,
        StudySessionMode mode,
        CurriculumTopic? topic,
        IReadOnlyList<CurriculumTopic> topics,
        IReadOnlySet<StudyQuestionKey> answeredDimensions,
        IReadOnlySet<VocabularyMasteryDimension> deferredDimensions,
        IReadOnlySet<StudyQuestionKey> excludedQuestions,
        int limit,
        DateTimeOffset now,
        CancellationToken cancellationToken
    )
    {
        if (limit <= 0)
            return [];

        IReadOnlyList<PlannedStudyQuestion> plan;
        if (mode == StudySessionMode.Topic)
        {
            var topicWords = (topic?.Words ?? [])
                .Select(item => new CurriculumWordCandidate(
                    item.Word,
                    topic!.SortOrder,
                    item.LearningGroupSortOrder,
                    item.SortOrder
                ))
                .ToList();
            plan = planner.CreateTopicPlan(
                topicWords,
                answeredDimensions,
                deferredDimensions,
                excludedQuestions
            );
        }
        else
        {
            var masteries = await db
                .UserWordMastery.AsNoTracking()
                .Include(item => item.Word)
                .Where(item => item.UserId == userId)
                .ToListAsync(cancellationToken);

            plan = planner.CreateReviewPlan(masteries, deferredDimensions, excludedQuestions, now);
        }

        return plan.Count <= limit ? plan : plan.Take(limit).ToList();
    }

    private void AppendQuestions(
        StudySession session,
        IReadOnlyList<PlannedStudyQuestion> plan,
        IReadOnlyList<Word> allWords,
        int startPosition
    )
    {
        for (var index = 0; index < plan.Count; index++)
        {
            var planned = plan[index];
            var snapshot = questionFactory.Create(planned.Word, planned.Dimension, allWords);
            session.Questions.Add(
                new StudySessionQuestion
                {
                    Position = startPosition + index,
                    WordId = planned.Word.Id,
                    Dimension = planned.Dimension,
                    Kind = snapshot.Kind,
                    EnglishSnapshot = planned.Word.English,
                    PromptSnapshot = snapshot.Prompt,
                    CorrectAnswerSnapshot = snapshot.CorrectAnswer,
                    Options = snapshot.Options,
                    CorrectIndex = snapshot.CorrectIndex,
                    AcceptedAnswersSnapshot = snapshot.AcceptedAnswers,
                    IsIntroduction = planned.IsIntroduction,
                }
            );
        }
    }

    private static CurriculumTopic ResolveExplicitTopic(
        IReadOnlyList<CurriculumTopic> topics,
        int? curriculumTopicId
    )
    {
        var activeTopics = topics
            .Where(item => item.Status == CurriculumTopicStatus.Active)
            .ToList();
        if (curriculumTopicId is not int id)
            throw new StudyValidationException("Konu seçimi gerekli.");

        return activeTopics.SingleOrDefault(item => item.Id == id)
            ?? throw new StudyNotFoundException();
    }

    private static CurriculumTopic ResolveNextPlannableTopic(
        IReadOnlyList<CurriculumTopic> topics,
        IReadOnlySet<StudyQuestionKey> answeredDimensions,
        IReadOnlySet<VocabularyMasteryDimension> pausedDimensions
    )
    {
        var activeTopics = topics
            .Where(item => item.Status == CurriculumTopicStatus.Active)
            .ToList();
        return FindCurrentPlannableTopic(activeTopics, answeredDimensions, pausedDimensions)
            ?? throw new StudyConflictException(
                FindCurrentTopic(activeTopics, answeredDimensions) is null
                    ? "Curriculum'daki tüm konular tamamlandı."
                    : "Şu an çalışılabilecek soru yok. Ertelenen soru türü yeniden açıldığında devam edebilirsin."
            );
    }

    private static CurriculumTopic? FindCurrentTopic(
        IReadOnlyList<CurriculumTopic> activeTopics,
        IReadOnlySet<StudyQuestionKey> answeredDimensions
    ) =>
        activeTopics
            .OrderBy(item => item.Level)
            .ThenBy(item => item.SortOrder)
            .FirstOrDefault(item =>
                item.Words.Any(word =>
                    StudyPlanner.SupportedDimensions.Any(dimension =>
                        !answeredDimensions.Contains(new StudyQuestionKey(word.WordId, dimension))
                    )
                )
            );

    private static CurriculumTopic? FindCurrentPlannableTopic(
        IReadOnlyList<CurriculumTopic> activeTopics,
        IReadOnlySet<StudyQuestionKey> answeredDimensions,
        IReadOnlySet<VocabularyMasteryDimension> pausedDimensions
    ) =>
        activeTopics
            .OrderBy(item => item.Level)
            .ThenBy(item => item.SortOrder)
            .FirstOrDefault(item => IsTopicPlannable(item, answeredDimensions, pausedDimensions));

    private static bool IsTopicPlannable(
        CurriculumTopic topic,
        IReadOnlySet<StudyQuestionKey> answeredDimensions,
        IReadOnlySet<VocabularyMasteryDimension> pausedDimensions
    ) =>
        topic.Words.Any(word =>
            StudyPlanner.SupportedDimensions.Any(dimension =>
                !pausedDimensions.Contains(dimension)
                && !answeredDimensions.Contains(new StudyQuestionKey(word.WordId, dimension))
            )
        );

    private static bool HasCompletedTopic(
        IReadOnlyList<CurriculumTopic> topics,
        IReadOnlySet<int> completedWordIds
    ) =>
        topics.Any(topic =>
            topic.Status == CurriculumTopicStatus.Active
            && topic.Words.Count > 0
            && topic.Words.All(word => completedWordIds.Contains(word.WordId))
        );

    private static StudyTopicResponse ToTopicResponse(
        CurriculumTopic topic,
        IReadOnlySet<int> completedWordIds,
        IReadOnlySet<int> recognitionWordIds
    )
    {
        var introduced = topic.Words.Count(item => completedWordIds.Contains(item.WordId));
        var recognition = topic.Words.Count(item => recognitionWordIds.Contains(item.WordId));
        return new StudyTopicResponse(
            topic.Id,
            topic.Level,
            topic.Topic,
            introduced,
            recognition,
            topic.Words.Count,
            topic.Words.Count > 0 && introduced == topic.Words.Count
        );
    }

    private StudyOutcome DetermineOutcome(
        StudySessionQuestion question,
        int? selectedIndex,
        string? normalizedAnswer
    )
    {
        if (question.Kind == StudyQuestionKind.MultipleChoice)
        {
            if (normalizedAnswer is not null)
                throw new StudyValidationException("Bu soru için bir seçenek seçilmelidir.");
            if (selectedIndex is < 0 || selectedIndex >= question.Options!.Length)
                throw new StudyValidationException("Seçilen seçenek geçerli aralığın dışında.");

            return selectedIndex is null ? StudyOutcome.Review
                : selectedIndex == question.CorrectIndex ? StudyOutcome.Correct
                : StudyOutcome.Wrong;
        }

        if (selectedIndex is not null)
            throw new StudyValidationException("Bu soru yazılı cevap gerektiriyor.");
        if (normalizedAnswer is not null && normalizedAnswer.Length == 0)
            throw new StudyValidationException("Yazılı cevap boş olamaz.");

        return normalizedAnswer is null ? StudyOutcome.Review
            : questionFactory.IsWrittenAnswerCorrect(
                normalizedAnswer,
                question.AcceptedAnswersSnapshot
                    ?? throw new InvalidOperationException("Written Study question has no answers.")
            )
                ? StudyOutcome.Correct
            : StudyOutcome.Wrong;
    }

    private async Task<IReadOnlyList<CurriculumTopic>> LoadCurriculumTopicsAsync(
        CancellationToken cancellationToken
    )
    {
        var topics = await db
            .CurriculumTopics.AsNoTracking()
            .Include(item => item.Words)
                .ThenInclude(item => item.Word)
            .ToListAsync(cancellationToken);
        if (topics.Count == 0)
            throw new StudyConflictException(
                "Study curriculum'u henüz yüklenmemiş. Önce curriculum bootstrap çalıştırılmalıdır."
            );

        return topics;
    }

    private async Task<IReadOnlyList<Word>> LoadAllWordsAsync(
        CancellationToken cancellationToken
    ) => await db.Words.AsNoTracking().OrderBy(item => item.Id).ToListAsync(cancellationToken);

    private async Task<HashSet<StudyQuestionKey>> LoadAnsweredDimensionsAsync(
        string userId,
        CancellationToken cancellationToken
    ) =>
        await db
            .UserWordMastery.AsNoTracking()
            .Where(item => item.UserId == userId)
            .Where(item => StudyPlanner.SupportedDimensions.Contains(item.Dimension))
            .Select(item => new StudyQuestionKey(item.WordId, item.Dimension))
            .ToHashSetAsync(cancellationToken);

    private static HashSet<int> GetCompletedWordIds(
        IReadOnlySet<StudyQuestionKey> answeredDimensions
    ) =>
        answeredDimensions
            .Select(item => item.WordId)
            .Where(wordId =>
                StudyPlanner.SupportedDimensions.All(dimension =>
                    answeredDimensions.Contains(new StudyQuestionKey(wordId, dimension))
                )
            )
            .ToHashSet();

    private static HashSet<int> GetAnsweredWordIds(
        IReadOnlySet<StudyQuestionKey> answeredDimensions,
        VocabularyMasteryDimension dimension
    ) =>
        answeredDimensions
            .Where(item => item.Dimension == dimension)
            .Select(item => item.WordId)
            .ToHashSet();

    private async Task<int> CountReviewQuestionsAsync(
        string userId,
        IReadOnlyList<CurriculumTopic> topics,
        IReadOnlySet<StudyQuestionKey> answeredDimensions,
        CancellationToken cancellationToken
    )
    {
        if (answeredDimensions.Count == 0)
            return 0;

        var now = timeProvider.GetUtcNow();
        var pausedDimensions = await LoadPausedDimensionsAsync(userId, now, cancellationToken);
        var plan = await CreatePlanAsync(
            userId,
            StudySessionMode.Review,
            null,
            topics,
            answeredDimensions,
            pausedDimensions,
            new HashSet<StudyQuestionKey>(),
            StudyPlanner.ReviewSessionSize,
            now,
            cancellationToken
        );
        return plan.Count;
    }

    private async Task<StartStudySessionResult> SaveNewSessionAsync(
        string userId,
        string deviceId,
        StudySession session,
        CancellationToken cancellationToken
    )
    {
        db.StudySessions.Add(session);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsActiveSessionConflict(exception))
        {
            db.ChangeTracker.Clear();
            var winner = await db
                .StudySessions.AsNoTracking()
                .SingleOrDefaultAsync(
                    item => item.UserId == userId && item.Status == StudySessionStatus.Active,
                    cancellationToken
                );

            if (winner is null)
                throw new StudyConflictException("Çalışma başlatılamadı. Lütfen tekrar deneyin.");

            await EnsureActiveSessionIsOwnedAsync(winner, deviceId, cancellationToken);

            return new StartStudySessionResult(
                false,
                await GetAsync(userId, winner.Id, cancellationToken)
            );
        }

        return new StartStudySessionResult(
            true,
            await GetAsync(userId, session.Id, cancellationToken)
        );
    }

    private static bool IsActiveSessionConflict(DbUpdateException exception) =>
        exception.InnerException
            is PostgresException
            {
                SqlState: PostgresErrorCodes.UniqueViolation,
                ConstraintName: ActiveSessionIndexName
            };

    private const string ActiveSessionIndexName = "IX_StudySessions_UserId";

    private async Task<HashSet<VocabularyMasteryDimension>> LoadPausedDimensionsAsync(
        string userId,
        DateTimeOffset now,
        CancellationToken cancellationToken
    ) =>
        await db
            .UserStudySkillPauses.AsNoTracking()
            .Where(item => item.UserId == userId && item.DeferredUntilUtc > now)
            .Select(item => item.Dimension)
            .ToHashSetAsync(cancellationToken);

    private async Task<StudySession> LoadSessionAsync(
        string userId,
        Guid sessionId,
        string deviceId,
        CancellationToken cancellationToken
    )
    {
        var session =
            await db
                .StudySessions.Include(item => item.CurriculumTopic)
                    .ThenInclude(item => item!.Words)
                .Include(item => item.Questions)
                .AsSplitQuery()
                .SingleOrDefaultAsync(
                    item => item.Id == sessionId && item.UserId == userId,
                    cancellationToken
                )
            ?? throw new StudyNotFoundException();

        if (session.OwnerDeviceId != deviceId)
            throw new StudyNotFoundException();

        return session;
    }

    private Task<StudySession?> LoadContinuationReservationAsync(
        string userId,
        CancellationToken cancellationToken
    ) => LoadContinuationReservationAsync(userId, null, cancellationToken);

    private async Task<StudySession?> LoadContinuationReservationAsync(
        string userId,
        Guid? sessionId,
        CancellationToken cancellationToken
    ) =>
        await db
            .StudySessions.Include(item => item.CurriculumTopic)
                .ThenInclude(item => item!.Words)
            .Include(item => item.Questions)
            .AsSplitQuery()
            .Where(item =>
                item.UserId == userId
                && item.Status == StudySessionStatus.Completed
                && item.ContinuationReservedAtUtc != null
                && (sessionId == null || item.Id == sessionId)
            )
            .OrderByDescending(item => item.ContinuationReservedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

    private async Task<StudySession?> ReleaseOwnContinuationReservationAsync(
        string userId,
        string deviceId,
        CancellationToken cancellationToken
    )
    {
        var reservation = await LoadContinuationReservationAsync(userId, cancellationToken);
        if (reservation is null)
            return null;

        await EnsureContinuationReservationIsOwnedAsync(reservation, deviceId, cancellationToken);
        reservation.ContinuationReservedAtUtc = null;
        return reservation;
    }

    private async Task EnsureActiveSessionIsOwnedAsync(
        StudySession? session,
        string deviceId,
        CancellationToken cancellationToken
    )
    {
        if (session is null || session.OwnerDeviceId == deviceId)
            return;

        throw new StudyConflictException(
            "Bu çalışma başka bir cihazda açık.",
            SessionOwnedByAnotherDeviceCode
        );
    }

    private async Task EnsureContinuationReservationIsOwnedAsync(
        StudySession session,
        string deviceId,
        CancellationToken cancellationToken
    )
    {
        if (session.OwnerDeviceId == deviceId)
            return;

        throw new StudyConflictException(
            "Bu çalışma başka bir cihazda açık.",
            SessionOwnedByAnotherDeviceCode
        );
    }

    private async Task<StudySessionResponse> ToResponseAsync(
        string userId,
        StudySession session,
        CancellationToken cancellationToken
    )
    {
        var questions = session.Questions.OrderBy(item => item.Position).ToList();
        var answered = questions.Where(item => item.Outcome is not null).ToList();
        var current = questions.FirstOrDefault(item => item.Outcome is null);
        var wordIds = answered.Select(item => item.WordId).Distinct().ToList();
        var nextReview =
            wordIds.Count == 0
                ? null
                : await db
                    .UserWordMastery.AsNoTracking()
                    .Where(item => item.UserId == userId && wordIds.Contains(item.WordId))
                    .MinAsync(item => (DateTimeOffset?)item.NextReviewAtUtc, cancellationToken);

        var answeredDimensions = await LoadAnsweredDimensionsAsync(userId, cancellationToken);
        var completedWordIds = GetCompletedWordIds(answeredDimensions);
        var recognitionWordIds = GetAnsweredWordIds(
            answeredDimensions,
            VocabularyMasteryDimension.WrittenRecognition
        );
        var topic = session.CurriculumTopic is null
            ? null
            : ToTopicResponse(session.CurriculumTopic, completedWordIds, recognitionWordIds);
        var reviewQuestionCount = 0;
        var canContinue = false;
        if (session.Status == StudySessionStatus.Completed)
        {
            var topics = await LoadCurriculumTopicsAsync(cancellationToken);
            reviewQuestionCount = await CountReviewQuestionsAsync(
                userId,
                topics,
                answeredDimensions,
                cancellationToken
            );
            var now = timeProvider.GetUtcNow();
            var pausedDimensions = await LoadPausedDimensionsAsync(userId, now, cancellationToken);
            var returnTopicId =
                session.Mode == StudySessionMode.Topic
                    ? session.CurriculumTopicId
                    : session.ReturnToCurriculumTopicId;
            var returnTopic = returnTopicId is null
                ? null
                : topics.SingleOrDefault(item => item.Id == returnTopicId);
            canContinue =
                reviewQuestionCount > 0
                || (
                    returnTopic is not null
                    && IsTopicPlannable(returnTopic, answeredDimensions, pausedDimensions)
                )
                || FindCurrentPlannableTopic(topics, answeredDimensions, pausedDimensions)
                    is not null;
        }

        return new StudySessionResponse(
            session.Id,
            session.Status,
            session.Mode,
            topic,
            new StudyProgressResponse(
                answered.Count,
                questions.Count,
                answered.Count(item => item.Outcome == StudyOutcome.Correct),
                answered.Count(item => item.Outcome == StudyOutcome.Review),
                answered.Count(item => item.Outcome == StudyOutcome.Wrong)
            ),
            current is null
                ? null
                : new StudyQuestionResponse(
                    current.Position,
                    current.WordId,
                    current.Dimension,
                    current.Kind,
                    current.PromptSnapshot,
                    current.Options ?? [],
                    current.IsIntroduction
                ),
            new StudySummaryResponse(
                wordIds.Count(completedWordIds.Contains),
                answered
                    .Where(item => !item.IsIntroduction)
                    .Select(item => item.WordId)
                    .Distinct()
                    .Count(),
                nextReview,
                topic?.IsCompleted ?? false,
                reviewQuestionCount,
                canContinue,
                answered
                    .Select(item => new StudyResultItemResponse(
                        item.WordId,
                        item.Dimension,
                        item.PromptSnapshot,
                        item.CorrectAnswerSnapshot,
                        item.SelectedIndex is not null && item.Options is not null
                            ? item.Options[item.SelectedIndex.Value]
                            : item.SelectedText,
                        item.Outcome!.Value,
                        item.IsIntroduction
                    ))
                    .ToList()
            )
        );
    }
}
