using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WordMatch.API.Data;
using WordMatch.API.Features.Study;
using WordMatch.API.Tests.Infrastructure;

namespace WordMatch.API.Tests.Features.Study.Sessions;

public class StudyEndpointsTests(WordMatchApiFactory factory) : IClassFixture<WordMatchApiFactory>
{
    private static int _clientNumber;

    [Fact]
    public async Task OverviewRequiresAuthenticationAndStartsAtTheFirstCurriculumTopic()
    {
        using var anonymous = CreateClient();
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync("/api/study")).StatusCode
        );

        using var client = CreateClient();
        await RegisterAsync(client);
        var overview = await client.GetFromJsonAsync<JsonElement>("/api/study");
        var currentTopic = overview.GetProperty("curriculumTopic");

        Assert.Equal("A1", currentTopic.GetProperty("level").GetString());
        Assert.Equal("TechnologyAndMedia", currentTopic.GetProperty("topic").GetString());
        Assert.Equal(0, currentTopic.GetProperty("introducedWordCount").GetInt32());
        Assert.Equal(0, currentTopic.GetProperty("recognitionWordCount").GetInt32());
        Assert.Equal(4, currentTopic.GetProperty("wordCount").GetInt32());
        Assert.False(currentTopic.GetProperty("isCompleted").GetBoolean());
        Assert.False(overview.GetProperty("curriculumCompleted").GetBoolean());
    }

    [Fact]
    public async Task TopicOrderComesFromCurriculumDataNotTheTopicName()
    {
        using var client = CreateClient();
        await RegisterAsync(client);

        var overview = await client.GetFromJsonAsync<JsonElement>("/api/study");
        var topics = GetTopics(overview).Select(GetTopicName).ToArray();

        Assert.Equal(WordMatchApiFactory.TopicOrder.Select(item => item.ToString()), topics);
        Assert.NotEqual(topics.Order(StringComparer.Ordinal), topics);
    }

    [Fact]
    public async Task StartCreatesThenResumesTheSameTopicWithoutLeakingAnswers()
    {
        using var client = CreateClient();
        await RegisterAsync(client);

        var first = await PostAsync(client, "/api/study-sessions", new { mode = "Topic" });
        var firstBody = await ReadJsonAsync(first);
        var resumed = await PostAsync(client, "/api/study-sessions", new { mode = "Topic" });
        var resumedBody = await ReadJsonAsync(resumed);
        var question = firstBody.GetProperty("question");

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, resumed.StatusCode);
        Assert.Equal(
            firstBody.GetProperty("sessionId").GetGuid(),
            resumedBody.GetProperty("sessionId").GetGuid()
        );
        Assert.Equal("Topic", firstBody.GetProperty("mode").GetString());
        // The first curriculum topic holds four words, each asked in the two
        // written directions of its learning group.
        Assert.Equal(8, firstBody.GetProperty("progress").GetProperty("totalCount").GetInt32());
        Assert.True(question.GetProperty("isIntroduction").GetBoolean());
        Assert.False(question.TryGetProperty("correctIndex", out _));
        Assert.False(question.TryGetProperty("acceptedAnswers", out _));
    }

    [Fact]
    public async Task RecognitionProgressAppearsBeforeEveryWordIsCompleted()
    {
        using var client = CreateClient();
        await RegisterAsync(client);
        var session = await StartTopicAsync(client);

        while (
            session.GetProperty("question").GetProperty("dimension").GetString()
            == "WrittenRecognition"
        )
            session = await AnswerUnknownAndReadSessionAsync(client, session);

        var overview = await client.GetFromJsonAsync<JsonElement>("/api/study");
        var topic = overview.GetProperty("curriculumTopic");

        Assert.Equal(0, topic.GetProperty("introducedWordCount").GetInt32());
        Assert.Equal(4, topic.GetProperty("recognitionWordCount").GetInt32());
        Assert.Equal(4, topic.GetProperty("wordCount").GetInt32());
    }

    [Fact]
    public async Task TopicSessionOnlyIntroducesTheSelectedTopicsWords()
    {
        using var client = CreateClient();
        await RegisterAsync(client);
        var session = await StartTopicAsync(client);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var sessionId = session.GetProperty("sessionId").GetGuid();
        var questions = await db
            .StudySessionQuestions.Include(item => item.Word)
            .Where(item => item.StudySessionId == sessionId)
            .ToListAsync();

        Assert.Equal(8, questions.Count);
        Assert.All(questions, item => Assert.True(item.IsIntroduction));
        Assert.Equal(
            4,
            questions.Count(item => item.Dimension == VocabularyMasteryDimension.WrittenRecognition)
        );
        Assert.Equal(
            4,
            questions.Count(item => item.Dimension == VocabularyMasteryDimension.WrittenRecall)
        );
        Assert.All(
            questions,
            item =>
                Assert.Equal(
                    WordMatch.API.Features.Words.WordTopic.TechnologyAndMedia,
                    item.Word.Topic
                )
        );
    }

    [Fact]
    public async Task ManuallyChosenTopicIntroductionIsSharedWithCurriculumProgress()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);
        var overview = await client.GetFromJsonAsync<JsonElement>("/api/study");
        var animalsTopicId = GetTopicId(overview, "Animals");

        var chosen = await StartTopicAsync(client, animalsTopicId);
        var chosenWordId = chosen.GetProperty("question").GetProperty("wordId").GetInt32();
        Assert.Equal("Animals", chosen.GetProperty("topic").GetProperty("topic").GetString());
        var completed = chosen;
        while (completed.GetProperty("status").GetString() == "Active")
            completed = await AnswerUnknownAndReadSessionAsync(client, completed);

        // Choosing a topic ahead of schedule does not move the curriculum
        // pointer, but completing both written directions is shared by every
        // view of that topic.
        var afterOverview = await client.GetFromJsonAsync<JsonElement>("/api/study");
        Assert.Equal(
            "TechnologyAndMedia",
            afterOverview.GetProperty("curriculumTopic").GetProperty("topic").GetString()
        );
        Assert.True(
            GetTopics(afterOverview)
                .Single(item => GetTopicName(item) == "Animals")
                .GetProperty("isCompleted")
                .GetBoolean()
        );

        // Reaching that topic later never re-introduces the same word.
        var replay = await PostAsync(
            client,
            "/api/study-sessions",
            new { mode = "Topic", curriculumTopicId = animalsTopicId }
        );
        Assert.Equal(HttpStatusCode.Conflict, replay.StatusCode);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(
            1,
            await db.UserWordIntroductions.CountAsync(item =>
                item.User.Email == email && item.WordId == chosenWordId
            )
        );
    }

    [Fact]
    public async Task CompletingEveryTopicWordCompletesTheTopicAndAdvancesTheCurriculum()
    {
        using var client = CreateClient();
        await RegisterAsync(client);
        var current = await StartTopicAsync(client);

        while (current.GetProperty("status").GetString() == "Active")
            current = await AnswerUnknownAndReadSessionAsync(client, current);

        var summary = current.GetProperty("summary");
        Assert.True(summary.GetProperty("topicCompleted").GetBoolean());
        Assert.Equal(4, summary.GetProperty("introducedWordCount").GetInt32());
        Assert.True(current.GetProperty("topic").GetProperty("isCompleted").GetBoolean());

        var overview = await client.GetFromJsonAsync<JsonElement>("/api/study");
        Assert.Equal(
            "JobsAndWork",
            overview.GetProperty("curriculumTopic").GetProperty("topic").GetString()
        );
    }

    [Fact]
    public async Task AnswerResponseUsesSelectedAnswerToMatchTheStudyClientContract()
    {
        using var client = CreateClient();
        await RegisterAsync(client);
        var session = await StartTopicAsync(client);

        await AnswerUnknownAsync(client, session);
        var current = await client.GetFromJsonAsync<JsonElement>(
            $"/api/study-sessions/{session.GetProperty("sessionId").GetGuid()}"
        );
        var result = current.GetProperty("summary").GetProperty("results")[0];

        Assert.True(result.TryGetProperty("selectedAnswer", out _));
        Assert.False(result.TryGetProperty("givenAnswer", out _));
    }

    [Fact]
    public async Task ReviewSessionSpansTopicsIsCappedAndCarriesNoIntroductions()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);

        // Introduce two topics so the review pool can draw from both.
        var current = await StartTopicAsync(client);
        while (current.GetProperty("status").GetString() == "Active")
            current = await AnswerUnknownAndReadSessionAsync(client, current);
        current = await StartTopicAsync(client);
        while (current.GetProperty("status").GetString() == "Active")
            current = await AnswerUnknownAndReadSessionAsync(client, current);

        await MakeMasteryDueAsync(email);

        var review = await StartReviewAsync(client);
        var total = review.GetProperty("progress").GetProperty("totalCount").GetInt32();

        Assert.Equal("Review", review.GetProperty("mode").GetString());
        Assert.Equal(JsonValueKind.Null, review.GetProperty("topic").ValueKind);
        Assert.InRange(total, 1, StudyPlanner.ReviewSessionSize);
        Assert.False(review.GetProperty("question").GetProperty("isIntroduction").GetBoolean());

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var sessionId = review.GetProperty("sessionId").GetGuid();
        var topics = await db
            .StudySessionQuestions.Include(item => item.Word)
            .Where(item => item.StudySessionId == sessionId)
            .Select(item => item.Word.Topic)
            .Distinct()
            .ToListAsync();

        Assert.True(topics.Count > 1, "review session should be able to span topics");
    }

    [Fact]
    public async Task ContinueStartsTheNextTopicEvenWhenReviewIsDue()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);
        var current = await StartTopicAsync(client);
        while (current.GetProperty("status").GetString() == "Active")
            current = await AnswerUnknownAndReadSessionAsync(client, current);

        await MakeMasteryDueAsync(email);

        var response = await PostAsync(client, "/api/study-sessions/continue", new { });
        var continued = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("Topic", continued.GetProperty("mode").GetString());
        Assert.Equal(
            "JobsAndWork",
            continued.GetProperty("topic").GetProperty("topic").GetString()
        );
    }

    [Fact]
    public async Task CompletedWorkContinuesThroughReviewBeforeTheNextTopic()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);
        var completedTopic = await StartTopicAsync(client);
        while (completedTopic.GetProperty("status").GetString() == "Active")
            completedTopic = await AnswerUnknownAndReadSessionAsync(client, completedTopic);

        await MakeMasteryDueAsync(email);

        var reviewResponse = await PostAsync(
            client,
            $"/api/study-sessions/{completedTopic.GetProperty("sessionId").GetGuid()}/continue",
            new { }
        );
        var review = await ReadJsonAsync(reviewResponse);

        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        Assert.Equal("Review", review.GetProperty("mode").GetString());

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var persistedReview = await db.StudySessions.FindAsync(
                review.GetProperty("sessionId").GetGuid()
            );
            Assert.NotNull(persistedReview);
            Assert.Equal(
                completedTopic.GetProperty("topic").GetProperty("id").GetInt32(),
                persistedReview.ReturnToCurriculumTopicId
            );
        }

        while (review.GetProperty("status").GetString() == "Active")
            review = await AnswerUnknownAndReadSessionAsync(client, review);

        var nextTopicResponse = await PostAsync(
            client,
            $"/api/study-sessions/{review.GetProperty("sessionId").GetGuid()}/continue",
            new { }
        );
        var nextTopic = await ReadJsonAsync(nextTopicResponse);

        Assert.Equal(HttpStatusCode.Created, nextTopicResponse.StatusCode);
        Assert.Equal("Topic", nextTopic.GetProperty("mode").GetString());
        Assert.Equal(
            "JobsAndWork",
            nextTopic.GetProperty("topic").GetProperty("topic").GetString()
        );
    }

    [Fact]
    public async Task CompletedWorkContinuesToTheNextTopicWhenNothingIsDue()
    {
        using var client = CreateClient();
        await RegisterAsync(client);
        var completedTopic = await StartTopicAsync(client);
        while (completedTopic.GetProperty("status").GetString() == "Active")
            completedTopic = await AnswerUnknownAndReadSessionAsync(client, completedTopic);

        var response = await PostAsync(
            client,
            $"/api/study-sessions/{completedTopic.GetProperty("sessionId").GetGuid()}/continue",
            new { }
        );
        var nextTopic = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("Topic", nextTopic.GetProperty("mode").GetString());
        Assert.Equal(
            "JobsAndWork",
            nextTopic.GetProperty("topic").GetProperty("topic").GetString()
        );
    }

    [Fact]
    public async Task CompletedResultsReserveContinuationForTheirOwningDevice()
    {
        using var firstDevice = CreateClient();
        var email = await RegisterAsync(firstDevice);
        var completed = await StartTopicAsync(firstDevice);
        while (completed.GetProperty("status").GetString() == "Active")
            completed = await AnswerUnknownAndReadSessionAsync(firstDevice, completed);

        using var secondDevice = CreateClient();
        await LoginAsync(secondDevice, email);

        var secondOverview = await secondDevice.GetFromJsonAsync<JsonElement>("/api/study");
        Assert.Equal(
            "Unavailable",
            secondOverview.GetProperty("nextAction").GetProperty("kind").GetString()
        );

        using var competingStart = await PostAsync(
            secondDevice,
            "/api/study-sessions",
            new { mode = "Topic" }
        );
        Assert.Equal(HttpStatusCode.Conflict, competingStart.StatusCode);
        var conflict = await ReadJsonAsync(competingStart);
        Assert.Equal(
            "study_session_owned_by_another_device",
            conflict.GetProperty("code").GetString()
        );

        var takeover = await PostAsync(secondDevice, "/api/study-sessions/takeover", new { });
        Assert.Equal(HttpStatusCode.OK, takeover.StatusCode);
        var takenOverResults = await ReadJsonAsync(takeover);
        Assert.Equal("Completed", takenOverResults.GetProperty("status").GetString());
        Assert.Equal(
            completed.GetProperty("sessionId").GetGuid(),
            takenOverResults.GetProperty("sessionId").GetGuid()
        );

        var oldOwnerContinuation = await PostAsync(
            firstDevice,
            $"/api/study-sessions/{completed.GetProperty("sessionId").GetGuid()}/continue",
            new { }
        );
        Assert.Equal(HttpStatusCode.Conflict, oldOwnerContinuation.StatusCode);
        var oldOwnerConflict = await ReadJsonAsync(oldOwnerContinuation);
        Assert.Equal(
            "study_session_owned_by_another_device",
            oldOwnerConflict.GetProperty("code").GetString()
        );

        var continuation = await PostAsync(
            secondDevice,
            $"/api/study-sessions/{completed.GetProperty("sessionId").GetGuid()}/continue",
            new { }
        );
        Assert.Equal(HttpStatusCode.Created, continuation.StatusCode);
    }

    [Fact]
    public async Task ReturningHomeFromCompletedResultsReleasesTheirContinuation()
    {
        using var client = CreateClient();
        await RegisterAsync(client);
        var completed = await StartTopicAsync(client);
        while (completed.GetProperty("status").GetString() == "Active")
            completed = await AnswerUnknownAndReadSessionAsync(client, completed);

        var sessionId = completed.GetProperty("sessionId").GetGuid();
        var leave = await DeleteAsync(client, $"/api/study-sessions/{sessionId}");
        var restarted = await PostAsync(client, "/api/study-sessions", new { mode = "Topic" });

        Assert.Equal(HttpStatusCode.NoContent, leave.StatusCode);
        Assert.Equal(HttpStatusCode.Created, restarted.StatusCode);
    }

    [Fact]
    public async Task ContinueLeavesAnActiveReviewAndStartsTheCurrentTopic()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);
        var current = await StartTopicAsync(client);
        while (current.GetProperty("status").GetString() == "Active")
            current = await AnswerUnknownAndReadSessionAsync(client, current);

        await MakeMasteryDueAsync(email);
        var review = await StartReviewAsync(client);

        var response = await PostAsync(client, "/api/study-sessions/continue", new { });
        var topicSession = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("Topic", topicSession.GetProperty("mode").GetString());
        Assert.Equal(
            "JobsAndWork",
            topicSession.GetProperty("topic").GetProperty("topic").GetString()
        );

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var savedReview = await db.StudySessions.FindAsync(
            review.GetProperty("sessionId").GetGuid()
        );
        Assert.NotNull(savedReview);
        Assert.Equal(StudySessionStatus.Abandoned, savedReview.Status);
    }

    [Fact]
    public async Task ReviewCountIncludesOnlyDueAnsweredDimensions()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);
        var current = await StartTopicAsync(client);
        while (current.GetProperty("status").GetString() == "Active")
            current = await AnswerUnknownAndReadSessionAsync(client, current);

        var summaryCount = current
            .GetProperty("summary")
            .GetProperty("reviewQuestionCount")
            .GetInt32();
        var overview = await client.GetFromJsonAsync<JsonElement>("/api/study");

        // Nothing is due yet, so a direction that was never answered is not
        // silently introduced through the review queue.
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var now = DateTimeOffset.UtcNow;
        Assert.False(
            await db.UserWordMastery.AnyAsync(item =>
                item.User.Email == email && item.NextReviewAtUtc <= now
            )
        );
        Assert.Equal(0, summaryCount);
        Assert.Equal(0, overview.GetProperty("reviewQuestionCount").GetInt32());

        await MakeMasteryDueAsync(email);
        overview = await client.GetFromJsonAsync<JsonElement>("/api/study");
        Assert.InRange(
            overview.GetProperty("reviewQuestionCount").GetInt32(),
            1,
            StudyPlanner.ReviewSessionSize
        );
    }

    [Fact]
    public async Task ReviewSessionRejectsATopicSelection()
    {
        using var client = CreateClient();
        await RegisterAsync(client);

        var response = await PostAsync(
            client,
            "/api/study-sessions",
            new { mode = "Review", curriculumTopicId = 1 }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ReviewSessionWithNothingToRepeatReturnsConflict()
    {
        using var client = CreateClient();
        await RegisterAsync(client);

        var response = await PostAsync(client, "/api/study-sessions", new { mode = "Review" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var overview = await client.GetFromJsonAsync<JsonElement>("/api/study");
        Assert.Equal(
            "StartTopic",
            overview.GetProperty("nextAction").GetProperty("kind").GetString()
        );
    }

    [Fact]
    public async Task ReviewSessionIsUnavailableUntilATopicIsCompleted()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);

        var activeTopicSession = await StartTopicAsync(client);
        var blockedWhileActive = await PostAsync(
            client,
            "/api/study-sessions",
            new { mode = "Review" }
        );
        Assert.Equal(HttpStatusCode.Conflict, blockedWhileActive.StatusCode);

        var current = activeTopicSession;
        while (current.GetProperty("status").GetString() == "Active")
            current = await AnswerUnknownAndReadSessionAsync(client, current);

        await MakeMasteryDueAsync(email);
        var review = await StartReviewAsync(client);
        Assert.Equal("Review", review.GetProperty("mode").GetString());
    }

    [Fact]
    public async Task UnknownTopicSelectionReturnsNotFound()
    {
        using var client = CreateClient();
        await RegisterAsync(client);

        var response = await PostAsync(
            client,
            "/api/study-sessions",
            new { mode = "Topic", curriculumTopicId = 999_999 }
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeferringASkillEndsTheCurrentSessionWithoutRecordingAnything()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);
        var session = await StartTopicAsync(client);
        var sessionId = session.GetProperty("sessionId").GetGuid();
        // Answer one question so there is mastery state that must stay frozen.
        var afterAnswer = await AnswerUnknownAndReadSessionAsync(client, session);
        var before = await ReadMasterySnapshotAsync(email);

        var response = await PostAsync(
            client,
            $"/api/study-sessions/{sessionId}/deferrals",
            new { dimension = "WrittenRecall" }
        );
        var deferred = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Completed", deferred.GetProperty("status").GetString());
        Assert.Equal(
            afterAnswer.GetProperty("progress").GetProperty("answeredCount").GetInt32(),
            deferred.GetProperty("progress").GetProperty("answeredCount").GetInt32()
        );

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var pause = await db.UserStudySkillPauses.SingleAsync(item =>
            item.User.Email == email && item.Dimension == VocabularyMasteryDimension.WrittenRecall
        );
        Assert.InRange(
            pause.DeferredUntilUtc,
            DateTimeOffset.UtcNow.AddMinutes(9),
            DateTimeOffset.UtcNow.AddMinutes(11)
        );
        var questions = await db
            .StudySessionQuestions.Where(item => item.StudySessionId == sessionId)
            .ToListAsync();

        // Nothing beyond the single answered question was recorded. The next
        // session—not this snapshot—will be planned without the deferred skill.
        Assert.Single(questions, item => item.Outcome is not null);
        Assert.DoesNotContain(questions, item => item.Outcome is null);
        Assert.Equal(before, await ReadMasterySnapshotAsync(email));
        Assert.Equal(
            1,
            await db.UserWordIntroductions.CountAsync(item => item.User.Email == email)
        );
    }

    [Fact]
    public async Task LeavingTheDashboardAbandonsTheActiveSessionAndFreesTheAccount()
    {
        using var client = CreateClient();
        await RegisterAsync(client);
        var session = await StartTopicAsync(client);
        var sessionId = session.GetProperty("sessionId").GetGuid();

        var leave = await DeleteAsync(client, $"/api/study-sessions/{sessionId}");
        var restarted = await PostAsync(client, "/api/study-sessions", new { mode = "Topic" });

        Assert.Equal(HttpStatusCode.NoContent, leave.StatusCode);
        Assert.Equal(HttpStatusCode.Created, restarted.StatusCode);
        var restartedSession = await ReadJsonAsync(restarted);
        Assert.NotEqual(sessionId, restartedSession.GetProperty("sessionId").GetGuid());

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(
            StudySessionStatus.Abandoned,
            await db
                .StudySessions.Where(item => item.Id == sessionId)
                .Select(item => item.Status)
                .SingleAsync()
        );
    }

    [Fact]
    public async Task DeferringTheLastRemainingSkillIsRejected()
    {
        using var client = CreateClient();
        await RegisterAsync(client);
        var session = await StartTopicAsync(client);
        var sessionId = session.GetProperty("sessionId").GetGuid();

        var first = await PostAsync(
            client,
            $"/api/study-sessions/{sessionId}/deferrals",
            new { dimension = "WrittenRecall" }
        );
        var second = await PostAsync(
            client,
            $"/api/study-sessions/{sessionId}/deferrals",
            new { dimension = "WrittenRecognition" }
        );

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task DeferralAppliesWhenTheNextSessionIsCreated()
    {
        using var client = CreateClient();
        await RegisterAsync(client);
        var session = await StartTopicAsync(client);
        await PostAsync(
            client,
            $"/api/study-sessions/{session.GetProperty("sessionId").GetGuid()}/deferrals",
            new { dimension = "WrittenRecall" }
        );

        var next = await StartTopicAsync(
            client,
            GetTopicId(await client.GetFromJsonAsync<JsonElement>("/api/study"), "JobsAndWork")
        );

        Assert.Equal(
            "WrittenRecognition",
            next.GetProperty("question").GetProperty("dimension").GetString()
        );
    }

    [Fact]
    public async Task ContinueKeepsAnActiveSessionThenReturnsToTheFirstIncompleteTopic()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);
        var session = await StartTopicAsync(client);

        while (
            session.GetProperty("question").GetProperty("dimension").GetString()
            == "WrittenRecognition"
        )
            session = await AnswerUnknownAndReadSessionAsync(client, session);

        var deferredResponse = await PostAsync(
            client,
            $"/api/study-sessions/{session.GetProperty("sessionId").GetGuid()}/deferrals",
            new { dimension = "WrittenRecall" }
        );
        var deferred = await ReadJsonAsync(deferredResponse);
        Assert.Equal(HttpStatusCode.OK, deferredResponse.StatusCode);
        Assert.Equal("Completed", deferred.GetProperty("status").GetString());

        var duringPause = await client.GetFromJsonAsync<JsonElement>("/api/study");
        Assert.Equal(
            "TechnologyAndMedia",
            duringPause.GetProperty("curriculumTopic").GetProperty("topic").GetString()
        );
        Assert.Equal(
            "JobsAndWork",
            duringPause
                .GetProperty("nextAction")
                .GetProperty("topic")
                .GetProperty("topic")
                .GetString()
        );

        var nextTopic = await StartTopicAsync(client);
        Assert.Equal(
            "JobsAndWork",
            nextTopic.GetProperty("topic").GetProperty("topic").GetString()
        );
        Assert.Equal(
            "WrittenRecognition",
            nextTopic.GetProperty("question").GetProperty("dimension").GetString()
        );

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.UserStudySkillPauses.Where(item => item.User.Email == email).ExecuteDeleteAsync();

        var stillActive = await StartTopicAsync(client);
        Assert.Equal(
            nextTopic.GetProperty("sessionId").GetGuid(),
            stillActive.GetProperty("sessionId").GetGuid()
        );

        while (nextTopic.GetProperty("status").GetString() == "Active")
            nextTopic = await AnswerUnknownAndReadSessionAsync(client, nextTopic);

        var afterPause = await StartTopicAsync(client);
        Assert.Equal(
            "TechnologyAndMedia",
            afterPause.GetProperty("topic").GetProperty("topic").GetString()
        );
        Assert.Equal(
            "WrittenRecall",
            afterPause.GetProperty("question").GetProperty("dimension").GetString()
        );
    }

    [Fact]
    public async Task DoubleSubmitReturnsConflictAndOnlyAdvancesOnce()
    {
        using var client = CreateClient();
        await RegisterAsync(client);
        var session = await StartTopicAsync(client);
        var question = session.GetProperty("question");
        var payload = new
        {
            position = question.GetProperty("position").GetInt32(),
            wordId = question.GetProperty("wordId").GetInt32(),
            selectedIndex = (int?)null,
            writtenAnswer = (string?)null,
        };

        var first = await PostAsync(
            client,
            $"/api/study-sessions/{session.GetProperty("sessionId").GetGuid()}/answers",
            payload
        );
        var second = await PostAsync(
            client,
            $"/api/study-sessions/{session.GetProperty("sessionId").GetGuid()}/answers",
            payload
        );

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        var current = await client.GetFromJsonAsync<JsonElement>(
            $"/api/study-sessions/{session.GetProperty("sessionId").GetGuid()}"
        );
        Assert.Equal(1, current.GetProperty("progress").GetProperty("answeredCount").GetInt32());
    }

    [Fact]
    public async Task InvalidAnswerDoesNotCreateMasteryOrCurriculumProgress()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);
        var session = await StartTopicAsync(client);
        var question = session.GetProperty("question");

        var response = await PostAsync(
            client,
            $"/api/study-sessions/{session.GetProperty("sessionId").GetGuid()}/answers",
            new
            {
                position = question.GetProperty("position").GetInt32(),
                wordId = question.GetProperty("wordId").GetInt32(),
                selectedIndex = 99,
            }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.False(await db.UserWordMastery.AnyAsync(item => item.User.Email == email));
        Assert.False(await db.UserWordIntroductions.AnyAsync(item => item.User.Email == email));
    }

    [Fact]
    public async Task SwitchingTopicsRequiresConfirmationBeforeReplacingTheActiveSession()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);
        var overview = await client.GetFromJsonAsync<JsonElement>("/api/study");
        var first = await StartTopicAsync(client);
        await AnswerUnknownAsync(client, first);

        var topicId = GetTopicId(overview, "Colors");
        var withoutConfirmation = await PostAsync(
            client,
            "/api/study-sessions",
            new { mode = "Topic", curriculumTopicId = topicId }
        );
        Assert.Equal(HttpStatusCode.Conflict, withoutConfirmation.StatusCode);

        var replacementResponse = await PostAsync(
            client,
            "/api/study-sessions",
            new
            {
                mode = "Topic",
                curriculumTopicId = topicId,
                replaceActiveSession = true,
            }
        );
        replacementResponse.EnsureSuccessStatusCode();
        var replacement = await ReadJsonAsync(replacementResponse);
        var oldResponse = await client.GetAsync(
            $"/api/study-sessions/{first.GetProperty("sessionId").GetGuid()}"
        );

        Assert.NotEqual(
            first.GetProperty("sessionId").GetGuid(),
            replacement.GetProperty("sessionId").GetGuid()
        );
        Assert.Equal(HttpStatusCode.NotFound, oldResponse.StatusCode);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(1, await db.UserWordMastery.CountAsync(item => item.User.Email == email));
        Assert.Equal(
            1,
            await db.UserWordIntroductions.CountAsync(item => item.User.Email == email)
        );
    }

    [Fact]
    public async Task SessionIsHiddenFromAnotherUser()
    {
        using var owner = CreateClient();
        using var other = CreateClient();
        await RegisterAsync(owner);
        await RegisterAsync(other);
        var session = await StartTopicAsync(owner);

        var response = await other.GetAsync(
            $"/api/study-sessions/{session.GetProperty("sessionId").GetGuid()}"
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MutationWithoutXsrfReturnsBadRequest()
    {
        using var client = CreateClient();
        await RegisterAsync(client);

        var response = await client.PostAsJsonAsync("/api/study-sessions", new { mode = "Topic" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // Every field a deferral must leave untouched, flattened so a mismatch
    // names the column that moved.
    private async Task<List<string>> ReadMasterySnapshotAsync(string email)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var masteries = await db
            .UserWordMastery.AsNoTracking()
            .Where(item => item.User.Email == email)
            .OrderBy(item => item.WordId)
            .ThenBy(item => item.Dimension)
            .ToListAsync();
        return masteries
            .Select(item =>
                $"{item.WordId}|{item.Dimension}|stage={item.Stage}|correct={item.CorrectCount}"
                + $"|review={item.ReviewCount}|wrong={item.WrongCount}"
                + $"|next={item.NextReviewAtUtc:O}|last={item.LastStudiedAtUtc:O}"
            )
            .ToList();
    }

    private async Task MakeMasteryDueAsync(string email)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var dueAt = DateTimeOffset.UtcNow.AddMinutes(-1);
        await db
            .UserWordMastery.Where(item => item.User.Email == email)
            .ExecuteUpdateAsync(setters =>
                setters.SetProperty(item => item.NextReviewAtUtc, dueAt)
            );
    }

    [Fact]
    public async Task StartingASessionFromAnotherDevice_DoesNotJoinTheWinner()
    {
        using var phone = CreateClient();
        var email = await RegisterAsync(phone);
        var userId = await ReadUserIdAsync(email);

        // The session is owned by the browser that starts it, even though the
        // account itself may stay signed in on several devices.
        await using var scope = factory.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<StudyService>();
        _ = await service.StartOrResumeAsync(
            userId,
            new StartStudySessionRequest(StudySessionMode.Topic),
            CancellationToken.None
        );

        using var response = await PostAsync(phone, "/api/study-sessions", new { mode = "Topic" });

        // A second device must neither join the winning question sequence nor
        // silently create another active session.
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        await using var verifyScope = factory.Services.CreateAsyncScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(
            1,
            await verifyDb.StudySessions.CountAsync(item =>
                item.UserId == userId && item.Status == StudySessionStatus.Active
            )
        );
    }

    [Fact]
    public async Task StartingASessionFromAnotherDevice_ReportsAMachineReadableCode()
    {
        using var phone = CreateClient();
        var email = await RegisterAsync(phone);
        var userId = await ReadUserIdAsync(email);

        await using var scope = factory.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<StudyService>();
        _ = await service.StartOrResumeAsync(
            userId,
            new StartStudySessionRequest(StudySessionMode.Topic),
            CancellationToken.None
        );

        using var response = await PostAsync(phone, "/api/study-sessions", new { mode = "Topic" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await ReadJsonAsync(response);
        // A stable code lets the client recognize this specific conflict without
        // pattern-matching the human-facing message.
        Assert.Equal("study_session_owned_by_another_device", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task AnotherDeviceCanExplicitlyTakeOverAnActiveSession()
    {
        using var phone = CreateClient();
        var email = await RegisterAsync(phone);
        var session = await StartTopicAsync(phone);
        using var otherDevice = CreateClient();
        await LoginAsync(otherDevice, email);

        var takeover = await PostAsync(otherDevice, "/api/study-sessions/takeover", new { });
        Assert.Equal(HttpStatusCode.OK, takeover.StatusCode);
        var takenOver = await ReadJsonAsync(takeover);
        Assert.Equal(
            session.GetProperty("sessionId").GetGuid(),
            takenOver.GetProperty("sessionId").GetGuid()
        );

        var oldOwner = await phone.GetAsync(
            $"/api/study-sessions/{session.GetProperty("sessionId").GetGuid()}"
        );
        Assert.Equal(HttpStatusCode.NotFound, oldOwner.StatusCode);
    }

    private async Task<string> ReadUserIdAsync(string email)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db
            .Users.Where(user => user.Email == email)
            .Select(user => user.Id)
            .SingleAsync();
    }

    private async Task<string> RegisterAsync(HttpClient client)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"study-{suffix}@example.com";
        var response = await PostAsync(
            client,
            "/api/auth/register",
            new
            {
                email,
                username = $"study-{suffix[..12]}",
                password = "Password1",
            }
        );
        response.EnsureSuccessStatusCode();
        return email;
    }

    // Signs a second HttpClient — a genuinely different device, with its own
    // cookie jar — into an account RegisterAsync already created.
    private async Task LoginAsync(HttpClient client, string email)
    {
        var response = await PostAsync(
            client,
            "/api/auth/login",
            new { identifier = email, password = "Password1" }
        );
        response.EnsureSuccessStatusCode();
    }

    private static IEnumerable<JsonElement> GetTopics(JsonElement overview) =>
        overview
            .GetProperty("levels")
            .EnumerateArray()
            .SelectMany(level => level.GetProperty("topics").EnumerateArray());

    private static string? GetTopicName(JsonElement topic) =>
        topic.GetProperty("topic").GetString();

    private static int GetTopicId(JsonElement overview, string topic) =>
        GetTopics(overview)
            .Single(item => GetTopicName(item) == topic)
            .GetProperty("id")
            .GetInt32();

    private static async Task<JsonElement> StartTopicAsync(
        HttpClient client,
        int? curriculumTopicId = null
    )
    {
        var response = curriculumTopicId is null
            ? await PostAsync(client, "/api/study-sessions/continue", new { })
            : await PostAsync(
                client,
                "/api/study-sessions",
                new { mode = "Topic", curriculumTopicId }
            );
        response.EnsureSuccessStatusCode();
        return await ReadJsonAsync(response);
    }

    private static async Task<JsonElement> StartReviewAsync(HttpClient client)
    {
        var response = await PostAsync(client, "/api/study-sessions", new { mode = "Review" });
        response.EnsureSuccessStatusCode();
        return await ReadJsonAsync(response);
    }

    private static async Task AnswerUnknownAsync(HttpClient client, JsonElement session)
    {
        var question = session.GetProperty("question");
        var response = await PostAsync(
            client,
            $"/api/study-sessions/{session.GetProperty("sessionId").GetGuid()}/answers",
            new
            {
                position = question.GetProperty("position").GetInt32(),
                wordId = question.GetProperty("wordId").GetInt32(),
                selectedIndex = (int?)null,
                writtenAnswer = (string?)null,
            }
        );
        response.EnsureSuccessStatusCode();
    }

    private static async Task<JsonElement> AnswerUnknownAndReadSessionAsync(
        HttpClient client,
        JsonElement session
    )
    {
        var question = session.GetProperty("question");
        var response = await PostAsync(
            client,
            $"/api/study-sessions/{session.GetProperty("sessionId").GetGuid()}/answers",
            new
            {
                position = question.GetProperty("position").GetInt32(),
                wordId = question.GetProperty("wordId").GetInt32(),
                selectedIndex = (int?)null,
                writtenAnswer = (string?)null,
            }
        );
        response.EnsureSuccessStatusCode();
        var body = await ReadJsonAsync(response);
        return body.GetProperty("session").Clone();
    }

    private static async Task<HttpResponseMessage> PostAsync<T>(
        HttpClient client,
        string path,
        T body
    )
    {
        var token = await client.GetFromJsonAsync<JsonElement>("/api/auth/antiforgery");
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Add("X-XSRF-TOKEN", token.GetProperty("token").GetString());
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> DeleteAsync(HttpClient client, string path)
    {
        var token = await client.GetFromJsonAsync<JsonElement>("/api/auth/antiforgery");
        using var request = new HttpRequestMessage(HttpMethod.Delete, path);
        request.Headers.Add("X-XSRF-TOKEN", token.GetProperty("token").GetString());
        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }

    private HttpClient CreateClient()
    {
        var client = factory.CreateClient();
        var number = Interlocked.Increment(ref _clientNumber);
        client.DefaultRequestHeaders.Add(
            "X-Forwarded-For",
            $"11.{number / 65536 % 256}.{number / 256 % 256}.{number % 256}"
        );
        return client;
    }
}
