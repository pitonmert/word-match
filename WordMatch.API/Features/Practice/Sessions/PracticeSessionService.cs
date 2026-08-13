using Microsoft.EntityFrameworkCore;
using WordMatch.API.Data;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Practice;

public class PracticeSessionService(
    ApplicationDbContext db,
    PracticeQuestionFactory questionFactory
) : IPracticeSessionService
{
    private const int QuestionWindowSize = 4;

    public async Task<PracticeSessionResponse> StartOrResumeAsync(
        string userId,
        StartPracticeRequest request,
        CancellationToken cancellationToken = default
    )
    {
        if (!Enum.IsDefined(request.Mode))
            throw new PracticeValidationException("Seçilen çalışma modu geçersiz.");

        var existingSession = await db.PracticeSessions.SingleOrDefaultAsync(
            session =>
                session.UserId == userId
                && session.Level == request.Level
                && session.Topic == request.Topic
                && session.Status == PracticeSessionStatus.Active,
            cancellationToken
        );

        if (existingSession is not null && !request.Replay && existingSession.Mode == request.Mode)
            return await GetAsync(userId, existingSession.Id, cancellationToken);

        if (existingSession is not null)
        {
            existingSession.Status = PracticeSessionStatus.Abandoned;
            existingSession.LastActivityAtUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }

        var session = await CreateSessionAsync(userId, request, cancellationToken);
        return await GetAsync(userId, session.Id, cancellationToken);
    }

    public async Task<PracticeSessionResponse> GetAsync(
        string userId,
        Guid sessionId,
        CancellationToken cancellationToken = default
    )
    {
        var session = await LoadSessionAsync(userId, sessionId, cancellationToken);

        if (session.Status == PracticeSessionStatus.Abandoned)
            throw new PracticeNotFoundException();

        if (session.Status == PracticeSessionStatus.Active)
        {
            var currentWord = session
                .Words.OrderBy(item => item.Position)
                .FirstOrDefault(item => item.Outcome is null);

            if (currentWord is null)
            {
                session.Status = PracticeSessionStatus.Completed;
                session.CompletedAtUtc = DateTimeOffset.UtcNow;
                session.LastActivityAtUtc = session.CompletedAtUtc.Value;
                await db.SaveChangesAsync(cancellationToken);
            }
            else
            {
                await EnsureQuestionWindowAsync(session, cancellationToken);
            }
        }

        return await ToResponseAsync(userId, session, cancellationToken);
    }

    public async Task<PracticeResultViewResponse> GetResultsAsync(
        string userId,
        WordLevel level,
        WordTopic topic,
        PracticeMode mode,
        CancellationToken cancellationToken = default
    )
    {
        if (!Enum.IsDefined(mode))
            throw new PracticeValidationException("Seçilen çalışma modu geçersiz.");

        var resultWords = await LoadLatestAnsweredQuestionsAsync(
            userId,
            level,
            topic,
            mode,
            cancellationToken
        );

        if (resultWords.Count == 0)
            throw new PracticeNotFoundException();

        var correct = CreateResultList(resultWords, PracticeOutcome.Correct);
        var review = CreateResultList(resultWords, PracticeOutcome.Review);
        var wrong = CreateResultList(resultWords, PracticeOutcome.Wrong);

        return new PracticeResultViewResponse(
            level,
            topic,
            mode,
            CreateProgress(resultWords),
            new PracticeResultsResponse(correct, review, wrong)
        );
    }

    public async Task<PracticeAnswerResponse> AnswerAsync(
        string userId,
        Guid sessionId,
        AnswerPracticeRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var session = await LoadSessionAsync(userId, sessionId, cancellationToken);
        if (session.Status != PracticeSessionStatus.Active)
            throw new PracticeConflictException("Bu çalışma oturumu etkin değil.");

        var currentWord = session
            .Words.OrderBy(item => item.Position)
            .FirstOrDefault(item => item.Outcome is null);

        if (
            currentWord is null
            || currentWord.Position != request.Position
            || currentWord.WordId != request.WordId
        )
            throw new PracticeConflictException("Bu soru artık etkin değil.");

        if (
            currentWord.Format == QuestionFormat.MultipleChoice
            && (currentWord.Options is null || currentWord.CorrectIndex is null)
        )
        {
            await EnsureQuestionWindowAsync(session, cancellationToken);
        }

        if (request.SelectedIndex is not null && request.WrittenAnswer is not null)
            throw new PracticeValidationException("Yalnızca bir cevap türü gönderin.");

        var normalizedWrittenAnswer = request.WrittenAnswer is null
            ? null
            : PracticeQuestionFactory.NormalizeAnswer(request.WrittenAnswer);
        PracticeOutcome outcome;

        if (currentWord.Format == QuestionFormat.MultipleChoice)
        {
            if (request.WrittenAnswer is not null)
                throw new PracticeValidationException("Bu soru için bir seçenek seçilmelidir.");

            if (
                request.SelectedIndex is < 0
                || request.SelectedIndex >= currentWord.Options!.Length
            )
            {
                throw new PracticeValidationException("Seçilen seçenek geçerli aralığın dışında.");
            }

            outcome =
                request.SelectedIndex is null ? PracticeOutcome.Review
                : request.SelectedIndex == currentWord.CorrectIndex ? PracticeOutcome.Correct
                : PracticeOutcome.Wrong;
        }
        else
        {
            if (request.SelectedIndex is not null)
                throw new PracticeValidationException("Bu soru yazılı cevap gerektiriyor.");

            if (request.WrittenAnswer is not null && normalizedWrittenAnswer!.Length == 0)
                throw new PracticeValidationException("Yazılı cevap boş olamaz.");

            var acceptedAnswers =
                currentWord.AcceptedAnswersSnapshot
                ?? throw new InvalidOperationException("Written question has no accepted answers.");

            outcome =
                request.WrittenAnswer is null ? PracticeOutcome.Review
                : questionFactory.IsWrittenAnswerCorrect(
                    currentWord.Direction,
                    normalizedWrittenAnswer!,
                    acceptedAnswers
                )
                    ? PracticeOutcome.Correct
                : PracticeOutcome.Wrong;
        }

        var answeredAt = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var affectedRows = await db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            UPDATE "PracticeSessionWords"
            SET "Outcome" = {outcome.ToString()},
                "SelectedIndex" = {request.SelectedIndex},
                "SelectedText" = {normalizedWrittenAnswer},
                "AnsweredAtUtc" = {answeredAt}
            WHERE "PracticeSessionId" = {sessionId}
              AND "Position" = {request.Position}
              AND "WordId" = {request.WordId}
              AND "Outcome" IS NULL
            """,
            cancellationToken
        );

        if (affectedRows != 1)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new PracticeConflictException("Bu soru daha önce cevaplandı.");
        }

        var correctIncrement = outcome == PracticeOutcome.Correct ? 1 : 0;
        var reviewIncrement = outcome == PracticeOutcome.Review ? 1 : 0;
        var wrongIncrement = outcome == PracticeOutcome.Wrong ? 1 : 0;

        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            INSERT INTO "UserWordProgress"
                ("UserId", "WordId", "Direction", "Format", "CorrectCount", "ReviewCount", "WrongCount", "LastOutcome", "LastAnsweredAtUtc")
            VALUES
                ({userId}, {request.WordId}, {currentWord.Direction.ToString()}, {currentWord.Format.ToString()}, {correctIncrement}, {reviewIncrement}, {wrongIncrement}, {outcome.ToString()}, {answeredAt})
            ON CONFLICT ("UserId", "WordId", "Direction", "Format") DO UPDATE
            SET "CorrectCount" = "UserWordProgress"."CorrectCount" + EXCLUDED."CorrectCount",
                "ReviewCount" = "UserWordProgress"."ReviewCount" + EXCLUDED."ReviewCount",
                "WrongCount" = "UserWordProgress"."WrongCount" + EXCLUDED."WrongCount",
                "LastOutcome" = EXCLUDED."LastOutcome",
                "LastAnsweredAtUtc" = EXCLUDED."LastAnsweredAtUtc"
            """,
            cancellationToken
        );

        var hasUnansweredWords = await db.PracticeSessionWords.AnyAsync(
            item => item.PracticeSessionId == sessionId && item.Outcome == null,
            cancellationToken
        );

        await db
            .PracticeSessions.Where(item => item.Id == sessionId && item.UserId == userId)
            .ExecuteUpdateAsync(
                setters =>
                    setters
                        .SetProperty(item => item.LastActivityAtUtc, answeredAt)
                        .SetProperty(
                            item => item.Status,
                            hasUnansweredWords
                                ? PracticeSessionStatus.Active
                                : PracticeSessionStatus.Completed
                        )
                        .SetProperty(
                            item => item.CompletedAtUtc,
                            hasUnansweredWords ? null : answeredAt
                        ),
                cancellationToken
            );

        await transaction.CommitAsync(cancellationToken);
        db.ChangeTracker.Clear();

        var updatedSession = await LoadSessionAsync(userId, sessionId, cancellationToken);
        if (updatedSession.Status == PracticeSessionStatus.Active)
            await EnsureQuestionWindowAsync(updatedSession, cancellationToken);

        var sessionResponse = await ToResponseAsync(userId, updatedSession, cancellationToken);
        var progress = sessionResponse.Progress;

        return new PracticeAnswerResponse(
            outcome,
            currentWord.CorrectIndex,
            request.SelectedIndex,
            normalizedWrittenAnswer,
            currentWord.CorrectAnswerSnapshot,
            progress,
            updatedSession.Status == PracticeSessionStatus.Completed,
            sessionResponse
        );
    }

    private async Task<PracticeSession> CreateSessionAsync(
        string userId,
        StartPracticeRequest request,
        CancellationToken cancellationToken
    )
    {
        var allWords = await db.Words.AsNoTracking().ToListAsync(cancellationToken);
        var words = allWords
            .Where(word => word.Level == request.Level && word.Topic == request.Topic)
            .ToList();
        if (words.Count == 0)
            throw new PracticeValidationException("Seçilen çalışma grubunda kelime bulunmuyor.");

        var questionPlan = questionFactory.CreateQuestionPlan(request.Mode, words);

        if (!request.Replay)
        {
            var wordIds = words.Select(word => word.Id).ToList();
            var completedQuestions = await db
                .UserWordProgress.AsNoTracking()
                .Where(progress => progress.UserId == userId && wordIds.Contains(progress.WordId))
                .Select(progress => new CompletedQuestionKey(
                    progress.WordId,
                    progress.Direction,
                    progress.Format
                ))
                .ToListAsync(cancellationToken);
            var completedQuestionSet = completedQuestions.ToHashSet();

            questionPlan = questionPlan
                .Where(item =>
                    !completedQuestionSet.Contains(
                        new CompletedQuestionKey(item.Word.Id, item.Direction, item.Format)
                    )
                )
                .ToList();
        }

        if (questionPlan.Count == 0)
            throw new PracticeConflictException(
                "Bu çalışma modundaki bütün sorular daha önce tamamlandı."
            );

        var session = new PracticeSession
        {
            UserId = userId,
            Level = request.Level,
            Topic = request.Topic,
            Mode = request.Mode,
            IsReplay = request.Replay,
        };

        for (var index = 0; index < questionPlan.Count; index++)
        {
            var word = questionPlan[index].Word;
            var direction = questionPlan[index].Direction;
            var format = questionPlan[index].Format;
            var snapshot = questionFactory.CreateSnapshot(word, direction, format, allWords);
            session.Words.Add(
                new PracticeSessionWord
                {
                    WordId = word.Id,
                    Position = index,
                    Direction = direction,
                    Format = format,
                    EnglishSnapshot = word.English,
                    PromptSnapshot = snapshot.Prompt,
                    CorrectAnswerSnapshot = snapshot.CorrectAnswer,
                    AcceptedAnswersSnapshot = snapshot.AcceptedAnswers,
                }
            );
        }

        db.PracticeSessions.Add(session);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return session;
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            var existing = await db.PracticeSessions.SingleOrDefaultAsync(
                item =>
                    item.UserId == userId
                    && item.Level == request.Level
                    && item.Topic == request.Topic
                    && item.Status == PracticeSessionStatus.Active,
                cancellationToken
            );

            if (existing is null)
                throw;

            return existing;
        }
    }

    private async Task<PracticeSession> LoadSessionAsync(
        string userId,
        Guid sessionId,
        CancellationToken cancellationToken
    )
    {
        return await db
                .PracticeSessions.Include(session => session.Words)
                .SingleOrDefaultAsync(
                    session => session.Id == sessionId && session.UserId == userId,
                    cancellationToken
                )
            ?? throw new PracticeNotFoundException();
    }

    private async Task EnsureQuestionWindowAsync(
        PracticeSession session,
        CancellationToken cancellationToken
    )
    {
        var missingQuestions = session
            .Words.Where(item => item.Outcome is null)
            .OrderBy(item => item.Position)
            .Take(QuestionWindowSize)
            .Where(item =>
                item.Format == QuestionFormat.MultipleChoice
                && (item.Options is null || item.CorrectIndex is null)
            )
            .ToList();

        if (missingQuestions.Count == 0)
            return;

        var allWords = await db.Words.AsNoTracking().ToListAsync(cancellationToken);

        foreach (var question in missingQuestions)
            await CreateOptionsAsync(session, question, allWords, cancellationToken);

        var initializedAt = DateTimeOffset.UtcNow;
        await db
            .PracticeSessions.Where(item => item.Id == session.Id)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(item => item.LastActivityAtUtc, initializedAt),
                cancellationToken
            );
        session.LastActivityAtUtc = initializedAt;
    }

    private async Task CreateOptionsAsync(
        PracticeSession session,
        PracticeSessionWord currentWord,
        IReadOnlyCollection<Word> allWords,
        CancellationToken cancellationToken
    )
    {
        if (currentWord.Format != QuestionFormat.MultipleChoice)
            throw new InvalidOperationException("Only multiple-choice questions require options.");

        var generatedQuestion = questionFactory.CreateOptions(session, currentWord, allWords);
        var initializedRows = await db
            .PracticeSessionWords.Where(item =>
                item.PracticeSessionId == session.Id
                && item.Position == currentWord.Position
                && item.WordId == currentWord.WordId
                && item.Options == null
            )
            .ExecuteUpdateAsync(
                setters =>
                    setters
                        .SetProperty(item => item.Options, generatedQuestion.Options)
                        .SetProperty(item => item.CorrectIndex, generatedQuestion.CorrectIndex),
                cancellationToken
            );

        if (initializedRows == 1)
        {
            currentWord.Options = generatedQuestion.Options;
            currentWord.CorrectIndex = generatedQuestion.CorrectIndex;
        }
        else
        {
            var storedQuestion = await db
                .PracticeSessionWords.AsNoTracking()
                .Where(item =>
                    item.PracticeSessionId == session.Id
                    && item.Position == currentWord.Position
                    && item.WordId == currentWord.WordId
                )
                .Select(item => new { item.Options, item.CorrectIndex })
                .SingleAsync(cancellationToken);

            currentWord.Options =
                storedQuestion.Options
                ?? throw new InvalidOperationException("Stored question has no options.");
            currentWord.CorrectIndex =
                storedQuestion.CorrectIndex
                ?? throw new InvalidOperationException(
                    "Stored question has no correct answer index."
                );
        }
    }

    private async Task<PracticeSessionResponse> ToResponseAsync(
        string userId,
        PracticeSession session,
        CancellationToken cancellationToken
    )
    {
        var orderedWords = session.Words.OrderBy(item => item.Position).ToList();
        var questionWindow =
            session.Status == PracticeSessionStatus.Active
                ? orderedWords
                    .Where(item =>
                        item.Outcome is null
                        && (
                            (
                                item.Format == QuestionFormat.MultipleChoice
                                && item.Options is not null
                                && item.CorrectIndex is not null
                            )
                            || (
                                item.Format == QuestionFormat.Written
                                && item.AcceptedAnswersSnapshot != null
                            )
                        )
                    )
                    .Take(QuestionWindowSize)
                    .Select(CreateQuestionResponse)
                    .ToList()
                : [];
        var question = questionWindow.FirstOrDefault();
        var upcomingQuestions = questionWindow.Skip(1).ToList();
        var resultWords =
            session.Status == PracticeSessionStatus.Completed
                ? await LoadLatestAnsweredQuestionsAsync(
                    userId,
                    session.Level,
                    session.Topic,
                    session.Mode,
                    cancellationToken
                )
                : orderedWords;

        var correct = CreateResultList(resultWords, PracticeOutcome.Correct);
        var review = CreateResultList(resultWords, PracticeOutcome.Review);
        var wrong = CreateResultList(resultWords, PracticeOutcome.Wrong);

        return new PracticeSessionResponse(
            session.Id,
            session.Status,
            session.Level,
            session.Topic,
            session.Mode,
            CreateProgress(resultWords),
            question,
            upcomingQuestions,
            new PracticeResultsResponse(correct, review, wrong)
        );
    }

    private async Task<IReadOnlyList<PracticeSessionWord>> LoadLatestAnsweredQuestionsAsync(
        string userId,
        WordLevel level,
        WordTopic topic,
        PracticeMode mode,
        CancellationToken cancellationToken
    )
    {
        var directions = GetModeDirections(mode);
        var answeredQuestions = await db
            .PracticeSessionWords.AsNoTracking()
            .Where(item =>
                item.PracticeSession.UserId == userId
                && item.PracticeSession.Level == level
                && item.PracticeSession.Topic == topic
                && item.Outcome != null
                && directions.Contains(item.Direction)
            )
            .ToListAsync(cancellationToken);

        return answeredQuestions
            .GroupBy(item => new
            {
                item.WordId,
                item.Direction,
                item.Format,
            })
            .Select(group => group.MaxBy(item => item.AnsweredAtUtc)!)
            .OrderBy(item => item.WordId)
            .ThenBy(item => item.Direction)
            .ThenBy(item => item.Format)
            .ToList();
    }

    private static PracticeQuestionResponse CreateQuestionResponse(PracticeSessionWord sessionWord)
    {
        return new PracticeQuestionResponse(
            sessionWord.Position,
            sessionWord.WordId,
            sessionWord.Direction,
            sessionWord.Format,
            sessionWord.PromptSnapshot,
            sessionWord.Options ?? [],
            sessionWord.CorrectIndex,
            sessionWord.AcceptedAnswersSnapshot ?? []
        );
    }

    private static IReadOnlyList<PracticeResultWordResponse> CreateResultList(
        IEnumerable<PracticeSessionWord> words,
        PracticeOutcome outcome
    )
    {
        return words
            .Where(item => item.Outcome == outcome)
            .Select(item => new PracticeResultWordResponse(
                item.WordId,
                item.Direction,
                item.Format,
                item.PromptSnapshot,
                item.CorrectAnswerSnapshot,
                item.SelectedText
                    ?? (
                        item.SelectedIndex is not null && item.Options is not null
                            ? item.Options[item.SelectedIndex.Value]
                            : null
                    )
            ))
            .ToList();
    }

    private static PracticeProgressResponse CreateProgress(IEnumerable<PracticeSessionWord> words)
    {
        var items = words.ToList();
        return new PracticeProgressResponse(
            items.Count(item => item.Outcome is not null),
            items.Count,
            items.Count(item => item.Outcome == PracticeOutcome.Correct),
            items.Count(item => item.Outcome == PracticeOutcome.Review),
            items.Count(item => item.Outcome == PracticeOutcome.Wrong)
        );
    }

    private static IReadOnlyList<QuestionDirection> GetModeDirections(PracticeMode mode)
    {
        return mode switch
        {
            PracticeMode.EnglishToTurkish => [QuestionDirection.EnglishToTurkish],
            PracticeMode.TurkishToEnglish => [QuestionDirection.TurkishToEnglish],
            PracticeMode.Mixed =>
            [
                QuestionDirection.EnglishToTurkish,
                QuestionDirection.TurkishToEnglish,
            ],
            _ => throw new PracticeValidationException("Seçilen çalışma modu geçersiz."),
        };
    }

    private sealed record CompletedQuestionKey(
        int WordId,
        QuestionDirection Direction,
        QuestionFormat Format
    );
}
