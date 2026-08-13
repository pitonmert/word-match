using Microsoft.EntityFrameworkCore;
using WordMatch.API.Data;
using WordMatch.API.Features.Practice;
using WordMatch.API.Features.Words;
using WordMatch.API.Features.Words.Catalog;

namespace WordMatch.API.Tests.Features.Words.Catalog;

public class WordCatalogServiceTests
{
    [Fact]
    public async Task GetCatalogAsync_ReturnsEveryFieldInIdOrder()
    {
        await using var db = CreateDbContext();
        db.Words.AddRange(
            new Word
            {
                Id = 2,
                English = "go",
                TurkishTranslations = ["gitmek"],
                PartOfSpeech = WordPartOfSpeech.Verb,
                PastSimple = "went",
                PastParticiple = "gone",
                IsIrregular = true,
                Level = WordLevel.A1,
                Topic = WordTopic.Actions,
            },
            new Word
            {
                Id = 1,
                English = "apple",
                TurkishTranslations = ["elma", "alma"],
                PartOfSpeech = WordPartOfSpeech.Noun,
                IsIrregular = false,
                Level = WordLevel.A1,
                Topic = WordTopic.FoodAndDrink,
            }
        );
        await db.SaveChangesAsync();
        var service = new WordCatalogService(db);

        var words = await service.GetCatalogAsync("test-user", CancellationToken.None);

        Assert.Equal([1, 2], words.Select(word => word.Id));
        Assert.Equal("apple", words[0].English);
        Assert.Equal(["elma", "alma"], words[0].TurkishTranslations);
        Assert.Equal("Noun", words[0].PartOfSpeech);
        Assert.Null(words[0].PastSimple);
        Assert.Equal("FoodAndDrink", words[0].Topic);
        Assert.Equal("went", words[1].PastSimple);
        Assert.Equal("gone", words[1].PastParticiple);
        Assert.True(words[1].IsIrregular);
    }

    [Fact]
    public async Task GetCatalogAsync_CombinesTheLatestOutcomeAndWrongHistoryAcrossDirections()
    {
        await using var db = CreateDbContext();
        db.Words.Add(
            new Word
            {
                Id = 1,
                English = "cat",
                TurkishTranslations = ["kedi"],
                PartOfSpeech = WordPartOfSpeech.Noun,
                Level = WordLevel.A1,
                Topic = WordTopic.Animals,
            }
        );
        db.UserWordProgress.AddRange(
            new UserWordProgress
            {
                UserId = "test-user",
                WordId = 1,
                Direction = QuestionDirection.EnglishToTurkish,
                WrongCount = 1,
                LastOutcome = PracticeOutcome.Wrong,
                LastAnsweredAtUtc = DateTimeOffset.UtcNow.AddMinutes(-1),
            },
            new UserWordProgress
            {
                UserId = "test-user",
                WordId = 1,
                Direction = QuestionDirection.TurkishToEnglish,
                CorrectCount = 1,
                LastOutcome = PracticeOutcome.Correct,
                LastAnsweredAtUtc = DateTimeOffset.UtcNow,
            }
        );
        await db.SaveChangesAsync();
        var service = new WordCatalogService(db);

        var words = await service.GetCatalogAsync("test-user", CancellationToken.None);
        var word = Assert.Single(words);

        Assert.Equal("Correct", word.CurrentOutcome);
    }

    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}
