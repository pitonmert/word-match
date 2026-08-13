using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using WordMatch.API.Tests.Infrastructure;

namespace WordMatch.API.Tests.Features.Practice.Sessions;

public class PracticeSessionEndpointsTests(WordMatchApiFactory factory)
    : IClassFixture<WordMatchApiFactory>
{
    private static int _clientNumber;

    [Fact]
    public async Task ActivePractice_ResumesOnAnotherAuthenticatedClient()
    {
        var credentials = CreateCredentials();
        using var firstClient = CreateIsolatedClient();
        using var secondClient = CreateIsolatedClient();

        await RegisterAsync(firstClient, credentials);
        var firstSession = await StartAnimalsPracticeAsync(firstClient);

        await LoginAsync(secondClient, credentials);
        var resumedSession = await StartAnimalsPracticeAsync(secondClient);

        Assert.Equal(
            firstSession.RootElement.GetProperty("sessionId").GetGuid(),
            resumedSession.RootElement.GetProperty("sessionId").GetGuid()
        );
        Assert.Equal(
            "EnglishToTurkish",
            resumedSession.RootElement.GetProperty("mode").GetString()
        );
    }

    [Fact]
    public async Task StartingDifferentMode_ReplacesUnansweredPractice()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());
        using var session = await StartAnimalsPracticeAsync(client);
        var sessionId = session.RootElement.GetProperty("sessionId").GetGuid();

        using var replacement = await StartAnimalsPracticeAsync(client, "TurkishToEnglish");

        Assert.NotEqual(sessionId, replacement.RootElement.GetProperty("sessionId").GetGuid());
        Assert.Equal("TurkishToEnglish", replacement.RootElement.GetProperty("mode").GetString());
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.GetAsync($"/api/practice-sessions/{sessionId}")).StatusCode
        );
    }

    [Fact]
    public async Task AnsweredPractice_CanChangeModeWithoutRepeatingCompletedQuestion()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());
        using var session = await StartAnimalsPracticeAsync(client);
        var root = session.RootElement;
        var sessionId = root.GetProperty("sessionId").GetGuid();
        var question = root.GetProperty("question");

        var answer = await PostWithAntiforgeryAsync(
            client,
            $"/api/practice-sessions/{sessionId}/answers",
            CreateCorrectAnswerPayload(question)
        );
        answer.EnsureSuccessStatusCode();

        using var replacement = await StartAnimalsPracticeAsync(client, "Mixed");

        Assert.NotEqual(sessionId, replacement.RootElement.GetProperty("sessionId").GetGuid());
        Assert.Equal(
            3,
            replacement.RootElement.GetProperty("progress").GetProperty("totalCount").GetInt32()
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.GetAsync($"/api/practice-sessions/{sessionId}")).StatusCode
        );

        await CompleteSessionWithCorrectAnswersAsync(client, replacement.RootElement);
        var combinedResults = await client.GetFromJsonAsync<JsonElement>(
            "/api/practice-sessions/results?level=A1&topic=Animals&mode=Mixed"
        );

        Assert.Equal(
            4,
            combinedResults.GetProperty("progress").GetProperty("totalCount").GetInt32()
        );
    }

    [Fact]
    public async Task StartingPractice_WithOnlyPartOfSpeech_ReturnsBadRequest()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());

        var response = await PostWithAntiforgeryAsync(
            client,
            "/api/practice-sessions",
            new { level = "A1", partOfSpeech = "Noun" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task StartingPractice_WithInvalidNumericMode_ReturnsBadRequest()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());

        var response = await PostWithAntiforgeryAsync(
            client,
            "/api/practice-sessions",
            new
            {
                level = "A1",
                topic = "Animals",
                mode = 999,
            }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SecondAnswerForSameQuestion_ReturnsConflict()
    {
        var credentials = CreateCredentials();
        using var firstClient = CreateIsolatedClient();
        using var secondClient = CreateIsolatedClient();

        await RegisterAsync(firstClient, credentials);
        await LoginAsync(secondClient, credentials);

        var session = await StartAnimalsPracticeAsync(firstClient);
        var sessionId = session.RootElement.GetProperty("sessionId").GetGuid();
        var question = session.RootElement.GetProperty("question");
        var position = question.GetProperty("position").GetInt32();
        var wordId = question.GetProperty("wordId").GetInt32();
        var firstAnswer = await PostWithAntiforgeryAsync(
            firstClient,
            $"/api/practice-sessions/{sessionId}/answers",
            new
            {
                position,
                wordId,
                selectedIndex = (int?)null,
            }
        );
        var secondAnswer = await PostWithAntiforgeryAsync(
            secondClient,
            $"/api/practice-sessions/{sessionId}/answers",
            new
            {
                position,
                wordId,
                selectedIndex = (int?)null,
            }
        );

        Assert.True(firstAnswer.IsSuccessStatusCode, await firstAnswer.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Conflict, secondAnswer.StatusCode);
    }

    [Fact]
    public async Task WrittenQuestion_ValidatesPayloadAndNormalizesTheAnswer()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());
        using var session = await StartAnimalsPracticeAsync(client, "Mixed");
        var currentSession = session.RootElement.Clone();

        while (
            currentSession.GetProperty("question").GetProperty("format").GetString()
            == "MultipleChoice"
        )
        {
            var choiceQuestion = currentSession.GetProperty("question");
            var choiceAnswer = await PostWithAntiforgeryAsync(
                client,
                $"/api/practice-sessions/{currentSession.GetProperty("sessionId").GetGuid()}/answers",
                new
                {
                    position = choiceQuestion.GetProperty("position").GetInt32(),
                    wordId = choiceQuestion.GetProperty("wordId").GetInt32(),
                    selectedIndex = choiceQuestion.GetProperty("correctIndex").GetInt32(),
                }
            );
            choiceAnswer.EnsureSuccessStatusCode();
            using var choiceAnswerBody = JsonDocument.Parse(
                await choiceAnswer.Content.ReadAsStringAsync()
            );
            currentSession = choiceAnswerBody.RootElement.GetProperty("session").Clone();
        }

        var question = currentSession.GetProperty("question");
        var sessionId = currentSession.GetProperty("sessionId").GetGuid();
        var position = question.GetProperty("position").GetInt32();
        var wordId = question.GetProperty("wordId").GetInt32();
        var acceptedAnswer = question.GetProperty("acceptedAnswers")[0].GetString()!;

        Assert.Equal("Written", question.GetProperty("format").GetString());
        Assert.Empty(question.GetProperty("options").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, question.GetProperty("correctIndex").ValueKind);

        var twoAnswerTypes = await PostWithAntiforgeryAsync(
            client,
            $"/api/practice-sessions/{sessionId}/answers",
            new
            {
                position,
                wordId,
                selectedIndex = 0,
                writtenAnswer = acceptedAnswer,
            }
        );
        var selectedOption = await PostWithAntiforgeryAsync(
            client,
            $"/api/practice-sessions/{sessionId}/answers",
            new
            {
                position,
                wordId,
                selectedIndex = 0,
            }
        );
        var emptyAnswer = await PostWithAntiforgeryAsync(
            client,
            $"/api/practice-sessions/{sessionId}/answers",
            new
            {
                position,
                wordId,
                writtenAnswer = " \t ",
            }
        );

        Assert.Equal(HttpStatusCode.BadRequest, twoAnswerTypes.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, selectedOption.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, emptyAnswer.StatusCode);

        var culture =
            question.GetProperty("direction").GetString() == "EnglishToTurkish"
                ? CultureInfo.GetCultureInfo("tr-TR")
                : CultureInfo.InvariantCulture;
        var submittedAnswer = $"  {acceptedAnswer.ToLower(culture)}   ";
        var validAnswer = await PostWithAntiforgeryAsync(
            client,
            $"/api/practice-sessions/{sessionId}/answers",
            new
            {
                position,
                wordId,
                writtenAnswer = submittedAnswer,
            }
        );

        validAnswer.EnsureSuccessStatusCode();
        using var validAnswerBody = JsonDocument.Parse(
            await validAnswer.Content.ReadAsStringAsync()
        );
        Assert.Equal("Correct", validAnswerBody.RootElement.GetProperty("outcome").GetString());
        Assert.Equal(
            acceptedAnswer.ToLower(culture),
            validAnswerBody.RootElement.GetProperty("writtenAnswer").GetString()
        );
    }

    [Fact]
    public async Task ConcurrentSessionLoads_ReturnSameStoredQuestionOptions()
    {
        var credentials = CreateCredentials();
        using var firstClient = CreateIsolatedClient();
        using var secondClient = CreateIsolatedClient();

        await RegisterAsync(firstClient, credentials);
        await LoginAsync(secondClient, credentials);

        using var session = await StartAnimalsPracticeAsync(firstClient);
        var sessionId = session.RootElement.GetProperty("sessionId").GetGuid();

        var startGate = new TaskCompletionSource<bool>(
            TaskCreationOptions.RunContinuationsAsynchronously
        );
        var loadTasks = Enumerable
            .Range(0, 12)
            .Select(async index =>
            {
                await startGate.Task;
                var client = index % 2 == 0 ? firstClient : secondClient;
                var response = await client.GetAsync($"/api/practice-sessions/{sessionId}");
                response.EnsureSuccessStatusCode();

                using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                var question = document.RootElement.GetProperty("question");

                return new ConcurrentQuestion(
                    question.GetProperty("position").GetInt32(),
                    question.GetProperty("wordId").GetInt32(),
                    question.GetProperty("format").GetString()!,
                    question.GetProperty("correctIndex").ValueKind == JsonValueKind.Null
                        ? null
                        : question.GetProperty("correctIndex").GetInt32(),
                    question
                        .GetProperty("options")
                        .EnumerateArray()
                        .Select(option => option.GetString()!)
                        .ToArray(),
                    question
                        .GetProperty("acceptedAnswers")
                        .EnumerateArray()
                        .Select(answer => answer.GetString()!)
                        .ToArray()
                );
            })
            .ToList();

        startGate.SetResult(true);
        var loadedQuestions = await Task.WhenAll(loadTasks);
        var expectedQuestion = loadedQuestions[0];

        Assert.All(
            loadedQuestions,
            question =>
            {
                Assert.Equal(expectedQuestion.WordId, question.WordId);
                Assert.Equal(expectedQuestion.Format, question.Format);
                Assert.Equal(expectedQuestion.Options, question.Options);
                Assert.Equal(expectedQuestion.CorrectIndex, question.CorrectIndex);
                Assert.Equal(expectedQuestion.AcceptedAnswers, question.AcceptedAnswers);
            }
        );

        var answer = await PostWithAntiforgeryAsync(
            firstClient,
            $"/api/practice-sessions/{sessionId}/answers",
            CreateCorrectAnswerPayload(session.RootElement.GetProperty("question"))
        );
        answer.EnsureSuccessStatusCode();

        using var answerBody = JsonDocument.Parse(await answer.Content.ReadAsStringAsync());
        Assert.Equal("Correct", answerBody.RootElement.GetProperty("outcome").GetString());
    }

    [Fact]
    public async Task PracticeSession_PreloadsThreeQuestionsAndReplenishesTheWindow()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());

        using var session = await StartTechnologyPracticeAsync(client);
        var root = session.RootElement;
        var sessionId = root.GetProperty("sessionId").GetGuid();
        var currentQuestion = root.GetProperty("question");
        var upcomingQuestions = root.GetProperty("upcomingQuestions");

        Assert.Equal(3, upcomingQuestions.GetArrayLength());
        AssertQuestionCanBeAnsweredLocally(currentQuestion);
        Assert.All(upcomingQuestions.EnumerateArray(), AssertQuestionCanBeAnsweredLocally);

        var expectedNextWordId = upcomingQuestions[0].GetProperty("wordId").GetInt32();
        var answer = await PostWithAntiforgeryAsync(
            client,
            $"/api/practice-sessions/{sessionId}/answers",
            CreateCorrectAnswerPayload(currentQuestion)
        );
        answer.EnsureSuccessStatusCode();

        using var answerBody = JsonDocument.Parse(await answer.Content.ReadAsStringAsync());
        var updatedSession = answerBody.RootElement.GetProperty("session");

        Assert.Equal(
            expectedNextWordId,
            updatedSession.GetProperty("question").GetProperty("wordId").GetInt32()
        );
        Assert.Equal(3, updatedSession.GetProperty("upcomingQuestions").GetArrayLength());
        Assert.Equal(
            1,
            updatedSession.GetProperty("progress").GetProperty("answeredCount").GetInt32()
        );
    }

    [Fact]
    public async Task PracticeSession_ExcludesOverlappingTranslationsFromWrongOptions()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());

        using var session = await StartJobsAndWorkPracticeAsync(client);
        var questions = new[] { session.RootElement.GetProperty("question") }
            .Concat(session.RootElement.GetProperty("upcomingQuestions").EnumerateArray().ToArray())
            .Where(question => question.GetProperty("format").GetString() == "MultipleChoice")
            .ToList();

        Assert.NotEmpty(questions);
        Assert.All(
            questions,
            question =>
            {
                var options = question
                    .GetProperty("options")
                    .EnumerateArray()
                    .Select(option => option.GetString()!)
                    .ToArray();
                var correctAnswer = options[question.GetProperty("correctIndex").GetInt32()];
                var correctTranslations = SplitTranslations(correctAnswer);

                Assert.All(
                    options.Where(option => option != correctAnswer),
                    option =>
                        Assert.Empty(
                            SplitTranslations(option)
                                .Intersect(correctTranslations, StringComparer.OrdinalIgnoreCase)
                        )
                );

                if (
                    string.Equals(
                        question.GetProperty("prompt").GetString(),
                        "WORK",
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                {
                    Assert.DoesNotContain("İŞ, MESLEK", options);
                    Assert.DoesNotContain(correctAnswer == "İŞ" ? "ÇALIŞMAK" : "İŞ", options);
                }

                if (
                    string.Equals(
                        question.GetProperty("prompt").GetString(),
                        "JOB",
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                {
                    Assert.DoesNotContain("İŞ", options);
                    Assert.DoesNotContain("ÇALIŞMAK", options);
                }
            }
        );
    }

    [Fact]
    public async Task TurkishToEnglishPractice_UsesTurkishPromptAndEnglishOptions()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());

        using var session = await StartAnimalsPracticeAsync(client, "TurkishToEnglish");
        var root = await AdvanceToQuestionFormatAsync(
            client,
            session.RootElement,
            "MultipleChoice"
        );
        var question = root.GetProperty("question");

        Assert.Equal("TurkishToEnglish", root.GetProperty("mode").GetString());
        Assert.Equal("TurkishToEnglish", question.GetProperty("direction").GetString());
        Assert.Equal("KEDİ", question.GetProperty("prompt").GetString());
        Assert.Equal(
            "CAT",
            question
                .GetProperty("options")[question.GetProperty("correctIndex").GetInt32()]
                .GetString()
        );

        var answer = await PostWithAntiforgeryAsync(
            client,
            $"/api/practice-sessions/{root.GetProperty("sessionId").GetGuid()}/answers",
            CreateCorrectAnswerPayload(question)
        );
        answer.EnsureSuccessStatusCode();

        using var answerBody = JsonDocument.Parse(await answer.Content.ReadAsStringAsync());
        Assert.Equal("Correct", answerBody.RootElement.GetProperty("outcome").GetString());
    }

    [Theory]
    [InlineData("EnglishToTurkish", "EnglishToTurkish")]
    [InlineData("TurkishToEnglish", "TurkishToEnglish")]
    public async Task DirectionalPractice_CreatesChoiceAndWrittenQuestions(
        string mode,
        string direction
    )
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());

        using var session = await StartAnimalsPracticeAsync(client, mode);
        var root = session.RootElement;
        var questions = new[] { root.GetProperty("question") }
            .Concat(root.GetProperty("upcomingQuestions").EnumerateArray().ToArray())
            .ToArray();

        Assert.Equal(2, root.GetProperty("progress").GetProperty("totalCount").GetInt32());
        Assert.Equal(2, questions.Length);
        Assert.All(
            questions,
            question => Assert.Equal(direction, question.GetProperty("direction").GetString())
        );
        Assert.Single(
            questions,
            question => question.GetProperty("format").GetString() == "MultipleChoice"
        );
        Assert.Single(
            questions,
            question => question.GetProperty("format").GetString() == "Written"
        );
    }

    [Fact]
    public async Task TurkishToEnglishPractice_ExcludesWordsSharingTheSameTranslation()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());

        using var session = await StartJobsAndWorkPracticeAsync(client, "TurkishToEnglish");
        var questions = new[] { session.RootElement.GetProperty("question") }
            .Concat(session.RootElement.GetProperty("upcomingQuestions").EnumerateArray().ToArray())
            .Where(question => question.GetProperty("format").GetString() == "MultipleChoice")
            .ToList();

        Assert.NotEmpty(questions);
        Assert.All(
            questions,
            question =>
            {
                Assert.Equal("TurkishToEnglish", question.GetProperty("direction").GetString());

                var prompt = question.GetProperty("prompt").GetString()!;
                var options = question
                    .GetProperty("options")
                    .EnumerateArray()
                    .Select(option => option.GetString()!)
                    .ToArray();
                var correctAnswer = options[question.GetProperty("correctIndex").GetInt32()];

                if (prompt == "İŞ")
                {
                    Assert.Equal("WORK", correctAnswer, ignoreCase: true);
                    Assert.DoesNotContain(
                        options,
                        option => string.Equals(option, "JOB", StringComparison.OrdinalIgnoreCase)
                    );
                }

                if (prompt == "MESLEK")
                {
                    Assert.Equal("JOB", correctAnswer, ignoreCase: true);
                    Assert.DoesNotContain(
                        options,
                        option => string.Equals(option, "WORK", StringComparison.OrdinalIgnoreCase)
                    );
                }
            }
        );
    }

    [Fact]
    public async Task MixedPractice_PersistsThePreparedQuestionWindow()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());

        using var session = await StartTechnologyPracticeAsync(client, "Mixed");
        var root = session.RootElement;
        var questions = new[] { root.GetProperty("question") }
            .Concat(root.GetProperty("upcomingQuestions").EnumerateArray().ToArray())
            .ToList();

        Assert.Equal("Mixed", root.GetProperty("mode").GetString());
        Assert.Equal(16, root.GetProperty("progress").GetProperty("totalCount").GetInt32());

        using var resumed = await StartTechnologyPracticeAsync(client, "Mixed");
        var resumedQuestions = new[] { resumed.RootElement.GetProperty("question") }
            .Concat(resumed.RootElement.GetProperty("upcomingQuestions").EnumerateArray().ToArray())
            .Select(question => new
            {
                WordId = question.GetProperty("wordId").GetInt32(),
                Direction = question.GetProperty("direction").GetString(),
                Format = question.GetProperty("format").GetString(),
                Prompt = question.GetProperty("prompt").GetString(),
            })
            .ToArray();
        var originalQuestions = questions
            .Select(question => new
            {
                WordId = question.GetProperty("wordId").GetInt32(),
                Direction = question.GetProperty("direction").GetString(),
                Format = question.GetProperty("format").GetString(),
                Prompt = question.GetProperty("prompt").GetString(),
            })
            .ToArray();

        Assert.Equal(
            root.GetProperty("sessionId").GetGuid(),
            resumed.RootElement.GetProperty("sessionId").GetGuid()
        );
        Assert.Equal(originalQuestions, resumedQuestions);
    }

    [Fact]
    public async Task CompletingMixedPractice_CompletesMixedAndBothDirections()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());
        using var session = await StartAnimalsPracticeAsync(client, "Mixed");
        var currentSession = session.RootElement.Clone();

        Assert.Equal(
            4,
            currentSession.GetProperty("progress").GetProperty("totalCount").GetInt32()
        );

        var askedDirections = new HashSet<string>();
        var askedQuestions = new HashSet<(int WordId, string Direction, string Format)>();
        while (currentSession.GetProperty("status").GetString() == "Active")
        {
            var question = currentSession.GetProperty("question");
            var direction = question.GetProperty("direction").GetString()!;
            var format = question.GetProperty("format").GetString()!;
            var wordId = question.GetProperty("wordId").GetInt32();
            askedDirections.Add(direction);
            Assert.True(askedQuestions.Add((wordId, direction, format)));

            var answer =
                format == "Written"
                    ? await PostWithAntiforgeryAsync(
                        client,
                        $"/api/practice-sessions/{currentSession.GetProperty("sessionId").GetGuid()}/answers",
                        new
                        {
                            position = question.GetProperty("position").GetInt32(),
                            wordId,
                            writtenAnswer = question.GetProperty("acceptedAnswers")[0].GetString(),
                        }
                    )
                    : await PostWithAntiforgeryAsync(
                        client,
                        $"/api/practice-sessions/{currentSession.GetProperty("sessionId").GetGuid()}/answers",
                        new
                        {
                            position = question.GetProperty("position").GetInt32(),
                            wordId,
                            selectedIndex = question.GetProperty("correctIndex").GetInt32(),
                        }
                    );
            answer.EnsureSuccessStatusCode();
            using var answerBody = JsonDocument.Parse(await answer.Content.ReadAsStringAsync());
            currentSession = answerBody.RootElement.GetProperty("session").Clone();
        }

        Assert.Equal(["EnglishToTurkish", "TurkishToEnglish"], askedDirections.Order().ToArray());
        Assert.Equal(4, askedQuestions.Count);

        var categories = await client.GetFromJsonAsync<JsonElement>("/api/categories");
        var animals = categories
            .GetProperty("levels")[0]
            .GetProperty("topics")
            .EnumerateArray()
            .Single(item => item.GetProperty("value").GetString() == "Animals");

        Assert.Equal("Completed", animals.GetProperty("status").GetString());
        Assert.All(
            animals.GetProperty("modes").EnumerateArray(),
            mode =>
                Assert.Equal(
                    mode.GetProperty("totalQuestionCount").GetInt32(),
                    mode.GetProperty("completedQuestionCount").GetInt32()
                )
        );
    }

    [Fact]
    public async Task CompletingBothDirectionalModes_CompletesBothDirectionsMode()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());

        await CompleteAnimalsPracticeAsync(client, "EnglishToTurkish");
        var afterFirstMode = await GetAnimalsCategoryAsync(client);

        Assert.Equal("InProgress", afterFirstMode.GetProperty("status").GetString());
        AssertModeProgress(afterFirstMode, "EnglishToTurkish", 2, 2);
        AssertModeProgress(afterFirstMode, "TurkishToEnglish", 0, 2);

        await CompleteAnimalsPracticeAsync(client, "TurkishToEnglish");
        var afterBothModes = await GetAnimalsCategoryAsync(client);

        Assert.Equal("Completed", afterBothModes.GetProperty("status").GetString());
        AssertModeProgress(afterBothModes, "EnglishToTurkish", 2, 2);
        AssertModeProgress(afterBothModes, "TurkishToEnglish", 2, 2);
        AssertModeProgress(afterBothModes, "Mixed", 4, 4);
    }

    [Fact]
    public async Task ResetCategoryProgress_RemovesOnlySelectedCategoryProgress()
    {
        using var client = CreateIsolatedClient();
        var credentials = CreateCredentials();
        await RegisterAsync(client, credentials);
        await CompleteAnimalsPracticeAsync(client, "EnglishToTurkish");
        await CompleteTopicPracticeAsync(client, "Education", "EnglishToTurkish");

        var resetResponse = await DeleteWithAntiforgeryAsync(
            client,
            "/api/categories/A1/Animals/progress"
        );

        Assert.Equal(HttpStatusCode.NoContent, resetResponse.StatusCode);

        var categories = await client.GetFromJsonAsync<JsonElement>("/api/categories");
        var topics = categories
            .GetProperty("levels")[0]
            .GetProperty("topics")
            .EnumerateArray()
            .ToArray();
        var animals = topics.Single(item => item.GetProperty("value").GetString() == "Animals");
        var education = topics.Single(item => item.GetProperty("value").GetString() == "Education");

        Assert.Equal("Available", animals.GetProperty("status").GetString());
        Assert.All(
            animals.GetProperty("modes").EnumerateArray(),
            mode => Assert.Equal(0, mode.GetProperty("completedQuestionCount").GetInt32())
        );
        AssertModeProgress(education, "EnglishToTurkish", 2, 2);

        var words =
            await client.GetFromJsonAsync<JsonElement[]>("/api/words")
            ?? throw new InvalidOperationException("Words response was empty.");
        var cat = words.Single(word => word.GetProperty("english").GetString() == "CAT");
        var book = words.Single(word => word.GetProperty("english").GetString() == "BOOK");
        Assert.Equal(JsonValueKind.Null, cat.GetProperty("currentOutcome").ValueKind);
        Assert.Equal("Correct", book.GetProperty("currentOutcome").GetString());

        var recoveredUser = await client.GetFromJsonAsync<JsonElement>("/api/auth/session");
        Assert.Equal(credentials.Username, recoveredUser.GetProperty("username").GetString());
    }

    [Fact]
    public async Task CorrectInOtherDirection_ExposesLatestWordStatusOnly()
    {
        var credentials = CreateCredentials();
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, credentials);

        var firstSession = await StartAnimalsPracticeAsync(client);
        var firstSessionId = firstSession.RootElement.GetProperty("sessionId").GetGuid();
        var firstQuestion = firstSession.RootElement.GetProperty("question");
        var wordId = firstQuestion.GetProperty("wordId").GetInt32();

        var wrongResponse = await PostWithAntiforgeryAsync(
            client,
            $"/api/practice-sessions/{firstSessionId}/answers",
            CreateWrongAnswerPayload(firstQuestion)
        );
        Assert.True(
            wrongResponse.IsSuccessStatusCode,
            await wrongResponse.Content.ReadAsStringAsync()
        );

        using var reverseSession = await StartAnimalsPracticeAsync(client, "TurkishToEnglish");
        var secondSessionId = reverseSession.RootElement.GetProperty("sessionId").GetGuid();
        var secondQuestion = reverseSession.RootElement.GetProperty("question");

        var correctResponse = await PostWithAntiforgeryAsync(
            client,
            $"/api/practice-sessions/{secondSessionId}/answers",
            CreateCorrectAnswerPayload(secondQuestion)
        );
        correctResponse.EnsureSuccessStatusCode();

        var words = await client.GetFromJsonAsync<JsonElement[]>("/api/words");
        var cat = Assert.Single(words!, item => item.GetProperty("id").GetInt32() == wordId);

        Assert.Equal("Correct", cat.GetProperty("currentOutcome").GetString());
    }

    [Fact]
    public async Task PracticeSession_IsNotAccessibleToAnotherUser()
    {
        using var ownerClient = CreateIsolatedClient();
        using var otherClient = CreateIsolatedClient();
        await RegisterAsync(ownerClient, CreateCredentials());
        await RegisterAsync(otherClient, CreateCredentials());
        var session = await StartAnimalsPracticeAsync(ownerClient);
        var sessionId = session.RootElement.GetProperty("sessionId").GetGuid();

        var response = await otherClient.GetAsync($"/api/practice-sessions/{sessionId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CompletedPractice_PersistsResultsAndCategoryProgress()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());
        var session = await StartAnimalsPracticeAsync(client);
        var sessionId = session.RootElement.GetProperty("sessionId").GetGuid();
        await CompleteSessionWithReviewAsync(client, session.RootElement);

        var recovered = await client.GetFromJsonAsync<JsonElement>(
            $"/api/practice-sessions/{sessionId}"
        );
        var categories = await client.GetFromJsonAsync<JsonElement>("/api/categories");
        var animals = categories
            .GetProperty("levels")[0]
            .GetProperty("topics")
            .EnumerateArray()
            .Single(item => item.GetProperty("value").GetString() == "Animals");

        Assert.Equal("Completed", recovered.GetProperty("status").GetString());
        Assert.Equal(
            "CAT",
            recovered
                .GetProperty("results")
                .GetProperty("review")[0]
                .GetProperty("prompt")
                .GetString()
        );
        Assert.Equal(2, animals.GetProperty("completedQuestionCount").GetInt32());
        Assert.Equal("InProgress", animals.GetProperty("status").GetString());
        AssertModeProgress(animals, "EnglishToTurkish", 2, 2);
        AssertModeProgress(animals, "TurkishToEnglish", 0, 2);
        AssertModeProgress(animals, "Mixed", 2, 4);
    }

    [Fact]
    public async Task ReplayingCompletedPractice_CreatesANewAttempt()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());
        using var session = await StartAnimalsPracticeAsync(client);
        var sessionId = session.RootElement.GetProperty("sessionId").GetGuid();
        await CompleteSessionWithReviewAsync(client, session.RootElement);

        using var reopened = await StartAnimalsPracticeAsync(client, replay: true);

        Assert.NotEqual(sessionId, reopened.RootElement.GetProperty("sessionId").GetGuid());
        Assert.Equal("Active", reopened.RootElement.GetProperty("status").GetString());
        Assert.NotEqual(JsonValueKind.Null, reopened.RootElement.GetProperty("question").ValueKind);
    }

    [Fact]
    public async Task ActiveReplay_IsExposedByItsCategoryMode()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());
        using var session = await StartAnimalsPracticeAsync(client);
        await CompleteSessionWithReviewAsync(client, session.RootElement);
        using var replay = await StartAnimalsPracticeAsync(client, replay: true);
        var replayId = replay.RootElement.GetProperty("sessionId").GetGuid();
        var question = replay.RootElement.GetProperty("question");
        var answer = await PostWithAntiforgeryAsync(
            client,
            $"/api/practice-sessions/{replayId}/answers",
            CreateCorrectAnswerPayload(question)
        );
        answer.EnsureSuccessStatusCode();

        var animals = await GetAnimalsCategoryAsync(client);
        var mode = animals
            .GetProperty("modes")
            .EnumerateArray()
            .Single(item => item.GetProperty("mode").GetString() == "EnglishToTurkish");

        Assert.Equal(replayId, mode.GetProperty("activeSessionId").GetGuid());
        Assert.Equal(1, mode.GetProperty("activeAnsweredCount").GetInt32());
        Assert.Equal(2, mode.GetProperty("activeTotalCount").GetInt32());
        Assert.True(mode.GetProperty("isReplay").GetBoolean());
    }

    [Fact]
    public async Task CompletedMixedPractice_ProvidesBothDirectionalResultViews()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());
        await CompleteAnimalsPracticeAsync(client, "Mixed");

        var englishToTurkish = await client.GetFromJsonAsync<JsonElement>(
            "/api/practice-sessions/results?level=A1&topic=Animals&mode=EnglishToTurkish"
        );
        var turkishToEnglish = await client.GetFromJsonAsync<JsonElement>(
            "/api/practice-sessions/results?level=A1&topic=Animals&mode=TurkishToEnglish"
        );
        var bothDirections = await client.GetFromJsonAsync<JsonElement>(
            "/api/practice-sessions/results?level=A1&topic=Animals&mode=Mixed"
        );

        Assert.Equal(
            2,
            englishToTurkish.GetProperty("progress").GetProperty("totalCount").GetInt32()
        );
        Assert.Equal(
            2,
            turkishToEnglish.GetProperty("progress").GetProperty("totalCount").GetInt32()
        );
        Assert.Equal(
            4,
            bothDirections.GetProperty("progress").GetProperty("totalCount").GetInt32()
        );
        Assert.Equal(
            2,
            englishToTurkish.GetProperty("results").GetProperty("correct").GetArrayLength()
        );
        Assert.Equal(
            2,
            turkishToEnglish.GetProperty("results").GetProperty("correct").GetArrayLength()
        );
        Assert.Equal(
            4,
            bothDirections.GetProperty("results").GetProperty("correct").GetArrayLength()
        );
        Assert.All(
            englishToTurkish.GetProperty("results").GetProperty("correct").EnumerateArray(),
            result => Assert.Equal("EnglishToTurkish", result.GetProperty("direction").GetString())
        );
        Assert.All(
            turkishToEnglish.GetProperty("results").GetProperty("correct").EnumerateArray(),
            result => Assert.Equal("TurkishToEnglish", result.GetProperty("direction").GetString())
        );
    }

    [Fact]
    public async Task BothDirectionsResults_UseTheLatestCompletedAttemptForEachDirection()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());
        await CompleteAnimalsPracticeAsync(client, "EnglishToTurkish");

        using var turkishToEnglish = await StartAnimalsPracticeAsync(client, "TurkishToEnglish");
        await CompleteSessionWithReviewAsync(client, turkishToEnglish.RootElement);

        var combined = await client.GetFromJsonAsync<JsonElement>(
            "/api/practice-sessions/results?level=A1&topic=Animals&mode=Mixed"
        );

        Assert.Equal(2, combined.GetProperty("progress").GetProperty("correctCount").GetInt32());
        Assert.Equal(2, combined.GetProperty("progress").GetProperty("reviewCount").GetInt32());

        using var replayedEnglishToTurkish = await StartAnimalsPracticeAsync(
            client,
            "EnglishToTurkish",
            replay: true
        );
        await CompleteSessionWithReviewAsync(client, replayedEnglishToTurkish.RootElement);

        var updatedCombined = await client.GetFromJsonAsync<JsonElement>(
            "/api/practice-sessions/results?level=A1&topic=Animals&mode=Mixed"
        );

        Assert.Equal(
            0,
            updatedCombined.GetProperty("progress").GetProperty("correctCount").GetInt32()
        );
        Assert.Equal(
            4,
            updatedCombined.GetProperty("progress").GetProperty("reviewCount").GetInt32()
        );
    }

    [Fact]
    public async Task PracticeResults_WithoutACompletedAttempt_ReturnsNotFound()
    {
        using var client = CreateIsolatedClient();
        await RegisterAsync(client, CreateCredentials());

        var response = await client.GetAsync(
            "/api/practice-sessions/results?level=A1&topic=Animals&mode=Mixed"
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task<JsonDocument> StartAnimalsPracticeAsync(
        HttpClient client,
        string mode = "EnglishToTurkish",
        bool replay = false
    )
    {
        var response = await PostWithAntiforgeryAsync(
            client,
            "/api/practice-sessions",
            new
            {
                level = "A1",
                topic = "Animals",
                mode,
                replay,
            }
        );
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }

    private static async Task CompleteAnimalsPracticeAsync(HttpClient client, string mode)
    {
        await CompleteTopicPracticeAsync(client, "Animals", mode);
    }

    private static async Task CompleteTopicPracticeAsync(
        HttpClient client,
        string topic,
        string mode
    )
    {
        var sessionResponse = await PostWithAntiforgeryAsync(
            client,
            "/api/practice-sessions",
            new
            {
                level = "A1",
                topic,
                mode,
            }
        );
        sessionResponse.EnsureSuccessStatusCode();
        using var session = JsonDocument.Parse(await sessionResponse.Content.ReadAsStringAsync());
        await CompleteSessionWithCorrectAnswersAsync(client, session.RootElement);
    }

    private static async Task<JsonElement> GetAnimalsCategoryAsync(HttpClient client)
    {
        var categories = await client.GetFromJsonAsync<JsonElement>("/api/categories");
        return categories
            .GetProperty("levels")[0]
            .GetProperty("topics")
            .EnumerateArray()
            .Single(item => item.GetProperty("value").GetString() == "Animals")
            .Clone();
    }

    private static async Task<JsonDocument> StartTechnologyPracticeAsync(
        HttpClient client,
        string mode = "EnglishToTurkish"
    )
    {
        var response = await PostWithAntiforgeryAsync(
            client,
            "/api/practice-sessions",
            new
            {
                level = "A1",
                topic = "TechnologyAndMedia",
                mode,
            }
        );
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }

    private static async Task<JsonDocument> StartJobsAndWorkPracticeAsync(
        HttpClient client,
        string mode = "EnglishToTurkish"
    )
    {
        var response = await PostWithAntiforgeryAsync(
            client,
            "/api/practice-sessions",
            new
            {
                level = "A1",
                topic = "JobsAndWork",
                mode,
            }
        );
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }

    private static void AssertQuestionCanBeAnsweredLocally(JsonElement question)
    {
        Assert.InRange(question.GetProperty("position").GetInt32(), 0, 3);

        var expectedAnswer = question.GetProperty("prompt").GetString() switch
        {
            "COMPUTER" => "BİLGİSAYAR",
            "INTERNET" => "İNTERNET",
            "RADIO" => "RADYO",
            "TELEVISION" => "TELEVİZYON",
            _ => throw new InvalidOperationException("Unexpected preloaded question."),
        };

        if (question.GetProperty("format").GetString() == "Written")
        {
            Assert.Empty(question.GetProperty("options").EnumerateArray());
            Assert.Equal(JsonValueKind.Null, question.GetProperty("correctIndex").ValueKind);
            Assert.Contains(
                expectedAnswer,
                question
                    .GetProperty("acceptedAnswers")
                    .EnumerateArray()
                    .Select(answer => answer.GetString()!)
            );
            return;
        }

        Assert.Equal(4, question.GetProperty("options").GetArrayLength());
        var correctIndex = question.GetProperty("correctIndex").GetInt32();
        Assert.InRange(correctIndex, 0, 3);
        Assert.Equal(expectedAnswer, question.GetProperty("options")[correctIndex].GetString());
    }

    private static object CreateCorrectAnswerPayload(JsonElement question)
    {
        var position = question.GetProperty("position").GetInt32();
        var wordId = question.GetProperty("wordId").GetInt32();

        return question.GetProperty("format").GetString() == "Written"
            ? new
            {
                position,
                wordId,
                selectedIndex = (int?)null,
                writtenAnswer = question.GetProperty("acceptedAnswers")[0].GetString(),
            }
            : new
            {
                position,
                wordId,
                selectedIndex = question.GetProperty("correctIndex").GetInt32(),
                writtenAnswer = (string?)null,
            };
    }

    private static object CreateWrongAnswerPayload(JsonElement question)
    {
        var position = question.GetProperty("position").GetInt32();
        var wordId = question.GetProperty("wordId").GetInt32();

        if (question.GetProperty("format").GetString() == "Written")
        {
            return new
            {
                position,
                wordId,
                selectedIndex = (int?)null,
                writtenAnswer = "yanlış cevap",
            };
        }

        var correctIndex = question.GetProperty("correctIndex").GetInt32();
        var wrongIndex = Enumerable
            .Range(0, question.GetProperty("options").GetArrayLength())
            .First(index => index != correctIndex);
        return new
        {
            position,
            wordId,
            selectedIndex = wrongIndex,
            writtenAnswer = (string?)null,
        };
    }

    private static async Task<JsonElement> AdvanceToQuestionFormatAsync(
        HttpClient client,
        JsonElement session,
        string format
    )
    {
        var currentSession = session.Clone();

        while (currentSession.GetProperty("question").GetProperty("format").GetString() != format)
        {
            var question = currentSession.GetProperty("question");
            var response = await PostWithAntiforgeryAsync(
                client,
                $"/api/practice-sessions/{currentSession.GetProperty("sessionId").GetGuid()}/answers",
                CreateCorrectAnswerPayload(question)
            );
            response.EnsureSuccessStatusCode();
            using var responseBody = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            currentSession = responseBody.RootElement.GetProperty("session").Clone();
        }

        return currentSession;
    }

    private static async Task CompleteSessionWithCorrectAnswersAsync(
        HttpClient client,
        JsonElement session
    )
    {
        await CompleteSessionAsync(client, session, CreateCorrectAnswerPayload);
    }

    private static async Task CompleteSessionWithReviewAsync(HttpClient client, JsonElement session)
    {
        await CompleteSessionAsync(
            client,
            session,
            question => new
            {
                position = question.GetProperty("position").GetInt32(),
                wordId = question.GetProperty("wordId").GetInt32(),
                selectedIndex = (int?)null,
                writtenAnswer = (string?)null,
            }
        );
    }

    private static async Task CompleteSessionAsync(
        HttpClient client,
        JsonElement session,
        Func<JsonElement, object> createPayload
    )
    {
        var currentSession = session.Clone();

        while (currentSession.GetProperty("status").GetString() == "Active")
        {
            var question = currentSession.GetProperty("question");
            var response = await PostWithAntiforgeryAsync(
                client,
                $"/api/practice-sessions/{currentSession.GetProperty("sessionId").GetGuid()}/answers",
                createPayload(question)
            );
            response.EnsureSuccessStatusCode();
            using var responseBody = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            currentSession = responseBody.RootElement.GetProperty("session").Clone();
        }
    }

    private static async Task RegisterAsync(HttpClient client, TestCredentials credentials)
    {
        var response = await PostWithAntiforgeryAsync(
            client,
            "/api/auth/register",
            new
            {
                credentials.Email,
                credentials.Username,
                credentials.Password,
            }
        );
        response.EnsureSuccessStatusCode();
    }

    private static async Task LoginAsync(HttpClient client, TestCredentials credentials)
    {
        var response = await PostWithAntiforgeryAsync(
            client,
            "/api/auth/login",
            new { identifier = credentials.Username, credentials.Password }
        );
        response.EnsureSuccessStatusCode();
    }

    private static async Task<HttpResponseMessage> PostWithAntiforgeryAsync<T>(
        HttpClient client,
        string path,
        T body
    )
    {
        var tokenResponse = await client.GetFromJsonAsync<JsonElement>("/api/auth/antiforgery");
        var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Add("X-XSRF-TOKEN", tokenResponse.GetProperty("token").GetString());
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PutWithAntiforgeryAsync<T>(
        HttpClient client,
        string path,
        T body
    )
    {
        var tokenResponse = await client.GetFromJsonAsync<JsonElement>("/api/auth/antiforgery");
        var request = new HttpRequestMessage(HttpMethod.Put, path)
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Add("X-XSRF-TOKEN", tokenResponse.GetProperty("token").GetString());
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> DeleteWithAntiforgeryAsync(
        HttpClient client,
        string path
    )
    {
        var tokenResponse = await client.GetFromJsonAsync<JsonElement>("/api/auth/antiforgery");
        var request = new HttpRequestMessage(HttpMethod.Delete, path);
        request.Headers.Add("X-XSRF-TOKEN", tokenResponse.GetProperty("token").GetString());
        return await client.SendAsync(request);
    }

    private static TestCredentials CreateCredentials()
    {
        var suffix = Guid.NewGuid().ToString("N");
        return new TestCredentials(
            $"user-{suffix}@example.com",
            $"user-{suffix[..12]}",
            "Password1"
        );
    }

    private static int FindOptionIndex(JsonElement question, Func<string, bool> predicate)
    {
        var options = question.GetProperty("options").EnumerateArray().ToList();
        return options.FindIndex(option => predicate(option.GetString()!));
    }

    private static string[] SplitTranslations(string value)
    {
        return value.Split(
            ',',
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
        );
    }

    private static JsonElement GetMode(JsonElement category, string mode)
    {
        return category
            .GetProperty("modes")
            .EnumerateArray()
            .Single(item => item.GetProperty("mode").GetString() == mode);
    }

    private static void AssertModeProgress(
        JsonElement category,
        string mode,
        int completed,
        int total
    )
    {
        var modeProgress = GetMode(category, mode);
        Assert.Equal(completed, modeProgress.GetProperty("completedQuestionCount").GetInt32());
        Assert.Equal(total, modeProgress.GetProperty("totalQuestionCount").GetInt32());
    }

    private HttpClient CreateIsolatedClient()
    {
        var client = factory.CreateClient();
        var clientNumber = Interlocked.Increment(ref _clientNumber);
        client.DefaultRequestHeaders.Add(
            "X-Forwarded-For",
            $"10.{clientNumber / 65536 % 256}.{clientNumber / 256 % 256}.{clientNumber % 256}"
        );
        return client;
    }

    private sealed record ConcurrentQuestion(
        int Position,
        int WordId,
        string Format,
        int? CorrectIndex,
        string[] Options,
        string[] AcceptedAnswers
    );

    private sealed record TestCredentials(string Email, string Username, string Password);
}
