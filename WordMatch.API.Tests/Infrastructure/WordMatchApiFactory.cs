using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;
using WordMatch.API.Data;
using WordMatch.API.Features.Study;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Tests.Infrastructure;

public sealed class WordMatchApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("word_match_tests")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        await using var scope = Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.MigrateAsync();

        if (await db.Words.AnyAsync())
            return;

        db.Words.AddRange(
            CreateWord("CAT", "KEDİ", WordPartOfSpeech.Noun, WordTopic.Animals),
            CreateWord("BOOK", "KİTAP", WordPartOfSpeech.Noun, WordTopic.Education),
            CreateWord("RED", "KIRMIZI", WordPartOfSpeech.Adjective, WordTopic.Colors),
            CreateWord(
                "COMPUTER",
                "BİLGİSAYAR",
                WordPartOfSpeech.Noun,
                WordTopic.TechnologyAndMedia
            ),
            CreateWord("INTERNET", "İNTERNET", WordPartOfSpeech.Noun, WordTopic.TechnologyAndMedia),
            CreateWord("RADIO", "RADYO", WordPartOfSpeech.Noun, WordTopic.TechnologyAndMedia),
            CreateWord(
                "TELEVISION",
                "TELEVİZYON",
                WordPartOfSpeech.Noun,
                WordTopic.TechnologyAndMedia
            ),
            CreateWord("WORK", "İŞ", WordPartOfSpeech.Noun, WordTopic.JobsAndWork),
            new Word
            {
                English = "JOB",
                TurkishTranslations = ["İŞ", "MESLEK"],
                PartOfSpeech = WordPartOfSpeech.Noun,
                Level = WordLevel.A1,
                Topic = WordTopic.JobsAndWork,
            },
            new Word
            {
                English = "work",
                TurkishTranslations = ["ÇALIŞMAK"],
                PartOfSpeech = WordPartOfSpeech.Verb,
                PastSimple = "WORKED",
                PastParticiple = "WORKED",
                Level = WordLevel.A1,
                Topic = WordTopic.JobsAndWork,
            },
            new Word
            {
                English = "GO",
                TurkishTranslations = ["GİTMEK"],
                PartOfSpeech = WordPartOfSpeech.Verb,
                PastSimple = "WENT",
                PastParticiple = "GONE",
                IsIrregular = true,
                Level = WordLevel.A1,
                Topic = WordTopic.Actions,
            }
        );
        await db.SaveChangesAsync();

        var studyWords = await db.Words.OrderBy(word => word.Id).ToListAsync();
        for (var index = 0; index < TopicOrder.Length; index++)
        {
            var topic = new CurriculumTopic
            {
                Level = WordLevel.A1,
                Topic = TopicOrder[index],
                SortOrder = index + 1,
            };
            var topicWords = studyWords.Where(word => word.Topic == TopicOrder[index]).ToList();
            for (var position = 0; position < topicWords.Count; position++)
            {
                topic.Words.Add(
                    new CurriculumTopicWord
                    {
                        WordId = topicWords[position].Id,
                        SortOrder = position + 1,
                    }
                );
            }

            db.CurriculumTopics.Add(topic);
        }

        await db.SaveChangesAsync();
    }

    // The curriculum spine is explicit data, not the WordTopic enum order. The
    // first topic is deliberately the largest so a topic session has several
    // questions before it completes.
    public static readonly WordTopic[] TopicOrder =
    [
        WordTopic.TechnologyAndMedia,
        WordTopic.JobsAndWork,
        WordTopic.Animals,
        WordTopic.Colors,
        WordTopic.Education,
        WordTopic.Actions,
    ];

    async Task IAsyncLifetime.DisposeAsync()
    {
        await _postgres.DisposeAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration(config =>
            config.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = _postgres.GetConnectionString(),
                    ["Database:AutoMigrate"] = "false",
                    ["Https:Redirect"] = "false",
                }
            )
        );
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(_postgres.GetConnectionString())
            );
        });
    }

    private static Word CreateWord(
        string english,
        string translation,
        WordPartOfSpeech partOfSpeech,
        WordTopic topic
    )
    {
        return new Word
        {
            English = english,
            TurkishTranslations = [translation],
            PartOfSpeech = partOfSpeech,
            Level = WordLevel.A1,
            Topic = topic,
        };
    }
}
