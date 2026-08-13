using Microsoft.EntityFrameworkCore;
using WordMatch.API.Data;
using WordMatch.API.Features.Practice;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Practice.Categories;

public class CategoryService(ApplicationDbContext db) : ICategoryService
{
    public async Task<bool> ResetProgressAsync(
        string userId,
        WordLevel level,
        WordTopic topic,
        CancellationToken cancellationToken
    )
    {
        var categoryWordIds = db
            .Words.Where(word => word.Level == level && word.Topic == topic)
            .Select(word => word.Id);

        if (!await categoryWordIds.AnyAsync(cancellationToken))
            return false;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        await db
            .PracticeSessions.Where(session =>
                session.UserId == userId && session.Level == level && session.Topic == topic
            )
            .ExecuteDeleteAsync(cancellationToken);
        await db
            .UserWordProgress.Where(progress =>
                progress.UserId == userId && categoryWordIds.Contains(progress.WordId)
            )
            .ExecuteDeleteAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task<CategoryResponse> GetCategoriesAsync(
        string userId,
        CancellationToken cancellationToken
    )
    {
        var words = await db
            .Words.AsNoTracking()
            .Select(word => new CategoryWordSummary(word.Id, word.Level, word.Topic))
            .ToListAsync(cancellationToken);
        var completedQuestions = await db
            .UserWordProgress.AsNoTracking()
            .Where(progress => progress.UserId == userId)
            .Select(progress => new CompletedQuestionSummary(
                progress.WordId,
                progress.Direction,
                progress.Format
            ))
            .ToListAsync(cancellationToken);
        var activeSessions = await db
            .PracticeSessions.AsNoTracking()
            .Where(session =>
                session.UserId == userId && session.Status == PracticeSessionStatus.Active
            )
            .Select(session => new ActiveSessionSummary(
                session.Id,
                session.Level,
                session.Topic,
                session.Mode,
                session.IsReplay,
                session.Words.Count(item => item.Outcome != null),
                session.Words.Count
            ))
            .ToListAsync(cancellationToken);

        var levels = Enum.GetValues<WordLevel>()
            .Select(level =>
            {
                var levelWords = words.Where(word => word.Level == level).ToList();

                var topics = levelWords
                    .GroupBy(word => word.Topic)
                    .OrderBy(group => GetTopicLabel(group.Key))
                    .Select(group =>
                        CreateCategoryOption(
                            group.Key.ToString(),
                            GetTopicLabel(group.Key),
                            group.Select(word => word.Id).ToHashSet(),
                            completedQuestions,
                            activeSessions.SingleOrDefault(session =>
                                session.Level == level && session.Topic == group.Key
                            )
                        )
                    )
                    .ToList();

                return new LevelCategoryResponse(
                    level.ToString(),
                    level.ToString(),
                    levelWords.Count,
                    topics
                );
            })
            .Where(level => level.WordCount > 0)
            .ToList();

        return new CategoryResponse(levels);
    }

    private static CategoryOptionResponse CreateCategoryOption(
        string value,
        string label,
        IReadOnlySet<int> wordIds,
        IReadOnlyCollection<CompletedQuestionSummary> completedQuestions,
        ActiveSessionSummary? activeSession
    )
    {
        var categoryProgress = completedQuestions
            .Where(item => wordIds.Contains(item.WordId))
            .ToList();
        var wordCount = wordIds.Count;
        var totalQuestionCount =
            wordCount
            * Enum.GetValues<QuestionDirection>().Length
            * Enum.GetValues<QuestionFormat>().Length;
        var completedQuestionCount = categoryProgress.Count;
        var status = completedQuestionCount switch
        {
            0 => CategoryProgressStatus.Available,
            _ when completedQuestionCount >= totalQuestionCount => CategoryProgressStatus.Completed,
            _ => CategoryProgressStatus.InProgress,
        };
        var modes = Enum.GetValues<PracticeMode>()
            .Select(mode => CreateModeResponse(mode, wordCount, categoryProgress, activeSession))
            .ToList();

        return new CategoryOptionResponse(
            value,
            label,
            wordCount,
            completedQuestionCount,
            totalQuestionCount,
            status,
            modes
        );
    }

    private static CategoryModeResponse CreateModeResponse(
        PracticeMode mode,
        int wordCount,
        IReadOnlyCollection<CompletedQuestionSummary> categoryProgress,
        ActiveSessionSummary? activeSession
    )
    {
        var directions = mode switch
        {
            PracticeMode.EnglishToTurkish => [QuestionDirection.EnglishToTurkish],
            PracticeMode.TurkishToEnglish => [QuestionDirection.TurkishToEnglish],
            PracticeMode.Mixed => Enum.GetValues<QuestionDirection>(),
            _ => throw new ArgumentOutOfRangeException(nameof(mode)),
        };
        var completedCount = categoryProgress.Count(item => directions.Contains(item.Direction));
        var totalCount = wordCount * directions.Length * Enum.GetValues<QuestionFormat>().Length;

        var matchingSession = activeSession?.Mode == mode ? activeSession : null;

        return new CategoryModeResponse(
            mode,
            completedCount,
            totalCount,
            matchingSession?.Id,
            matchingSession?.AnsweredCount ?? 0,
            matchingSession?.TotalCount ?? 0,
            matchingSession?.IsReplay ?? false
        );
    }

    private sealed record CategoryWordSummary(int Id, WordLevel Level, WordTopic Topic);

    private sealed record CompletedQuestionSummary(
        int WordId,
        QuestionDirection Direction,
        QuestionFormat Format
    );

    private sealed record ActiveSessionSummary(
        Guid Id,
        WordLevel Level,
        WordTopic Topic,
        PracticeMode Mode,
        bool IsReplay,
        int AnsweredCount,
        int TotalCount
    );

    private static string GetTopicLabel(WordTopic topic)
    {
        return topic switch
        {
            WordTopic.Actions => "Eylemler",
            WordTopic.Animals => "Hayvanlar",
            WordTopic.ArtsAndEntertainment => "Sanat ve Eğlence",
            WordTopic.BodyAndHealth => "Vücut ve Sağlık",
            WordTopic.CalendarAndTime => "Takvim ve Zaman",
            WordTopic.Clothing => "Giyim",
            WordTopic.Colors => "Renkler",
            WordTopic.Countries => "Ülkeler",
            WordTopic.Days => "Günler",
            WordTopic.Descriptions => "Betimlemeler",
            WordTopic.Education => "Eğitim",
            WordTopic.EmotionsAndPersonality => "Duygular ve Kişilik",
            WordTopic.FamilyAndPeople => "Aile ve İnsanlar",
            WordTopic.FoodAndDrink => "Yiyecek ve İçecek",
            WordTopic.General => "Genel",
            WordTopic.HomeAndObjects => "Ev ve Eşyalar",
            WordTopic.JobsAndWork => "Meslekler ve İş",
            WordTopic.Months => "Aylar",
            WordTopic.NatureAndWeather => "Doğa ve Hava Durumu",
            WordTopic.Numbers => "Sayılar",
            WordTopic.Places => "Yerler",
            WordTopic.ShoppingAndMoney => "Alışveriş ve Para",
            WordTopic.SocietyAndPolitics => "Toplum ve Siyaset",
            WordTopic.SportsAndLeisure => "Spor ve Boş Zaman",
            WordTopic.TechnologyAndMedia => "Teknoloji ve Medya",
            WordTopic.Transportation => "Ulaşım",
            WordTopic.TravelAndHolidays => "Seyahat ve Tatiller",
            _ => topic.ToString(),
        };
    }
}
