using Microsoft.EntityFrameworkCore;
using WordMatch.API.Data;
using WordMatch.API.Features.Practice;

namespace WordMatch.API.Features.Words.Catalog;

public class WordCatalogService(ApplicationDbContext db) : IWordCatalogService
{
    public async Task<IReadOnlyList<WordCatalogItemResponse>> GetCatalogAsync(
        string userId,
        CancellationToken cancellationToken
    )
    {
        var words = await db
            .Words.AsNoTracking()
            .OrderBy(word => word.Id)
            .ToListAsync(cancellationToken);

        var progressRows = await db
            .UserWordProgress.AsNoTracking()
            .Where(progress => progress.UserId == userId)
            .ToListAsync(cancellationToken);
        var progressByWordId = progressRows
            .GroupBy(item => item.WordId)
            .ToDictionary(
                group => group.Key,
                group => group.MaxBy(item => item.LastAnsweredAtUtc)!.LastOutcome
            );

        return words
            .Select(word =>
            {
                var hasProgress = progressByWordId.TryGetValue(word.Id, out var latestOutcome);

                return new WordCatalogItemResponse(
                    word.Id,
                    word.English,
                    word.TurkishTranslations,
                    word.PartOfSpeech.ToString(),
                    word.PastSimple,
                    word.PastParticiple,
                    word.IsIrregular,
                    word.Level.ToString(),
                    word.Topic.ToString(),
                    hasProgress ? latestOutcome.ToString() : null
                );
            })
            .ToList();
    }
}
