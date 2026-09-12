namespace WordMatch.API.Features.Words;

public static class WordCatalogEndpoints
{
    public static RouteGroupBuilder MapWordCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/words").RequireAuthorization();

        group.MapGet(
            "/",
            async (WordCatalogService wordCatalogService, CancellationToken cancellationToken) =>
                Results.Ok(await wordCatalogService.GetCatalogAsync(cancellationToken))
        );

        return group;
    }
}
