using System.Security.Claims;

namespace WordMatch.API.Features.Words.Catalog;

public static class WordCatalogEndpoints
{
    public static RouteGroupBuilder MapWordCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/words").RequireAuthorization();

        group.MapGet(
            "/",
            async (
                ClaimsPrincipal principal,
                IWordCatalogService wordCatalogService,
                CancellationToken cancellationToken
            ) =>
                Results.Ok(
                    await wordCatalogService.GetCatalogAsync(
                        principal.FindFirstValue(ClaimTypes.NameIdentifier)!,
                        cancellationToken
                    )
                )
        );

        return group;
    }
}
