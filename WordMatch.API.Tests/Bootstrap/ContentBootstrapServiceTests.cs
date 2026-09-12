using Microsoft.EntityFrameworkCore;
using WordMatch.API.Bootstrap;
using WordMatch.API.Data;
using WordMatch.API.Features.Study;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Tests.Bootstrap;

public sealed class ContentBootstrapServiceTests : IDisposable
{
    private const string Header =
        "ImportKey,English,TurkishTranslations,PartOfSpeech,PastSimple,PastParticiple,IsIrregular,Level,Topic,TopicSortOrder,WordSortOrder,LearningGroupSortOrder";

    private readonly string _sourcePath = Path.Combine(
        Path.GetTempPath(),
        $"content-bootstrap-{Guid.NewGuid():N}.csv"
    );

    [Fact]
    public async Task RepositoryContent_CoversAll700WordsIn66Topics()
    {
        var sourcePath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../../WordMatch.API/Content/Words.csv")
        );
        await using var db = CreateDbContext();
        var result = await new ContentBootstrapService(db).ImportAsync(sourcePath);
        var topics = await db.CurriculumTopics.Include(topic => topic.Words).ToListAsync();

        Assert.Equal(700, result.WordsCreated);
        Assert.Equal(700, result.WordLinksCreated);
        Assert.Equal(66, result.TopicsCreated);
        Assert.Equal(0, result.TopicsRetired);
        Assert.Equal(
            [(WordLevel.A1, 27), (WordLevel.A2, 20), (WordLevel.B1, 14), (WordLevel.B2, 5)],
            topics
                .GroupBy(topic => topic.Level)
                .OrderBy(group => group.Key)
                .Select(group => (group.Key, group.Count()))
        );
        Assert.All(topics, topic => Assert.NotEmpty(topic.Words));
        Assert.All(topics, topic => Assert.Equal(CurriculumTopicStatus.Active, topic.Status));
        Assert.All(
            topics,
            topic =>
                Assert.Equal(
                    Enumerable.Range(
                        1,
                        topic.Words.Select(link => link.LearningGroupSortOrder).Distinct().Count()
                    ),
                    topic.Words.Select(link => link.LearningGroupSortOrder).Distinct().Order()
                )
        );
        Assert.Equal(
            [1],
            topics
                .Single(topic => topic.Level == WordLevel.A1 && topic.Topic == WordTopic.Days)
                .Words.Select(link => link.LearningGroupSortOrder)
                .Distinct()
                .Order()
        );
        // Every word lives under exactly one level and topic.
        Assert.Equal(
            700,
            topics.SelectMany(topic => topic.Words).Select(link => link.WordId).Distinct().Count()
        );
    }

    [Fact]
    public async Task RepositoryContent_OrdersTopicsPerLevelFromTheSourceData()
    {
        var sourcePath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../../WordMatch.API/Content/Words.csv")
        );
        await using var db = CreateDbContext();
        await new ContentBootstrapService(db).ImportAsync(sourcePath);

        var all = await db.CurriculumTopics.ToListAsync();
        foreach (var level in all.GroupBy(topic => topic.Level))
        {
            Assert.Equal(
                Enumerable.Range(1, level.Count()),
                level.Select(topic => topic.SortOrder).Order()
            );
        }

        var a1 = all.Where(topic => topic.Level == WordLevel.A1)
            .OrderBy(topic => topic.SortOrder)
            .Select(topic => topic.Topic)
            .ToList();

        Assert.Equal(WordTopic.EmotionsAndPersonality, a1[0]);
        Assert.NotEqual(a1.Order().ToList(), a1);
    }

    [Fact]
    public async Task Import_UsesTopicSortOrderRatherThanTheTopicEnumOrder()
    {
        await using var db = CreateDbContext();
        var importer = new ContentBootstrapService(db);
        // Animals sorts before Colors in the enum but is placed second here.
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,red,"{""kırmızı""}",Adjective,,,false,A1,Colors,1,1
            wm-000002,cat,"{""kedi""}",Noun,,,false,A1,Animals,2,1
            """
        );

        await importer.ImportAsync(_sourcePath);
        var order = await db
            .CurriculumTopics.OrderBy(topic => topic.SortOrder)
            .Select(topic => topic.Topic)
            .ToListAsync();

        Assert.Equal([WordTopic.Colors, WordTopic.Animals], order);

        // Flipping the source order flips the curriculum, in place.
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000002,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            wm-000001,red,"{""kırmızı""}",Adjective,,,false,A1,Colors,2,1
            """
        );
        var result = await importer.ImportAsync(_sourcePath);
        var flipped = await db
            .CurriculumTopics.OrderBy(topic => topic.SortOrder)
            .Select(topic => topic.Topic)
            .ToListAsync();

        Assert.Equal([WordTopic.Animals, WordTopic.Colors], flipped);
        Assert.Equal(0, result.TopicsCreated);
        Assert.Equal(2, result.TopicsUpdated);
    }

    [Fact]
    public async Task Import_OrdersTopicsWithinEachLevelIndependently()
    {
        await using var db = CreateDbContext();
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            wm-000002,red,"{""kırmızı""}",Adjective,,,false,A1,Colors,2,1
            wm-000003,dog,"{""köpek""}",Noun,,,false,A2,Animals,1,1
            """
        );

        await new ContentBootstrapService(db).ImportAsync(_sourcePath);
        var topics = await db.CurriculumTopics.ToListAsync();

        Assert.Equal(3, topics.Count);
        // The same topic can appear once per level, each with its own order.
        Assert.Equal(
            1,
            topics.Single(t => t is { Level: WordLevel.A2, Topic: WordTopic.Animals }).SortOrder
        );
        Assert.Equal(
            2,
            topics.Single(t => t is { Level: WordLevel.A1, Topic: WordTopic.Colors }).SortOrder
        );
    }

    [Fact]
    public async Task Import_PersistsExplicitLearningGroupsWithinATopic()
    {
        await using var db = CreateDbContext();
        await WriteSourceWithGroupsAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1,1
            wm-000002,dog,"{""köpek""}",Noun,,,false,A1,Animals,1,2,1
            wm-000003,horse,"{""at""}",Noun,,,false,A1,Animals,1,3,2
            """
        );

        await new ContentBootstrapService(db).ImportAsync(_sourcePath);
        var groups = await db
            .CurriculumTopicWords.OrderBy(item => item.SortOrder)
            .Select(item => item.LearningGroupSortOrder)
            .ToListAsync();

        Assert.Equal([1, 1, 2], groups);
    }

    [Fact]
    public async Task Import_RetiresDroppedTopicsAndKeepsLearnerProgress()
    {
        await using var db = CreateDbContext();
        var importer = new ContentBootstrapService(db);
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            wm-000002,red,"{""kırmızı""}",Adjective,,,false,A1,Colors,2,1
            """
        );
        await importer.ImportAsync(_sourcePath);

        var redId = await db
            .Words.Where(word => word.ImportKey == "wm-000002")
            .Select(word => word.Id)
            .SingleAsync();
        db.UserWordIntroductions.Add(
            new UserWordIntroduction
            {
                UserId = "user",
                WordId = redId,
                IntroducedAtUtc = DateTimeOffset.UtcNow,
            }
        );
        db.UserWordMastery.Add(
            new UserWordMastery
            {
                UserId = "user",
                WordId = redId,
                Dimension = VocabularyMasteryDimension.WrittenRecognition,
                Stage = 4,
                CorrectCount = 6,
                LastOutcome = StudyOutcome.Correct,
                LastStudiedAtUtc = DateTimeOffset.UtcNow,
                NextReviewAtUtc = DateTimeOffset.UtcNow.AddDays(14),
            }
        );
        await db.SaveChangesAsync();

        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            """
        );
        var result = await importer.ImportAsync(_sourcePath);

        var colors = await db
            .CurriculumTopics.Include(topic => topic.Words)
            .SingleAsync(topic => topic.Topic == WordTopic.Colors);
        var mastery = await db.UserWordMastery.SingleAsync(item => item.WordId == redId);

        Assert.Equal(1, result.TopicsRetired);
        Assert.Equal(CurriculumTopicStatus.Retired, colors.Status);
        // Parked right after the single remaining active topic, not left on the
        // temporary import offset.
        Assert.Equal(2, colors.SortOrder);
        Assert.NotEmpty(colors.Words);
        Assert.Equal(4, mastery.Stage);
        Assert.Equal(6, mastery.CorrectCount);
        Assert.True(await db.UserWordIntroductions.AnyAsync(item => item.WordId == redId));
    }

    [Fact]
    public async Task Import_ReactivatesATopicThatReturnsToTheSource()
    {
        await using var db = CreateDbContext();
        var importer = new ContentBootstrapService(db);
        var full = $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            wm-000002,red,"{""kırmızı""}",Adjective,,,false,A1,Colors,2,1
            """;
        await WriteSourceAsync(full);
        await importer.ImportAsync(_sourcePath);

        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            """
        );
        await importer.ImportAsync(_sourcePath);

        await WriteSourceAsync(full);
        await importer.ImportAsync(_sourcePath);
        var colors = await db.CurriculumTopics.SingleAsync(topic =>
            topic.Topic == WordTopic.Colors
        );

        Assert.Equal(CurriculumTopicStatus.Active, colors.Status);
        Assert.Equal(2, colors.SortOrder);
    }

    [Fact]
    public async Task ImportAsync_CreatesUpdatesAndSkipsWithoutChangingDatabaseIds()
    {
        await using var db = CreateDbContext();
        await WriteSourceAsync(TwoWordCsv());

        var importer = new ContentBootstrapService(db);
        var first = await importer.ImportAsync(_sourcePath);
        var catId = await db
            .Words.Where(word => word.ImportKey == "wm-000001")
            .Select(word => word.Id)
            .SingleAsync();

        var second = await importer.ImportAsync(_sourcePath);

        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi"",""ev kedisi""}",Noun,,,false,A1,Animals,1,1
            wm-000002,go,"{""gitmek""}",Verb,went,gone,true,A1,Actions,2,1
            """
        );
        var third = await importer.ImportAsync(_sourcePath);
        var cat = await db.Words.SingleAsync(word => word.ImportKey == "wm-000001");

        Assert.Equal(2, first.WordsCreated);
        Assert.Equal(0, second.WordsCreated);
        Assert.Equal(2, second.WordsUnchanged);
        Assert.Equal(0, second.TopicsCreated);
        Assert.Equal(0, second.TopicsUpdated);
        Assert.Equal(0, second.WordLinksCreated);
        Assert.Equal(1, third.WordsUpdated);
        Assert.Equal(1, third.WordsUnchanged);
        Assert.Equal(catId, cat.Id);
        Assert.Equal(["kedi", "ev kedisi"], cat.TurkishTranslations);
    }

    [Fact]
    public async Task ImportAsync_AdoptsLegacyWordWithoutBreakingProgress()
    {
        await using var db = CreateDbContext();
        var legacyWord = new Word
        {
            Id = 42,
            ImportKey = "legacy-42",
            English = "cat",
            TurkishTranslations = ["kedi"],
            PartOfSpeech = WordPartOfSpeech.Noun,
            Level = WordLevel.A1,
            Topic = WordTopic.Animals,
        };
        db.Words.Add(legacyWord);
        db.UserWordMastery.Add(
            new UserWordMastery
            {
                UserId = "user",
                WordId = legacyWord.Id,
                Dimension = VocabularyMasteryDimension.WrittenRecognition,
                Stage = 2,
                CorrectCount = 3,
                LastOutcome = StudyOutcome.Correct,
                LastStudiedAtUtc = DateTimeOffset.UtcNow,
                NextReviewAtUtc = DateTimeOffset.UtcNow.AddDays(3),
            }
        );
        await db.SaveChangesAsync();
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            """
        );

        var result = await new ContentBootstrapService(db).ImportAsync(_sourcePath);
        var word = await db.Words.SingleAsync();
        var mastery = await db.UserWordMastery.SingleAsync();

        Assert.Equal(1, result.WordsAdopted);
        Assert.Equal(42, word.Id);
        Assert.Equal("wm-000001", word.ImportKey);
        Assert.Equal(42, mastery.WordId);
        Assert.Equal(3, mastery.CorrectCount);
    }

    [Fact]
    public async Task ImportAsync_RejectsDuplicateImportKeysBeforeChangingData()
    {
        await using var db = CreateDbContext();
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            wm-000001,dog,"{""köpek""}",Noun,,,false,A1,Animals,1,2
            """
        );

        await Assert.ThrowsAsync<WordBootstrapValidationException>(() =>
            new ContentBootstrapService(db).ImportAsync(_sourcePath)
        );
        Assert.Empty(db.Words);
    }

    [Fact]
    public async Task Import_AllowsMembershipAndOrderChangesAfterProgressStarts()
    {
        await using var db = CreateDbContext();
        var importer = new ContentBootstrapService(db);
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            wm-000002,dog,"{""köpek""}",Noun,,,false,A1,Animals,1,2
            wm-000003,parrot,"{""papağan""}",Noun,,,false,A1,Places,2,1
            """
        );
        await importer.ImportAsync(_sourcePath);

        var catId = await db
            .Words.Where(word => word.ImportKey == "wm-000001")
            .Select(word => word.Id)
            .SingleAsync();
        db.UserWordIntroductions.Add(
            new UserWordIntroduction
            {
                UserId = "user",
                WordId = catId,
                IntroducedAtUtc = DateTimeOffset.UtcNow,
            }
        );
        db.UserWordMastery.Add(
            new UserWordMastery
            {
                UserId = "user",
                WordId = catId,
                Dimension = VocabularyMasteryDimension.WrittenRecognition,
                Stage = 3,
                CorrectCount = 5,
                LastOutcome = StudyOutcome.Correct,
                LastStudiedAtUtc = DateTimeOffset.UtcNow,
                NextReviewAtUtc = DateTimeOffset.UtcNow.AddDays(7),
            }
        );
        await db.SaveChangesAsync();

        // Swap the two topics' order and move "cat" into the other topic.
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000002,dog,"{""köpek""}",Noun,,,false,A1,Animals,2,1
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Places,1,1
            wm-000003,parrot,"{""papağan""}",Noun,,,false,A1,Places,1,2
            """
        );

        var result = await importer.ImportAsync(_sourcePath);

        var catTopic = await db
            .CurriculumTopicWords.Include(link => link.CurriculumTopic)
            .Where(link => link.WordId == catId)
            .Select(link => link.CurriculumTopic.Topic)
            .SingleAsync();
        var mastery = await db.UserWordMastery.SingleAsync(item => item.WordId == catId);

        Assert.Equal(WordTopic.Places, catTopic);
        Assert.Equal(2, result.TopicsUpdated);
        Assert.Equal(5, mastery.CorrectCount);
        Assert.Equal(3, mastery.Stage);
        Assert.True(await db.UserWordIntroductions.AnyAsync(item => item.WordId == catId));
    }

    [Theory]
    [MemberData(nameof(InvalidStructures))]
    public async Task Import_RejectsInvalidTopicOrWordSequences(string content)
    {
        await using var db = CreateDbContext();
        await WriteSourceAsync(content);

        await Assert.ThrowsAsync<WordBootstrapValidationException>(() =>
            new ContentBootstrapService(db).ImportAsync(_sourcePath)
        );
        Assert.Empty(db.CurriculumTopics);
    }

    public static IEnumerable<object[]> InvalidStructures()
    {
        // Duplicate WordSortOrder within a topic.
        yield return
        [
            $$"""
                {{Header}}
                wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
                wm-000002,dog,"{""köpek""}",Noun,,,false,A1,Animals,1,1
                """,
        ];

        // Non-contiguous WordSortOrder within a topic.
        yield return
        [
            $$"""
                {{Header}}
                wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
                wm-000002,dog,"{""köpek""}",Noun,,,false,A1,Animals,1,3
                """,
        ];

        // Conflicting TopicSortOrder inside one (Level, Topic) group.
        yield return
        [
            $$"""
                {{Header}}
                wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
                wm-000002,dog,"{""köpek""}",Noun,,,false,A1,Animals,2,2
                """,
        ];

        // Gap in the level's topic sequence.
        yield return
        [
            $$"""
                {{Header}}
                wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
                wm-000002,red,"{""kırmızı""}",Adjective,,,false,A1,Colors,3,1
                """,
        ];

        // Two topics claiming the same position in one level.
        yield return
        [
            $$"""
                {{Header}}
                wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
                wm-000002,red,"{""kırmızı""}",Adjective,,,false,A1,Colors,1,1
                """,
        ];
    }

    public void Dispose()
    {
        if (File.Exists(_sourcePath))
            File.Delete(_sourcePath);
    }

    private Task WriteSourceAsync(string content) =>
        File.WriteAllTextAsync(
            _sourcePath,
            string.Join(
                Environment.NewLine,
                content
                    .Split(Environment.NewLine)
                    .Select(
                        (line, index) =>
                            index == 0 || string.IsNullOrWhiteSpace(line) ? line : $"{line},1"
                    )
            )
        );

    private Task WriteSourceWithGroupsAsync(string content) =>
        File.WriteAllTextAsync(_sourcePath, content);

    private static string TwoWordCsv() =>
        $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            wm-000002,go,"{""gitmek""}",Verb,went,gone,true,A1,Actions,2,1
            """;

    private static ApplicationDbContext CreateDbContext() =>
        new(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options
        );
}
