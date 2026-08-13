namespace WordMatch.API.Features.Words.Catalog;

public interface IWordCatalogService
{
    Task<IReadOnlyList<WordCatalogItemResponse>> GetCatalogAsync(
        string userId,
        CancellationToken cancellationToken
    );
}
