using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Testcontainers.PostgreSql;
using WordMatch.API.Data;
using WordMatch.API.Features.Practice;
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
        await MigrateAndVerifyDataPreservationAsync(db);

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
    }

    private static async Task MigrateAndVerifyDataPreservationAsync(ApplicationDbContext db)
    {
        const string previousMigration = "20260729125942_AddAutomaticQuestionPreference";
        const string translationArrayMigration = "20260729221533_StoreTurkishTranslationsAsArray";
        const string migrationUserId = "bidirectional-migration-user";
        const string migrationSessionId = "10000000-0000-0000-0000-000000000001";
        const string legacyMixedSessionId = "10000000-0000-0000-0000-000000000002";
        const string duplicateActiveSessionId = "10000000-0000-0000-0000-000000000003";
        var migrator = db.GetService<IMigrator>();

        await migrator.MigrateAsync(previousMigration);
        await db.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO "Words"
                ("English", "TurkishTranslation", "PartOfSpeech", "IsIrregular", "Level", "Topic")
            VALUES
                ('MIGRATION_PROBE', 'bir, iki', 'Noun', FALSE, 'A1', 'General');
            """
        );
        await migrator.MigrateAsync(translationArrayMigration);
        await db.Database.ExecuteSqlRawAsync(
            $"""
            INSERT INTO "AspNetUsers"
                ("Id", "CreatedAtUtc", "EmailConfirmed", "PhoneNumberConfirmed",
                 "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount",
                 "AutomaticallyLoadNextQuestion")
            VALUES
                ('{migrationUserId}', NOW(), FALSE, FALSE, FALSE, FALSE, 0, TRUE);

            INSERT INTO "PracticeSessions"
                ("Id", "UserId", "CategoryKey", "Level", "Topic", "Status",
                 "StartedAtUtc", "LastActivityAtUtc")
            VALUES
                ('{migrationSessionId}', '{migrationUserId}', 'A1|Topic|General',
                 'A1', 'General', 'Active', NOW(), NOW());

            INSERT INTO "PracticeSessionWords"
                ("PracticeSessionId", "WordId", "Position", "EnglishSnapshot",
                 "CorrectAnswerSnapshot")
            SELECT
                '{migrationSessionId}', "Id", 0, "English", 'bir, iki'
            FROM "Words"
            WHERE "English" = 'MIGRATION_PROBE';

            INSERT INTO "UserWordProgress"
                ("UserId", "WordId", "CorrectCount", "ReviewCount", "WrongCount",
                 "LastOutcome", "LastAnsweredAtUtc")
            SELECT
                '{migrationUserId}', "Id", 1, 0, 0, 'Correct', NOW()
            FROM "Words"
            WHERE "English" = 'MIGRATION_PROBE';
            """
        );
        await migrator.MigrateAsync("20260730105346_AddDefaultPracticeModePreference");
        await db.Database.ExecuteSqlRawAsync(
            $"""
            INSERT INTO "PracticeSessions"
                ("Id", "UserId", "CategoryKey", "Level", "Topic", "Mode", "Status",
                 "StartedAtUtc", "LastActivityAtUtc", "CompletedAtUtc")
            VALUES
                ('{legacyMixedSessionId}', '{migrationUserId}',
                 'A1|Topic|General|Mode|Mixed', 'A1', 'General', 'Mixed',
                 'Completed', NOW(), NOW(), NOW());

            INSERT INTO "PracticeSessionWords"
                ("PracticeSessionId", "WordId", "Position", "Direction",
                 "EnglishSnapshot", "PromptSnapshot", "CorrectAnswerSnapshot")
            SELECT
                '{legacyMixedSessionId}', "Id", 0, 'EnglishToTurkish',
                "English", "English", 'bir, iki'
            FROM "Words"
            WHERE "English" = 'MIGRATION_PROBE';
            """
        );
        await migrator.MigrateAsync("20260803165906_RemoveDefaultPracticeModePreference");
        await db.Database.ExecuteSqlRawAsync(
            $"""
            INSERT INTO "PracticeSessions"
                ("Id", "UserId", "CategoryKey", "Level", "Topic", "Mode", "Status",
                 "StartedAtUtc", "LastActivityAtUtc")
            VALUES
                ('{duplicateActiveSessionId}', '{migrationUserId}',
                 'A1|Topic|General|Mode|TurkishToEnglish', 'A1', 'General',
                 'TurkishToEnglish', 'Active', NOW() - INTERVAL '1 minute',
                 NOW() - INTERVAL '1 minute');
            """
        );
        await migrator.MigrateAsync();
        db.ChangeTracker.Clear();

        var probe = await db.Words.SingleAsync(word => word.English == "MIGRATION_PROBE");
        if (!probe.TurkishTranslations.SequenceEqual(["bir", "iki"]))
        {
            throw new InvalidOperationException(
                "The Turkish translation array migration did not preserve legacy values."
            );
        }

        var migratedSession = await db
            .PracticeSessions.Include(session => session.Words)
            .SingleAsync(session => session.Id == Guid.Parse(migrationSessionId));
        var migratedProgress = await db.UserWordProgress.SingleAsync(progress =>
            progress.UserId == migrationUserId && progress.WordId == probe.Id
        );
        var invalidatedMixedSession = await db
            .PracticeSessions.Include(session => session.Words)
            .SingleAsync(session => session.Id == Guid.Parse(legacyMixedSessionId));
        var duplicateActiveSession = await db.PracticeSessions.SingleAsync(session =>
            session.Id == Guid.Parse(duplicateActiveSessionId)
        );

        if (
            migratedSession.Mode != PracticeMode.EnglishToTurkish
            || migratedSession.Status != PracticeSessionStatus.Abandoned
            || migratedSession.Words.Single().Direction != QuestionDirection.EnglishToTurkish
            || migratedSession.Words.Single().Format != QuestionFormat.MultipleChoice
            || migratedSession.Words.Single().PromptSnapshot != "MIGRATION_PROBE"
            || migratedProgress.Direction != QuestionDirection.EnglishToTurkish
            || migratedProgress.Format != QuestionFormat.MultipleChoice
            || invalidatedMixedSession.Status != PracticeSessionStatus.Abandoned
            || invalidatedMixedSession.CompletedAtUtc is not null
            || invalidatedMixedSession.Words.Single().Format != QuestionFormat.MultipleChoice
            || duplicateActiveSession.Status != PracticeSessionStatus.Abandoned
        )
        {
            throw new InvalidOperationException(
                "The practice migrations did not preserve or classify legacy data correctly."
            );
        }

        await Assert.ThrowsAsync<PostgresException>(() =>
            db.Database.ExecuteSqlInterpolatedAsync(
                $"""
                UPDATE "PracticeSessions"
                SET "Status" = {"Invalid"}
                WHERE "Id" = {Guid.Parse(migrationSessionId)};
                """
            )
        );
        await Assert.ThrowsAsync<PostgresException>(() =>
            db.Database.ExecuteSqlInterpolatedAsync(
                $"""
                UPDATE "UserWordProgress"
                SET "LastOutcome" = {"Invalid"}
                WHERE "UserId" = {migrationUserId} AND "WordId" = {probe.Id};
                """
            )
        );

        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""DELETE FROM "AspNetUsers" WHERE "Id" = {migrationUserId};"""
        );
        db.ChangeTracker.Clear();
        probe = await db.Words.SingleAsync(word => word.English == "MIGRATION_PROBE");
        db.Words.Remove(probe);
        await db.SaveChangesAsync();
    }

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
