namespace WordMatch.API.Features.Words.Catalog;

public sealed record WordCatalogItemResponse(
    int Id,
    string English,
    IReadOnlyList<string> TurkishTranslations,
    string PartOfSpeech,
    string? PastSimple,
    string? PastParticiple,
    bool IsIrregular,
    string Level,
    string Topic,
    string? CurrentOutcome
);
