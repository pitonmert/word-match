using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using WordMatch.API.Data;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Tests.Features.Words;

public sealed class WordCatalogServicePostgreSqlTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("word_catalog_tests")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();
    private ApplicationDbContext _db = null!;

    [Fact]
    public async Task GetCatalogAsync_TranslatesEnumToStringProjectionAgainstRealDatabase()
    {
        _db.Words.Add(
            new Word
            {
                Id = 1,
                English = "go",
                TurkishTranslations = ["gitmek"],
                PartOfSpeech = WordPartOfSpeech.Verb,
                PastSimple = "went",
                PastParticiple = "gone",
                IsIrregular = true,
                Level = WordLevel.A1,
                Topic = WordTopic.Actions,
            }
        );
        await _db.SaveChangesAsync();

        var service = new WordCatalogService(_db);
        var words = await service.GetCatalogAsync(CancellationToken.None);

        var word = Assert.Single(words);
        Assert.Equal("Verb", word.PartOfSpeech);
        Assert.Equal("A1", word.Level);
        Assert.Equal("Actions", word.Topic);
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
    }
}
