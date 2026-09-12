using Microsoft.EntityFrameworkCore;
using WordMatch.API.Data;

namespace WordMatch.API.Features.Words;

public sealed class WordCatalogService(ApplicationDbContext db)
{
    public async Task<IReadOnlyList<WordCatalogItemResponse>> GetCatalogAsync(
        CancellationToken cancellationToken
    )
    {
        return await db
            .Words.AsNoTracking()
            .OrderBy(word => word.Id)
            .Select(word => new WordCatalogItemResponse(
                word.Id,
                word.English,
                word.TurkishTranslations,
                word.PartOfSpeech.ToString(),
                word.PastSimple,
                word.PastParticiple,
                word.IsIrregular,
                word.Level.ToString(),
                word.Topic.ToString()
            ))
            .ToListAsync(cancellationToken);
    }
}

public sealed record WordCatalogItemResponse(
    int Id,
    string English,
    IReadOnlyList<string> TurkishTranslations,
    string PartOfSpeech,
    string? PastSimple,
    string? PastParticiple,
    bool IsIrregular,
    string Level,
    string Topic
);
