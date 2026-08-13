using Microsoft.EntityFrameworkCore;
using WordMatch.API.Data;
using WordMatch.API.Features.Practice;
using WordMatch.API.Features.Practice.Categories;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Tests.Features.Practice.Categories;

public class CategoryServiceTests
{
    [Fact]
    public async Task GetCategoriesAsync_ReturnsOnlyPopulatedLevelsWithCounts()
    {
        await using var db = CreateDbContext();
        db.Words.AddRange(
            CreateWord("CAT", "KEDİ", WordLevel.A1, WordTopic.Animals),
            CreateWord("DOG", "KÖPEK", WordLevel.A1, WordTopic.Animals),
            CreateWord("MUSEUM", "MÜZE", WordLevel.A2, WordTopic.ArtsAndEntertainment)
        );
        await db.SaveChangesAsync();

        var response = await new CategoryService(db).GetCategoriesAsync(
            "test-user",
            CancellationToken.None
        );

        Assert.Collection(
            response.Levels,
            a1 =>
            {
                Assert.Equal("A1", a1.Value);
                Assert.Equal(2, a1.WordCount);
            },
            a2 =>
            {
                Assert.Equal("A2", a2.Value);
                Assert.Equal(1, a2.WordCount);
            }
        );
    }

    [Fact]
    public async Task GetCategoriesAsync_GroupsTopics()
    {
        await using var db = CreateDbContext();
        db.Words.AddRange(
            CreateWord("CAT", "KEDİ", WordLevel.A1, WordTopic.Animals),
            CreateWord("DOG", "KÖPEK", WordLevel.A1, WordTopic.Animals),
            CreateWord("BOOK", "KİTAP", WordLevel.A1, WordTopic.Education)
        );
        await db.SaveChangesAsync();

        var response = await new CategoryService(db).GetCategoriesAsync(
            "test-user",
            CancellationToken.None
        );
        var level = Assert.Single(response.Levels);

        Assert.Contains(
            level.Topics,
            topic =>
                topic.Value == "Animals"
                && topic.Label == "Hayvanlar"
                && topic.WordCount == 2
                && topic.TotalQuestionCount == 8
        );
    }

    [Fact]
    public async Task GetCategoriesAsync_UsesSharedQuestionProgressForCategoryAndModes()
    {
        await using var db = CreateDbContext();
        var word = CreateWord("CAT", "KEDİ", WordLevel.A1, WordTopic.Animals);
        db.Words.Add(word);
        await db.SaveChangesAsync();
        db.UserWordProgress.Add(
            CreateProgress(
                word.Id,
                QuestionDirection.EnglishToTurkish,
                QuestionFormat.MultipleChoice
            )
        );
        await db.SaveChangesAsync();

        var response = await new CategoryService(db).GetCategoriesAsync(
            "test-user",
            CancellationToken.None
        );
        var animals = Assert.Single(Assert.Single(response.Levels).Topics);

        Assert.Equal(CategoryProgressStatus.InProgress, animals.Status);
        Assert.Equal(1, animals.CompletedQuestionCount);
        Assert.Equal(4, animals.TotalQuestionCount);
        AssertMode(animals, PracticeMode.EnglishToTurkish, 1, 2);
        AssertMode(animals, PracticeMode.TurkishToEnglish, 0, 2);
        AssertMode(animals, PracticeMode.Mixed, 1, 4);
    }

    [Fact]
    public async Task GetCategoriesAsync_CompletesCategoryWhenAllQuestionCombinationsExist()
    {
        await using var db = CreateDbContext();
        var word = CreateWord("CAT", "KEDİ", WordLevel.A1, WordTopic.Animals);
        db.Words.Add(word);
        await db.SaveChangesAsync();
        db.UserWordProgress.AddRange(
            Enum.GetValues<QuestionDirection>()
                .SelectMany(direction =>
                    Enum.GetValues<QuestionFormat>()
                        .Select(format => CreateProgress(word.Id, direction, format))
                )
        );
        await db.SaveChangesAsync();

        var response = await new CategoryService(db).GetCategoriesAsync(
            "test-user",
            CancellationToken.None
        );
        var animals = Assert.Single(Assert.Single(response.Levels).Topics);

        Assert.Equal(CategoryProgressStatus.Completed, animals.Status);
        Assert.Equal(4, animals.CompletedQuestionCount);
        Assert.All(
            animals.Modes,
            mode => Assert.Equal(mode.TotalQuestionCount, mode.CompletedQuestionCount)
        );
    }

    [Fact]
    public async Task GetCategoriesAsync_ReturnsActiveReplayForItsMode()
    {
        await using var db = CreateDbContext();
        var word = CreateWord("CAT", "KEDİ", WordLevel.A1, WordTopic.Animals);
        db.Words.Add(word);
        await db.SaveChangesAsync();
        db.UserWordProgress.AddRange(
            Enum.GetValues<QuestionDirection>()
                .SelectMany(direction =>
                    Enum.GetValues<QuestionFormat>()
                        .Select(format => CreateProgress(word.Id, direction, format))
                )
        );

        var session = new PracticeSession
        {
            UserId = "test-user",
            Level = WordLevel.A1,
            Topic = WordTopic.Animals,
            Mode = PracticeMode.EnglishToTurkish,
            IsReplay = true,
        };
        session.Words.Add(
            CreateSessionWord(word.Id, 0, QuestionFormat.MultipleChoice, PracticeOutcome.Correct)
        );
        session.Words.Add(CreateSessionWord(word.Id, 1, QuestionFormat.Written));
        db.PracticeSessions.Add(session);
        await db.SaveChangesAsync();

        var response = await new CategoryService(db).GetCategoriesAsync(
            "test-user",
            CancellationToken.None
        );
        var animals = Assert.Single(Assert.Single(response.Levels).Topics);
        var activeMode = Assert.Single(
            animals.Modes,
            item => item.Mode == PracticeMode.EnglishToTurkish
        );

        Assert.Equal(CategoryProgressStatus.Completed, animals.Status);
        Assert.Equal(session.Id, activeMode.ActiveSessionId);
        Assert.Equal(1, activeMode.ActiveAnsweredCount);
        Assert.Equal(2, activeMode.ActiveTotalCount);
        Assert.True(activeMode.IsReplay);
        Assert.All(
            animals.Modes.Where(item => item.Mode != PracticeMode.EnglishToTurkish),
            item => Assert.Null(item.ActiveSessionId)
        );
    }

    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static Word CreateWord(
        string english,
        string turkishTranslation,
        WordLevel level,
        WordTopic topic
    )
    {
        return new Word
        {
            English = english,
            TurkishTranslations = [turkishTranslation],
            PartOfSpeech = WordPartOfSpeech.Noun,
            IsIrregular = false,
            Level = level,
            Topic = topic,
        };
    }

    private static UserWordProgress CreateProgress(
        int wordId,
        QuestionDirection direction,
        QuestionFormat format
    )
    {
        return new UserWordProgress
        {
            UserId = "test-user",
            WordId = wordId,
            Direction = direction,
            Format = format,
            CorrectCount = 1,
            LastOutcome = PracticeOutcome.Correct,
            LastAnsweredAtUtc = DateTimeOffset.UtcNow,
        };
    }

    private static PracticeSessionWord CreateSessionWord(
        int wordId,
        int position,
        QuestionFormat format,
        PracticeOutcome? outcome = null
    )
    {
        return new PracticeSessionWord
        {
            WordId = wordId,
            Position = position,
            Direction = QuestionDirection.EnglishToTurkish,
            Format = format,
            EnglishSnapshot = "CAT",
            PromptSnapshot = "CAT",
            CorrectAnswerSnapshot = "KEDİ",
            Outcome = outcome,
        };
    }

    private static void AssertMode(
        CategoryOptionResponse category,
        PracticeMode mode,
        int completed,
        int total
    )
    {
        var response = Assert.Single(category.Modes, item => item.Mode == mode);
        Assert.Equal(completed, response.CompletedQuestionCount);
        Assert.Equal(total, response.TotalQuestionCount);
    }
}
