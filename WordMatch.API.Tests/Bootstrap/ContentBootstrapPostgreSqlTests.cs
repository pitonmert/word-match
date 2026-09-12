using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using WordMatch.API.Bootstrap;
using WordMatch.API.Data;
using WordMatch.API.Features.Auth;
using WordMatch.API.Features.Study;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Tests.Bootstrap;

public sealed class ContentBootstrapPostgreSqlTests : IAsyncLifetime
{
    private const string Header =
        "ImportKey,English,TurkishTranslations,PartOfSpeech,PastSimple,PastParticiple,IsIrregular,Level,Topic,TopicSortOrder,WordSortOrder,LearningGroupSortOrder";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("content_bootstrap_tests")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();
    private readonly string _sourcePath = Path.Combine(
        Path.GetTempPath(),
        $"content-bootstrap-postgres-{Guid.NewGuid():N}.csv"
    );
    private ApplicationDbContext _db = null!;

    [Fact]
    public async Task Import_ReordersTopicsAndMovesWordsWithoutLosingProgress()
    {
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            wm-000002,dog,"{""köpek""}",Noun,,,false,A1,Animals,1,2
            wm-000003,red,"{""kırmızı""}",Adjective,,,false,A1,Colors,2,1
            """
        );
        var importer = new ContentBootstrapService(_db);
        await importer.ImportAsync(_sourcePath);
        var catId = await _db
            .Words.Where(word => word.ImportKey == "wm-000001")
            .Select(word => word.Id)
            .SingleAsync();
        _db.Users.Add(
            new ApplicationUser
            {
                Id = "user",
                UserName = "user",
                NormalizedUserName = "USER",
                Email = "user@example.com",
                NormalizedEmail = "USER@EXAMPLE.COM",
            }
        );
        _db.UserWordIntroductions.Add(
            new UserWordIntroduction
            {
                UserId = "user",
                WordId = catId,
                IntroducedAtUtc = DateTimeOffset.UtcNow,
            }
        );
        _db.UserWordMastery.Add(
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
        await _db.SaveChangesAsync();

        // Swap the topics' order and move "cat" from Animals into Colors.
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000002,dog,"{""köpek""}",Noun,,,false,A1,Animals,2,1
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Colors,1,1
            wm-000003,red,"{""kırmızı""}",Adjective,,,false,A1,Colors,1,2
            """
        );

        var result = await importer.ImportAsync(_sourcePath);
        var links = await _db
            .CurriculumTopicWords.Include(link => link.CurriculumTopic)
            .OrderBy(link => link.CurriculumTopic.SortOrder)
            .ThenBy(link => link.SortOrder)
            .Select(link => new
            {
                link.WordId,
                link.CurriculumTopic.Topic,
                link.SortOrder,
            })
            .ToListAsync();
        var mastery = await _db.UserWordMastery.SingleAsync(item => item.WordId == catId);

        Assert.Equal(2, result.TopicsUpdated);
        Assert.Equal(3, result.WordLinksUpdated);
        Assert.Collection(
            links,
            link =>
            {
                Assert.Equal(WordTopic.Colors, link.Topic);
                Assert.Equal(1, link.SortOrder);
            },
            link =>
            {
                Assert.Equal(WordTopic.Colors, link.Topic);
                Assert.Equal(2, link.SortOrder);
            },
            link =>
            {
                Assert.Equal(WordTopic.Animals, link.Topic);
                Assert.Equal(1, link.SortOrder);
            }
        );
        Assert.Equal(5, mastery.CorrectCount);
        Assert.Equal(3, mastery.Stage);
        Assert.True(await _db.UserWordIntroductions.AnyAsync(item => item.WordId == catId));
    }

    [Fact]
    public async Task Import_RollsBackEarlierWritesWhenALaterWriteFails()
    {
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            wm-000002,dog,"{""köpek""}",Noun,,,false,A1,Animals,1,2
            """
        );
        var importer = new ContentBootstrapService(_db);
        await importer.ImportAsync(_sourcePath);

        // Passes CSV validation, but the third row collides with "dog" on the
        // unique (English, PartOfSpeech) index once it reaches the database.
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""ev kedisi""}",Noun,,,false,A1,Animals,1,1
            wm-000002,dog,"{""köpek""}",Noun,,,false,A1,Animals,1,2
            wm-000003,dog,"{""it""}",Noun,,,false,A1,Animals,1,3
            """
        );

        await Assert.ThrowsAsync<DbUpdateException>(() => importer.ImportAsync(_sourcePath));
        _db.ChangeTracker.Clear();

        var cat = await _db.Words.SingleAsync(word => word.ImportKey == "wm-000001");

        Assert.Equal(["kedi"], cat.TurkishTranslations);
        Assert.Equal(2, await _db.Words.CountAsync());
        Assert.Equal(2, await _db.CurriculumTopicWords.CountAsync());
    }

    [Fact]
    public async Task Import_KeepsRetiredTopicsInAStableOrderAfterTheCurriculum()
    {
        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            wm-000002,red,"{""kırmızı""}",Adjective,,,false,A1,Colors,2,1
            wm-000003,book,"{""kitap""}",Noun,,,false,A1,Education,3,1
            """
        );
        var importer = new ContentBootstrapService(_db);
        await importer.ImportAsync(_sourcePath);

        await WriteSourceAsync(
            $$"""
            {{Header}}
            wm-000001,cat,"{""kedi""}",Noun,,,false,A1,Animals,1,1
            wm-000003,book,"{""kitap""}",Noun,,,false,A1,Education,2,1
            """
        );

        await importer.ImportAsync(_sourcePath);
        var firstImport = await GetTopicOrdersAsync();
        await importer.ImportAsync(_sourcePath);
        var secondImport = await GetTopicOrdersAsync();

        Assert.Equal(
            [
                (WordTopic.Animals, 1, CurriculumTopicStatus.Active),
                (WordTopic.Education, 2, CurriculumTopicStatus.Active),
                (WordTopic.Colors, 3, CurriculumTopicStatus.Retired),
            ],
            firstImport
        );
        // Repeat imports must not let the temporary offset accumulate.
        Assert.Equal(firstImport, secondImport);
    }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        _db = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(_postgres.GetConnectionString())
                .Options
        );
        await _db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _postgres.DisposeAsync();
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

    private Task<
        List<(WordTopic Topic, int SortOrder, CurriculumTopicStatus Status)>
    > GetTopicOrdersAsync() =>
        _db
            .CurriculumTopics.OrderBy(topic => topic.Level)
            .ThenBy(topic => topic.SortOrder)
            .Select(topic => new ValueTuple<WordTopic, int, CurriculumTopicStatus>(
                topic.Topic,
                topic.SortOrder,
                topic.Status
            ))
            .ToListAsync();
}
